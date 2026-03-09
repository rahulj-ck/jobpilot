// lib/scraper.js — shared scraping logic

const TECH_KEYWORDS = [
  "React","Vue","Angular","TypeScript","JavaScript","Node.js","Python","AWS","GCP","Azure",
  "GraphQL","Docker","Kubernetes","SQL","PostgreSQL","MongoDB","Redis","Next.js","Go","Rust",
  "Java","Swift","Flutter","Django","FastAPI","Git","CI/CD","Terraform","ML","Figma","C++",
];

export const GREENHOUSE_COMPANIES = [
  "anthropic","stripe","notion","figma","linear","vercel","brex","ramp","scale",
  "coinbase","robinhood","plaid","affirm","shopify","webflow","airtable","coda",
  "loom","miro","asana","datadog","confluent","hashicorp","mongodb","netlify","retool",
  "rippling","gusto","deel","lattice","cloudflare","pagerduty","benchling","carta",
];

export const LEVER_COMPANIES = [
  "netflix","uber","lyft","pinterest","reddit","discord","twilio","zendesk",
  "elastic","segment","amplitude","intercom","drift","outreach","gong",
];

export const ASHBY_COMPANIES = [
  "linear","vercel","railway","resend","posthog","raycast","retool","clerk",
  "trigger","liveblocks","dub","warp","cal","inngest","upstash",
];

export function extractTags(text = "") {
  return TECH_KEYWORDS.filter(k => text.toLowerCase().includes(k.toLowerCase())).slice(0, 5);
}

export function cleanHtml(html = "") {
  return (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
}

export function timeAgo(dateStr) {
  if (!dateStr) return "recently";
  try {
    const val = typeof dateStr === "number" ? dateStr : Date.parse(dateStr);
    const h = Math.floor((Date.now() - val) / 3600000);
    if (h < 1) return "just now";
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  } catch { return "recently"; }
}

export function titleCase(str) {
  return (str || "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

export async function fetchGreenhouse() {
  const jobs = [];
  await Promise.all(GREENHOUSE_COMPANIES.map(async company => {
    try {
      const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${company}/jobs?content=true`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return;
      const data = await res.json();
      for (const j of data.jobs || []) {
        const desc = cleanHtml(j.content || "");
        jobs.push({
          id: `gh-${j.id}`,
          title: j.title,
          company: titleCase(company),
          location: j.location?.name || "Not specified",
          tags: extractTags(desc + " " + j.title),
          posted_at: j.updated_at || new Date().toISOString(),
          url: j.absolute_url,
          description: desc,
          source: "Greenhouse",
          logo: company[0].toUpperCase(),
          scraped_at: new Date().toISOString(),
        });
      }
    } catch {}
  }));
  return jobs;
}

export async function fetchLever() {
  const jobs = [];
  await Promise.all(LEVER_COMPANIES.map(async company => {
    try {
      const res = await fetch(`https://api.lever.co/v0/postings/${company}?mode=json`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return;
      const data = await res.json();
      for (const j of data) {
        const desc = (j.descriptionPlain || "").slice(0, 500);
        jobs.push({
          id: `lv-${j.id}`,
          title: j.text,
          company: titleCase(company),
          location: j.categories?.location || "Not specified",
          tags: extractTags(desc + " " + j.text),
          posted_at: j.createdAt ? new Date(j.createdAt).toISOString() : new Date().toISOString(),
          url: j.hostedUrl,
          description: desc,
          source: "Lever",
          logo: company[0].toUpperCase(),
          scraped_at: new Date().toISOString(),
        });
      }
    } catch {}
  }));
  return jobs;
}

export async function fetchAshby() {
  const jobs = [];
  await Promise.all(ASHBY_COMPANIES.map(async company => {
    try {
      const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${company}`, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return;
      const data = await res.json();
      for (const j of data.jobs || []) {
        const desc = cleanHtml(j.descriptionHtml || "");
        jobs.push({
          id: `ash-${j.id}`,
          title: j.title,
          company: j.companyName || titleCase(company),
          location: j.location || "Remote",
          tags: extractTags(desc + " " + j.title),
          posted_at: j.publishedDate || new Date().toISOString(),
          url: j.jobUrl,
          description: desc,
          source: "Ashby",
          logo: company[0].toUpperCase(),
          scraped_at: new Date().toISOString(),
        });
      }
    } catch {}
  }));
  return jobs;
}

export async function scrapeAll() {
  console.log("[scraper] Starting full scrape...");
  const [gh, lv, ash] = await Promise.all([fetchGreenhouse(), fetchLever(), fetchAshby()]);
  const seen = new Set();
  const all = [...gh, ...lv, ...ash].filter(j => {
    const key = `${j.title?.toLowerCase()}|${j.company?.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  console.log(`[scraper] Done: ${gh.length} Greenhouse, ${lv.length} Lever, ${ash.length} Ashby = ${all.length} total`);
  return { jobs: all, counts: { Greenhouse: gh.length, Lever: lv.length, Ashby: ash.length } };
}
