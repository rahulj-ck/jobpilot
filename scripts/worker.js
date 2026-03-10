#!/usr/bin/env node
// scripts/worker.js — production VM worker, runs forever, polls Supabase queue
// Deployed on Railway. Run with: node scripts/worker.js

const { chromium } = require("playwright");
const { applyToJob } = require("./greenhouse");
const fs = require("fs");
const path = require("path");
const os = require("os");

const SUPABASE_URL     = process.env.SUPABASE_URL;
const SERVICE_KEY      = process.env.SUPABASE_SERVICE_KEY;
const ANTHROPIC_KEY    = process.env.ANTHROPIC_API_KEY;
const POLL_INTERVAL    = parseInt(process.env.POLL_INTERVAL_MS || "60000");  // 60s
const MAX_PER_POLL     = parseInt(process.env.MAX_PER_POLL || "5");          // 5 jobs per cycle
const DELAY_MIN        = parseInt(process.env.DELAY_MIN_SEC || "30");
const DELAY_MAX        = parseInt(process.env.DELAY_MAX_SEC || "90");

if (!SUPABASE_URL || !SERVICE_KEY || !ANTHROPIC_KEY) {
  console.error("Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY");
  process.exit(1);
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function supabase(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${res.status}: ${text}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function fetchQueuedJobs() {
  return supabase(
    `/apply_queue?status=eq.queued&order=created_at.asc&limit=${MAX_PER_POLL}&select=*`
  );
}

async function fetchUserProfile(userId) {
  const rows = await supabase(
    `/user_profiles?user_id=eq.${userId}&select=*&limit=1`
  );
  return rows?.[0] || null;
}

async function downloadResume(userId) {
  // Download resume PDF from Supabase Storage to a temp file
  try {
    const url = `${SUPABASE_URL}/storage/v1/object/resumes/${userId}/resume.pdf`;
    const res = await fetch(url, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    if (!res.ok) return null;

    const buffer = await res.arrayBuffer();
    const tmpPath = path.join(os.tmpdir(), `resume_${userId}.pdf`);
    fs.writeFileSync(tmpPath, Buffer.from(buffer));
    return tmpPath;
  } catch (e) {
    console.error(`Failed to download resume for ${userId}:`, e.message);
    return null;
  }
}

async function updateStatus(id, status, extra = {}) {
  await supabase(`/apply_queue?id=eq.${id}`, {
    method: "PATCH",
    headers: { "Prefer": "return=minimal" },
    body: JSON.stringify({ status, ...extra }),
  });
}

// ── Build profile object from Supabase row ────────────────────────────────────

function buildProfile(dbProfile, resumePath) {
  const nameParts = (dbProfile.name || "").trim().split(" ");
  return {
    firstName:       nameParts[0] || "",
    lastName:        nameParts.slice(1).join(" ") || "",
    email:           dbProfile.email || "",
    phone:           dbProfile.phone || "",
    linkedin:        dbProfile.linkedin || "",
    resumePath:      resumePath || null,
    title:           dbProfile.title || "",
    skills:          dbProfile.skills || "",
    experience:      dbProfile.experience || "",
    bio:             dbProfile.bio || "",
    school:          dbProfile.school || "",
    degree:          dbProfile.degree || "Bachelor's",
    discipline:      dbProfile.discipline || "Computer Science",
    workAuth:        dbProfile.work_auth || "yes",
    needSponsorship: dbProfile.need_sponsorship || "no",
    salaryMin:       dbProfile.salary_min || "100000",
    salaryMax:       dbProfile.salary_max || "200000",
  };
}

// ── Process one job ───────────────────────────────────────────────────────────

async function processJob(browser, item) {
  const tag = `[${item.company}/${item.job_title?.slice(0, 20)}]`;
  console.log(`\n${tag} Starting...`);

  await updateStatus(item.id, "applying");

  // Fetch user profile
  const dbProfile = await fetchUserProfile(item.user_id);
  if (!dbProfile || !dbProfile.email) {
    console.error(`${tag} No profile found for user ${item.user_id}`);
    await updateStatus(item.id, "failed", { error_msg: "No profile found. Please complete your profile." });
    return false;
  }

  // Download resume
  const resumePath = await downloadResume(item.user_id);
  if (!resumePath) {
    console.warn(`${tag} No resume found — applying without resume`);
  }

  const profile = buildProfile(dbProfile, resumePath);
  console.log(`${tag} Profile loaded for ${profile.firstName} ${profile.lastName}`);

  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  const jobData = {
    company:     item.company,
    title:       item.job_title,
    url:         item.job_url,
    description: item.description || "",
    coverLetter: item.cover_letter || "",
  };

  try {
    const result = await applyToJob(page, jobData, profile, false);
    await page.close();

    // Clean up temp resume file
    if (resumePath) {
      try { fs.unlinkSync(resumePath); } catch {}
    }

    if (result.success) {
      await updateStatus(item.id, "applied", {
        applied_at: new Date().toISOString(),
        error_msg: result.warning || null,
      });
      console.log(`${tag} ✓ Applied!`);
      return true;
    } else {
      await updateStatus(item.id, "failed", { error_msg: result.error });
      console.error(`${tag} ✗ Failed: ${result.error}`);
      return false;
    }
  } catch (e) {
    await page.close().catch(() => {});
    await updateStatus(item.id, "failed", { error_msg: e.message });
    console.error(`${tag} ✗ Exception: ${e.message}`);
    return false;
  }
}

// ── Poll loop ─────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function poll(browser) {
  try {
    const queue = await fetchQueuedJobs();
    if (!queue || queue.length === 0) {
      process.stdout.write(".");  // dot = idle heartbeat
      return;
    }

    console.log(`\n[Worker] Found ${queue.length} queued job(s)`);

    for (const item of queue) {
      await processJob(browser, item);

      // Human-like delay between applications
      const delaySec = DELAY_MIN + Math.random() * (DELAY_MAX - DELAY_MIN);
      console.log(`[Worker] Waiting ${Math.round(delaySec)}s...`);
      await sleep(delaySec * 1000);
    }
  } catch (e) {
    console.error("\n[Worker] Poll error:", e.message);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  JobPilot Worker — starting");
  console.log(`  Poll interval: ${POLL_INTERVAL / 1000}s`);
  console.log(`  Max per poll: ${MAX_PER_POLL}`);
  console.log(`  Supabase: ${SUPABASE_URL}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",  // important for Railway/Docker
      "--disable-gpu",
    ],
  });

  console.log("[Worker] Browser launched. Polling for jobs...\n");

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    console.log("\n[Worker] SIGTERM received, shutting down...");
    await browser.close();
    process.exit(0);
  });

  // Poll forever
  while (true) {
    await poll(browser);
    await sleep(POLL_INTERVAL);
  }
}

main().catch(e => {
  console.error("Fatal:", e);
  process.exit(1);
});
