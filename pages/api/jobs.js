// pages/api/jobs.js — server-side scraper, calls Greenhouse/Lever/Ashby directly

const TECH_KEYWORDS = [
  "React","Vue","Angular","TypeScript","JavaScript","Node.js","Python","AWS","GCP","Azure",
  "GraphQL","Docker","Kubernetes","SQL","PostgreSQL","MongoDB","Redis","Next.js","Go","Rust",
  "Java","Swift","Flutter","Django","FastAPI","Git","CI/CD","Terraform","ML","Figma","C++",
];

const GREENHOUSE_COMPANIES = [
  "anthropic","stripe","notion","figma","linear","vercel","brex","ramp","scale",
  "coinbase","robinhood","plaid","affirm","shopify","webflow","airtable","coda",
  "loom","miro","asana","datadog","confluent","hashicorp","mongodb","netlify","retool",
];

const LEVER_COMPANIES = [
  "netflix","uber","lyft","pinterest","reddit","discord","twilio","zendesk",
  "carta","rippling","gusto","deel","lattice","cloudflare","elastic","pagerduty",
];

const ASHBY_COMPANIES = [
  "linear","vercel","railway","resend","posthog","raycast","retool","clerk",
  "trigger","liveblocks","dub","warp",
];

function extractTags(text = "") {
  return TECH_KEYWORDS.filter(k => text.toLowerCase().includes(k.toLowerCase())).slice(0, 5);
}
function cleanHtml(html = "") {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400);
}
function timeAgo(dateStr) {
  if (!dateStr) return "recently";
  try {
    const val = typeof dateStr === "number" ? dateStr : Date.parse(dateStr);
    const h = Math.floor((Date.now() - val) / 3600000);
    if (h < 1) return "just now";
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  } catch { return "recently"; }
}
function titleCase(str) {
  return str.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

async function fetchGreenhouse(query) {
  const jobs = [], q = query.toLowerCase();
  await Promise.all(GREENHOUSE_COMPANIES.map(async company => {
    try {
      const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${company}/jobs?content=true`);
      if (!res.ok) return;
      const data = await res.json();
      for (const j of data.jobs || []) {
        if (!j.title.toLowerCase().includes(q)) continue;
        jobs.push({
          id: `gh-${j.id}`, title: j.title, company: titleCase(company),
          location: j.location?.name || "Not specified",
          tags: extractTags(cleanHtml(j.content || "") + " " + j.title),
          posted: timeAgo(j.updated_at), url: j.absolute_url,
          description: cleanHtml(j.content || ""),
          source: "Greenhouse", logo: company[0].toUpperCase(),
        });
      }
    } catch {}
  }));
  return jobs;
}

async function fetchLever(query) {
  const jobs = [], q = query.toLowerCase();
  await Promise.all(LEVER_COMPANIES.map(async company => {
    try {
      const res = await fetch(`https://api.lever.co/v0/postings/${company}?mode=json`);
      if (!res.ok) return;
      const data = await res.json();
      for (const j of data) {
        if (!j.text?.toLowerCase().includes(q)) continue;
        jobs.push({
          id: `lv-${j.id}`, title: j.text, company: titleCase(company),
          location: j.categories?.location || "Not specified",
          tags: extractTags((j.descriptionPlain || "") + " " + j.text),
          posted: timeAgo(j.createdAt), url: j.hostedUrl,
          description: (j.descriptionPlain || "").slice(0, 400),
          source: "Lever", logo: company[0].toUpperCase(),
        });
      }
    } catch {}
  }));
  return jobs;
}

async function fetchAshby(query) {
  const jobs = [], q = query.toLowerCase();
  await Promise.all(ASHBY_COMPANIES.map(async company => {
    try {
      const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${company}`);
      if (!res.ok) return;
      const data = await res.json();
      for (const j of data.jobs || []) {
        if (!j.title?.toLowerCase().includes(q)) continue;
        jobs.push({
          id: `ash-${j.id}`, title: j.title,
          company: j.companyName || titleCase(company),
          location: j.location || "Remote",
          tags: extractTags(cleanHtml(j.descriptionHtml || "") + " " + j.title),
          posted: timeAgo(j.publishedDate), url: j.jobUrl,
          description: cleanHtml(j.descriptionHtml || ""),
          source: "Ashby", logo: company[0].toUpperCase(),
        });
      }
    } catch {}
  }));
  return jobs;
}

export default async function handler(req, res) {
  const { query = "software engineer" } = req.query;
  const [gh, lv, ash] = await Promise.all([
    fetchGreenhouse(query),
    fetchLever(query),
    fetchAshby(query),
  ]);
  const seen = new Set();
  const jobs = [...gh, ...lv, ...ash].filter(j => {
    const key = `${j.title.toLowerCase()}|${j.company.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  const counts = { Greenhouse: gh.length, Lever: lv.length, Ashby: ash.length };
  res.status(200).json({ jobs, counts });
}
