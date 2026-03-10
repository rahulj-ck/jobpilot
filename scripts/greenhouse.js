// scripts/greenhouse.js — fills and submits Greenhouse application forms

const { answerQuestion } = require("./claude");

// Known standard field mappings (Greenhouse field name → profile value)
function getStandardValue(fieldName, profile) {
  const n = fieldName.toLowerCase();
  if (n.includes("first") && n.includes("name"))  return profile.firstName;
  if (n.includes("last")  && n.includes("name"))  return profile.lastName;
  if (n.includes("email"))                         return profile.email;
  if (n.includes("phone"))                         return profile.phone;
  if (n.includes("linkedin"))                      return profile.linkedin;
  if (n.includes("website") || n.includes("portfolio")) return profile.linkedin; // fallback
  if (n.includes("salary") && n.includes("min"))  return profile.salaryMin;
  if (n.includes("salary") && n.includes("max"))  return profile.salaryMax;
  if (n.includes("salary") && n.includes("expect")) return profile.salaryMin;
  return null;
}

// Work auth dropdown options commonly seen on Greenhouse
function getWorkAuthAnswer(optionText, profile) {
  const t = optionText.toLowerCase();
  if (profile.workAuth === "yes") {
    if (t.includes("authorized") || t.includes("citizen") || t.includes("yes")) return true;
  }
  if (profile.workAuth === "visa") {
    if (t.includes("visa") || t.includes("authorized")) return true;
  }
  if (profile.needSponsorship === "no") {
    if (t.includes("no") && t.includes("sponsor")) return true;
  }
  if (profile.needSponsorship === "yes") {
    if (t.includes("yes") && t.includes("sponsor")) return true;
  }
  return false;
}

