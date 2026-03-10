// scripts/greenhouse.js — fills Greenhouse application forms

const { answerQuestion } = require("./claude");

function getStandardValue(fieldId, fieldLabel, profile) {
  const id = (fieldId || "").toLowerCase();
  const n  = (fieldLabel || "").toLowerCase();

  if (id === "first_name")  return profile.firstName;
  if (id === "last_name")   return profile.lastName;
  if (id === "email")       return profile.email;
  if (id === "phone")       return profile.phone;

  if (n.includes("legal") && n.includes("name")) return `${profile.firstName} ${profile.lastName}`;
  if (n.includes("linkedin"))                    return profile.linkedin;
  if (n.includes("website") || n.includes("blog")) return profile.linkedin;
  if (n.includes("salary") && n.includes("min")) return profile.salaryMin;
  if (n.includes("salary") && n.includes("max")) return profile.salaryMax;
  if (n.includes("hear") || n.includes("source") || n.includes("referral")) return "LinkedIn";

  return null;
}

// Type into a Greenhouse React-select input and pick first matching option
async function fillSelectInput(page, inputId, searchText, log) {
  try {
    // Click the outer container to open the dropdown
    const container = await page.$(`[class*="select__container"]:has(#${inputId}), .select:has(#${inputId})`);
    if (container) await container.click();
    else {
      const input = await page.$(`#${inputId}`);
      if (!input) { log(`#${inputId} not found`); return false; }
      await input.click();
    }
    await page.waitForTimeout(400);

    // Now type into the input
    const input = await page.$(`#${inputId}`);
    await input.type(searchText, { delay: 80 });
    await page.waitForTimeout(1000);

    // Pick first matching option
    const options = await page.$$(".select__option");
    for (const opt of options) {
      const text = (await opt.textContent()).trim();
      if (text.toLowerCase().includes(searchText.toLowerCase())) {
        await opt.click();
        log(`#${inputId}: selected "${text}"`);
        await page.waitForTimeout(300);
        return true;
      }
    }

    // Pick literally any first option if no match
    if (options.length > 0) {
      const text = (await options[0].textContent()).trim();
      await options[0].click();
      log(`#${inputId}: picked first option "${text}"`);
      await page.waitForTimeout(300);
      return true;
    }

    await page.keyboard.press("Escape");
    log(`#${inputId}: no options found for "${searchText}"`);
    return false;
  } catch (e) {
    log(`#${inputId} error: ${e.message}`);
    return false;
  }
}

// Pick an option from an open dropdown by partial text match
async function pickOption(page, partialText, log) {
  const options = await page.$$(".select__option, [class*='option--']");
  for (const opt of options) {
    const text = (await opt.textContent()).trim();
    if (text.toLowerCase().includes(partialText.toLowerCase())) {
      await opt.click();
      log(`Picked option: "${text}"`);
      await page.waitForTimeout(300);
      return text;
    }
  }
  return null;
}

