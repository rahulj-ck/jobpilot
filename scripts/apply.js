#!/usr/bin/env node
// scripts/apply.js — main auto-apply runner
// Usage:
//   node scripts/apply.js              (headless, real submissions)
//   node scripts/apply.js --dry-run    (fills forms but doesn't submit)
//   node scripts/apply.js --visible    (shows browser window)
//   node scripts/apply.js --limit 5   (override max per run)

const { chromium } = require("playwright");
const config = require("./config");
const { applyToJob } = require("./greenhouse");

const SUPABASE_URL = config.supabaseUrl;
const SERVICE_KEY  = config.supabaseServiceKey;

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function fetchQueue(limit) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/apply_queue?status=eq.queued&order=created_at.asc&limit=${limit}&select=*`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  return res.json();
}

async function updateStatus(id, status, extra = {}) {
  await fetch(`${SUPABASE_URL}/rest/v1/apply_queue?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=minimal",
    },
    body: JSON.stringify({ status, ...extra }),
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function randomDelay(minS, maxS) {
  const ms = (minS + Math.random() * (maxS - minS)) * 1000;
  return sleep(ms);
}

function parseArgs() {
  const limitFlag = process.argv.indexOf("--limit");
  if (limitFlag !== -1) {
    const n = parseInt(process.argv[limitFlag + 1]);
    if (!isNaN(n)) return n;
  }
  return config.maxPerRun;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const limit = parseArgs();

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  JobPilot Auto-Apply");
  if (config.dryRun) console.log("  ⚠ DRY RUN — forms will be filled but NOT submitted");
  if (!config.headless) console.log("  👀 VISIBLE mode — browser window will open");
  console.log(`  Max applications this run: ${limit}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Fetch queue
  const queue = await fetchQueue(limit);
  if (!queue || queue.length === 0) {
    console.log("Queue is empty. Go to the dashboard and queue some jobs first.");
    process.exit(0);
  }

  console.log(`Found ${queue.length} job(s) in queue\n`);

  // Launch browser
  const browser = await chromium.launch({
    headless: config.headless,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  let applied = 0;
  let failed  = 0;

  for (const item of queue) {
    console.log(`\n[${applied + failed + 1}/${queue.length}] ${item.company} — ${item.job_title}`);
    console.log(`  URL: ${item.job_url}`);
    console.log(`  Score: ${item.score}`);

    // Mark as applying
    await updateStatus(item.id, "applying");

    const page = await browser.newPage();

    // Set realistic user agent
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

    const result = await applyToJob(page, jobData, config.profile, config.dryRun);
    await page.close();

    if (result.success) {
      applied++;
      const appliedAt = config.dryRun ? null : new Date().toISOString();
      await updateStatus(item.id, config.dryRun ? "queued" : "applied", {
        applied_at: appliedAt,
        error_msg: result.warning || null,
      });
      console.log(`  ✓ ${config.dryRun ? "DRY RUN complete" : "Applied!"}`);
    } else {
      failed++;
      await updateStatus(item.id, "failed", { error_msg: result.error });
      console.log(`  ✗ Failed: ${result.error}`);
    }

    // Random human-like delay between applications
    if (applied + failed < queue.length) {
      const delaySec = config.delayMin + Math.random() * (config.delayMax - config.delayMin);
      console.log(`  Waiting ${Math.round(delaySec)}s before next application...`);
      await sleep(delaySec * 1000);
    }
  }

  await browser.close();

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Done! Applied: ${applied}  Failed: ${failed}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

main().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