async function applyToJob(page, job, profile, dryRun = false) {
  const log = (msg) => console.log(`  [${job.company}] ${msg}`);

  try {
    // Navigate to the application form
    const appUrl = job.url.includes("#app") ? job.url : job.url + "#app";
    log(`Opening ${appUrl}`);
    await page.goto(appUrl, { waitUntil: "networkidle", timeout: 30000 });

    // Wait for the form to appear
    await page.waitForSelector("form", { timeout: 15000 });
    log("Form loaded");

    // ── 1. Fill standard text/email/tel inputs ────────────────────────────────
    const inputs = await page.$$("input[type=text], input[type=email], input[type=tel], input[type=url]");
    for (const input of inputs) {
      const name  = await input.getAttribute("name")  || "";
      const id    = await input.getAttribute("id")    || "";
      const label = await getLabel(page, input);
      const key   = `${name} ${id} ${label}`.toLowerCase();

      const value = getStandardValue(key, profile);
      if (value) {
        await input.fill(String(value));
        log(`Filled: ${label || name} = ${String(value).slice(0, 30)}`);
      }
    }

    // ── 2. Cover letter / text areas ─────────────────────────────────────────
    const textareas = await page.$$("textarea");
    for (const ta of textareas) {
      const label = await getLabel(page, ta);
      const key   = label.toLowerCase();

      if (key.includes("cover") || key.includes("letter") || key.includes("message")) {
        if (job.coverLetter) {
          await ta.fill(job.coverLetter);
          log(`Filled cover letter (${job.coverLetter.length} chars)`);
        }
      } else if (key.includes("summary") || key.includes("bio") || key.includes("about")) {
        await ta.fill(profile.bio);
        log(`Filled bio textarea`);
      } else {
        // Custom open text question — ask Claude
        if (label.length > 5) {
          log(`Custom textarea: "${label}" — asking Claude...`);
          const answer = await answerQuestion(label, null, job, profile);
          await ta.fill(answer);
          log(`Answered: "${answer.slice(0, 60)}..."`);
        }
      }
    }

    // ── 3. Resume upload ──────────────────────────────────────────────────────
    const fileInput = await page.$("input[type=file]");
    if (fileInput && profile.resumePath) {
      await fileInput.setInputFiles(profile.resumePath);
      log(`Uploaded resume: ${profile.resumePath}`);
      // Wait a moment for upload to process
      await page.waitForTimeout(2000);
    }

    // ── 4. Select/dropdown fields ─────────────────────────────────────────────
    const selects = await page.$$("select");
    for (const sel of selects) {
      const label   = await getLabel(page, sel);
      const options = await sel.$$eval("option", opts => opts.map(o => o.textContent.trim()));
      const key     = label.toLowerCase();

      if (key.includes("authorized") || key.includes("work auth") || key.includes("eligible")) {
        // Find the best matching option
        for (let i = 0; i < options.length; i++) {
          if (getWorkAuthAnswer(options[i], profile)) {
            await sel.selectOption({ index: i });
            log(`Work auth: selected "${options[i]}"`);
            break;
          }
        }
      } else if (key.includes("sponsor")) {
        const target = profile.needSponsorship === "yes" ? "yes" : "no";
        for (let i = 0; i < options.length; i++) {
          if (options[i].toLowerCase().includes(target)) {
            await sel.selectOption({ index: i });
            log(`Sponsorship: selected "${options[i]}"`);
            break;
          }
        }
      } else if (options.length > 1 && label.length > 3) {
        // Unknown dropdown — ask Claude (skip first empty option)
        const nonEmpty = options.filter(o => o.trim());
        if (nonEmpty.length > 0) {
          log(`Custom dropdown: "${label}" — asking Claude...`);
          const idx = await answerQuestion(label, nonEmpty, job, profile);
          const realIdx = options.indexOf(nonEmpty[idx]);
          if (realIdx >= 0) {
            await sel.selectOption({ index: realIdx });
            log(`Selected option ${idx}: "${nonEmpty[idx]}"`);
          }
        }
      }
    }

    // ── 5. Radio buttons ──────────────────────────────────────────────────────
    const radioGroups = {};
    const radios = await page.$$("input[type=radio]");
    for (const radio of radios) {
      const name = await radio.getAttribute("name") || "unknown";
      if (!radioGroups[name]) radioGroups[name] = [];
      radioGroups[name].push(radio);
    }

    for (const [groupName, radioList] of Object.entries(radioGroups)) {
      const label = await getLabel(page, radioList[0]);
      const options = [];
      for (const r of radioList) {
        const rLabel = await getLabel(page, r);
        options.push(rLabel || await r.getAttribute("value") || "");
      }

      if (groupName.toLowerCase().includes("authorized") || label.toLowerCase().includes("authorized")) {
        // Pick authorized option
        for (let i = 0; i < radioList.length; i++) {
          if (getWorkAuthAnswer(options[i], profile)) {
            await radioList[i].check();
            log(`Radio work auth: "${options[i]}"`);
            break;
          }
        }
      } else if (options.length > 0 && label.length > 3) {
        log(`Custom radio "${label}" — asking Claude...`);
        const idx = await answerQuestion(label, options, job, profile);
        await radioList[Math.min(idx, radioList.length - 1)].check();
        log(`Radio selected: "${options[idx]}"`);
      }
    }

    // ── 6. Submit ─────────────────────────────────────────────────────────────
    if (dryRun) {
      log("DRY RUN — skipping submit");
      return { success: true, dryRun: true };
    }

    const submitBtn = await page.$("button[type=submit], input[type=submit]");
    if (!submitBtn) {
      return { success: false, error: "Could not find submit button" };
    }

    await submitBtn.click();
    log("Clicked submit");

    // Wait for confirmation
    try {
      await page.waitForSelector(
        "[class*=confirmation], [class*=success], [class*=thank], h1:has-text('Thank'), h2:has-text('Thank'), p:has-text('application')",
        { timeout: 10000 }
      );
      log("✓ Application submitted successfully!");
      return { success: true };
    } catch {
      // Check URL changed (some redirect on success)
      const url = page.url();
      if (url.includes("confirmation") || url.includes("thank") || url.includes("success")) {
        log("✓ Redirected to confirmation page");
        return { success: true };
      }
      // Might still have succeeded, just no clear confirmation
      log("⚠ Submitted but confirmation unclear");
      return { success: true, warning: "No confirmation detected" };
    }

  } catch (e) {
    console.error(`  [${job.company}] Error:`, e.message);
    return { success: false, error: e.message };
  }
}

// Helper: get visible label text for a form element
async function getLabel(page, element) {
  try {
    const id = await element.getAttribute("id");
    if (id) {
      const labelEl = await page.$(`label[for="${id}"]`);
      if (labelEl) return (await labelEl.textContent()).trim();
    }
    // Try aria-label
    const aria = await element.getAttribute("aria-label");
    if (aria) return aria.trim();
    // Try placeholder
    const ph = await element.getAttribute("placeholder");
    if (ph) return ph.trim();
    // Try closest label parent
    const parentLabel = await element.evaluate(el => {
      const label = el.closest("label");
      return label ? label.textContent.trim() : "";
    });
    return parentLabel;
  } catch {
    return "";
  }
}

module.exports = { applyToJob };