async function applyToJob(page, job, profile, dryRun = false) {
  const log = (msg) => console.log(`  [${job.company}] ${msg}`);

  try {
    const appUrl = job.url.includes("#app") ? job.url : job.url + "#app";
    log(`Opening ${appUrl}`);
    await page.goto(appUrl, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForSelector("form", { timeout: 15000 });
    log("Form loaded");

    // ── 1. Standard text/email/tel inputs (by id) ─────────────────────────────
    const standardIds = {
      first_name: profile.firstName,
      last_name:  profile.lastName,
      email:      profile.email,
      phone:      profile.phone,
    };
    for (const [id, value] of Object.entries(standardIds)) {
      if (!value) continue;
      const el = await page.$(`#${id}`);
      if (el && (await el.getAttribute("class") || "").includes("input")) {
        await el.fill(String(value));
        log(`Filled #${id}: "${String(value).slice(0, 40)}"`);
      }
    }

    // ── 2. Custom question inputs (question_XXXXXXX) ───────────────────────────
    const questionInputs = await page.$$("input[id^='question_']:not([type=checkbox]):not([class*='select'])");
    for (const input of questionInputs) {
      const id    = await input.getAttribute("id") || "";
      const label = await getLabel(page, input);
      const key   = label.toLowerCase();

      // Check for known patterns first
      let value = null;
      if (key.includes("linkedin"))                         value = profile.linkedin;
      if (key.includes("website") || key.includes("blog")) value = profile.linkedin;
      if (key.includes("legal") && key.includes("name"))   value = `${profile.firstName} ${profile.lastName}`;
      if (key.includes("hear") || key.includes("source"))  value = "LinkedIn";
      if (key.includes("salary"))                          value = String(profile.salaryMin);

      if (value) {
        await input.fill(value);
        log(`Filled "${label}": "${value}"`);
      } else if (label.length > 5) {
        // Unknown — ask Claude
        log(`Custom input "${label}" → asking Claude...`);
        const answer = await answerQuestion(label, null, job, profile);
        await input.fill(answer);
        log(`Answered: "${answer.slice(0, 60)}"`);
      }
    }

    // ── 3. Textareas ──────────────────────────────────────────────────────────
    const textareas = await page.$$("textarea");
    for (const ta of textareas) {
      const label = await getLabel(page, ta);
      const key   = label.toLowerCase();
      if (key.includes("cover") || key.includes("letter") || key.includes("message")) {
        if (job.coverLetter) { await ta.fill(job.coverLetter); log(`Filled cover letter`); }
      } else if (key.includes("summary") || key.includes("bio") || key.includes("about")) {
        await ta.fill(profile.bio || "");
      } else if (label.length > 5) {
        log(`Textarea "${label}" → asking Claude...`);
        const answer = await answerQuestion(label, null, job, profile);
        await ta.fill(answer);
        log(`Answered: "${answer.slice(0, 60)}"`);
      }
    }

    // ── 4. Resume & cover letter file uploads ─────────────────────────────────
    const resumeInput = await page.$("#resume");
    if (resumeInput && profile.resumePath) {
      await resumeInput.setInputFiles(profile.resumePath);
      log(`Uploaded resume`);
      await page.waitForTimeout(2000);
    }

    // ── 5. Education dropdowns (school--0, degree--0, discipline--0) ──────────
    const schoolInput = await page.$("#school--0");
    if (schoolInput) {
      // School is a search-as-you-type field — type name and pick best result
      const container = await page.$(".select:has(#school--0)");
      if (container) await container.click();
      else await schoolInput.click();
      await page.waitForTimeout(400);
      await schoolInput.type(profile.school || "University", { delay: 60 });
      await page.waitForTimeout(1000);
      const opts = await page.$$(".select__option");
      if (opts.length > 0) {
        const optTexts = [];
        for (const o of opts) optTexts.push((await o.textContent()).trim());
        const idx = await answerQuestion(
          `The candidate attended: ${profile.school || "University"}. Pick the best match.`,
          optTexts, job, profile
        );
        await opts[Math.min(idx, opts.length - 1)].click();
        log(`School: ${optTexts[Math.min(idx, opts.length - 1)]}`);
      } else {
        await page.keyboard.press("Escape");
        log("School: no results found");
      }
    }

    const degreeInput = await page.$("#degree--0");
    if (degreeInput) {
      // Open dropdown, read ALL options, ask Claude to pick — never hardcode
      const container = await page.$(".select:has(#degree--0)");
      if (container) await container.click();
      else await degreeInput.click();
      await page.waitForTimeout(500);

      const opts = await page.$$(".select__option");
      const optTexts = [];
      for (const o of opts) optTexts.push((await o.textContent()).trim());

      if (optTexts.length > 0) {
        log(`Degree options: [${optTexts.join(", ")}]`);
        const userDegree = profile.degree || "Bachelor's";
        const idx = await answerQuestion(
          `The candidate has: ${userDegree}. Pick the best matching option index.`,
          optTexts, job, profile
        );
        const chosen = Math.min(idx, optTexts.length - 1);
        log(`Degree: Claude picked index ${chosen} = "${optTexts[chosen]}"`);
        // Dropdown is already open — click directly
        await opts[chosen].click();
        await page.waitForTimeout(300);
      } else {
        await page.keyboard.press("Escape");
        log("Degree: no options found");
      }
    }

    const disciplineInput = await page.$("#discipline--0");
    if (disciplineInput) {
      const container = await page.$(".select:has(#discipline--0)");
      if (container) await container.click();
      else await disciplineInput.click();
      await page.waitForTimeout(400);
      await disciplineInput.type(profile.discipline || "Computer Science", { delay: 60 });
      await page.waitForTimeout(1000);
      const opts = await page.$$(".select__option");
      if (opts.length > 0) {
        const optTexts = [];
        for (const o of opts) optTexts.push((await o.textContent()).trim());
        const idx = await answerQuestion(
          `The candidate studied: ${profile.discipline || "Computer Science"}. Pick the best match.`,
          optTexts, job, profile
        );
        await opts[Math.min(idx, opts.length - 1)].click();
        log(`Discipline: ${optTexts[Math.min(idx, opts.length - 1)]}`);
      } else {
        await page.keyboard.press("Escape");
        log("Discipline: no results found");
      }
    }

    // ── 6. Other React-select dropdowns (country, location, question selects) ──
    const selectInputs = await page.$$("input.select__input:not([id^='school']):not([id^='degree']):not([id^='discipline'])");
    for (const input of selectInputs) {
      const id    = await input.getAttribute("id") || "";
      const label = await getLabel(page, input);
      const key   = (id + " " + label).toLowerCase();

      if (key.includes("country")) {
        await input.click();
        await input.type("United States", { delay: 60 });
        await page.waitForTimeout(800);
        await pickOption(page, "United States", log) || await pickOption(page, "US", log);
      } else if (key.includes("location") || key.includes("city")) {
        if (profile.location && profile.location !== "Remote") {
          await input.click();
          await input.type(profile.location.split(",")[0], { delay: 60 });
          await page.waitForTimeout(800);
          await pickOption(page, profile.location.split(",")[0], log);
        }
      } else if (key.includes("sponsor")) {
        const answer = profile.needSponsorship === "yes" ? "Yes" : "No";
        await input.click();
        await page.waitForTimeout(500);
        await pickOption(page, answer, log);
      } else if (key.includes("authorized") || key.includes("work auth") || key.includes("eligible")) {
        const answer = profile.workAuth === "yes" ? "Yes" : "No";
        await input.click();
        await page.waitForTimeout(500);
        await pickOption(page, answer, log);
      } else if (key.includes("gender")) {
        await input.click();
        await page.waitForTimeout(500);
        await pickOption(page, "Decline", log) || await pickOption(page, "Prefer not", log);
      } else if (key.includes("hispanic") || key.includes("ethnicity")) {
        await input.click();
        await page.waitForTimeout(500);
        await pickOption(page, "Decline", log) || await pickOption(page, "Prefer not", log);
      } else if (key.includes("veteran")) {
        await input.click();
        await page.waitForTimeout(500);
        await pickOption(page, "not a veteran", log) || await pickOption(page, "Decline", log) || await pickOption(page, "No", log);
      } else if (key.includes("disability")) {
        await input.click();
        await page.waitForTimeout(500);
        await pickOption(page, "No", log) || await pickOption(page, "Decline", log);
      } else if (id.startsWith("question_") && label.length > 3) {
        // Unknown question dropdown — open and ask Claude
        await input.click();
        await page.waitForTimeout(500);
        const optionEls = await page.$$(".select__option, [class*='option--']");
        const texts = [];
        for (const o of optionEls) texts.push((await o.textContent()).trim());
        if (texts.length > 0) {
          log(`Dropdown "${label}" (${texts.length} options) → asking Claude...`);
          const idx = await answerQuestion(label, texts, job, profile);
          const chosen = texts[Math.min(idx, texts.length - 1)];
          await pickOption(page, chosen, log);
        } else {
          await page.keyboard.press("Escape");
        }
      } else {
        await page.keyboard.press("Escape");
      }
    }

    // ── 7. Checkboxes (privacy, GDPR, acknowledgements) ───────────────────────
    const checkboxes = await page.$$("input[type=checkbox]");
    for (const cb of checkboxes) {
      const label = await getLabel(page, cb);
      const key   = label.toLowerCase();
      const isChecked = await cb.isChecked();
      if (!isChecked && (
        key.includes("privacy") || key.includes("acknowledge") ||
        key.includes("agree")   || key.includes("confirm") ||
        key.includes("consent") || key.includes("terms")
      )) {
        await cb.check();
        log(`Checked: "${label.slice(0, 70)}"`);
      }
    }

    // ── 8. Submit ─────────────────────────────────────────────────────────────
    if (dryRun) {
      log("DRY RUN — skipping submit ✓");
      return { success: true, dryRun: true };
    }

    const submitBtn = await page.$("button[type=submit], input[type=submit]");
    if (!submitBtn) return { success: false, error: "Submit button not found" };
    await submitBtn.click();
    log("Clicked submit");

    try {
      await page.waitForSelector("[class*=confirmation], [class*=success], [class*=thank]", { timeout: 10000 });
      log("✓ Submitted!");
      return { success: true };
    } catch {
      const url = page.url();
      if (url.includes("confirmation") || url.includes("thank") || url.includes("success")) {
        log("✓ Confirmed via redirect");
        return { success: true };
      }
      log("⚠ Submitted but no clear confirmation");
      return { success: true, warning: "No confirmation detected" };
    }

  } catch (e) {
    console.error(`  [${job.company}] Fatal:`, e.message);
    return { success: false, error: e.message };
  }
}

async function getLabel(page, element) {
  try {
    const id = await element.getAttribute("id");
    if (id) {
      const labelEl = await page.$(`label[for="${id}"]`);
      if (labelEl) return (await labelEl.textContent()).trim();
    }
    const aria = await element.getAttribute("aria-label");
    if (aria) return aria.trim();
    const ph = await element.getAttribute("placeholder");
    if (ph) return ph.trim();
    const parentLabel = await element.evaluate(el => {
      const label = el.closest("label");
      return label ? label.textContent.trim() : "";
    });
    if (parentLabel) return parentLabel;
    const prevLabel = await element.evaluate(el => {
      let node = el.closest(".field-wrapper, .form-field, [class*='question'], [class*='field']");
      if (node) {
        const lbl = node.querySelector("label");
        if (lbl) return lbl.textContent.trim();
      }
      return "";
    });
    return prevLabel;
  } catch { return ""; }
}

module.exports = { applyToJob };
