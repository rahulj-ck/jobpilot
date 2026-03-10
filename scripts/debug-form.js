// scripts/debug-form.js — inspect a Greenhouse form to see actual element classes
// Usage: node scripts/debug-form.js https://job-boards.greenhouse.io/cloudflare/jobs/123456

const { chromium } = require("playwright");

async function main() {
  const url = process.argv[2];
  if (!url) { console.log("Usage: node scripts/debug-form.js <greenhouse-url>"); process.exit(1); }

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(url + "#app", { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForSelector("form", { timeout: 15000 });

  console.log("\n=== INPUTS ===");
  const inputs = await page.$$eval("input", els => els.map(e => ({
    type: e.type, name: e.name, id: e.id, placeholder: e.placeholder, class: e.className.slice(0,80)
  })));
  inputs.forEach(i => console.log(i));

  console.log("\n=== SELECTS (native) ===");
  const selects = await page.$$eval("select", els => els.map(e => ({
    name: e.name, id: e.id, class: e.className.slice(0,80),
    options: Array.from(e.options).map(o => o.text).slice(0,5)
  })));
  selects.forEach(s => console.log(s));

  console.log("\n=== CUSTOM DROPDOWNS (divs/buttons that look like selects) ===");
  const divDropdowns = await page.$$eval(
    "div[class*='select'], button[class*='select'], div[role='combobox'], div[role='listbox'], div[class*='Select'], div[class*='dropdown']",
    els => els.slice(0,20).map(e => ({ tag: e.tagName, role: e.getAttribute('role'), class: e.className.slice(0,100), text: e.textContent.trim().slice(0,50) }))
  );
  divDropdowns.forEach(d => console.log(d));

  console.log("\n=== CHECKBOXES ===");
  const cbs = await page.$$eval("input[type=checkbox]", els => els.map(e => ({ id: e.id, name: e.name, class: e.className.slice(0,80) })));
  cbs.forEach(c => console.log(c));

  console.log("\nBrowser staying open — inspect the form manually. Ctrl+C to exit.");
  await new Promise(() => {}); // keep open
}

main().catch(console.error);
