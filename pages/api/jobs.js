// pages/api/jobs.js — server-side job fetcher, no CORS issues

const LOGO_COLORS = ["#7c6af7","#22c55e","#3b82f6","#f59e0b","#ef4444","#06b6d4","#ec4899","#84cc16","#f97316","#a855f7"];

function jobColor(company = "") {
  let h = 0;
  for (let i = 0; i < company.length; i++) h = (h * 31 + company.charCodeAt(i)) % LOGO_COLORS.length;
  return LOGO_COLORS[h];
}

function timeAgo(dateStr) {
  if (!dateStr) return "recently";
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const TECH_KEYWORDS = [
  "React","Vue","Angular","TypeScript","JavaScript","Node.js","Python","AWS","GCP","Azure",
  "GraphQL","REST","Docker","Kubernetes","SQL","PostgreSQL","MongoDB","Redis","Next.js",
  "Rails","Go","Rust","Java","Kotlin","Swift","Flutter","Django","FastAPI","CSS","Git","CI/CD"
];

function extractTags(text = "") {
  return TECH_KEYWORDS.filter(k => text.toLowerCase().includes(k.toLowerCase())).slice(0, 5);
}

async function fetchRemotive(query) {
  try {
    const res = await fetch(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(query)}&limit=20`, { next: { revalidate: 300 } });
    const data = await res.json();
    return (data.jobs || []).map(j => ({
      id: `remotive-${j.id}`,
      title: j.title,
      company: j.company_name || "Unknown",
      location: j.candidate_required_location || "Remote",
      salary: j.salary || null,
      type: j.job_type || "Full-time",
      tags: extractTags((j.description || "") + " " + (j.tags || "")),
      posted: timeAgo(j.publication_date),
      logo: (j.company_name || "?")[0].toUpperCase(),
      color: jobColor(j.company_name),
      url: j.url,
      description: (j.description || "").replace(/<[^>]+>/g, "").slice(0, 400),
      source: "Remotive",
    }));
  } catch (e) {
    console.error("Remotive error:", e.message);
    return [];
  }
}

async function fetchTheMuse(query) {
  try {
    const res = await fetch(`https://www.themuse.com/api/public/jobs?descending=true&page=1&per_page=20&query=${encodeURIComponent(query)}`);
    const data = await res.json();
    return (data.results || []).map(j => ({
      id: `muse-${j.id}`,
      title: j.name,
      company: j.company?.name || "Unknown",
      location: j.locations?.map(l => l.name).join(", ") || "Not specified",
      salary: null,
      type: j.type || "Full-time",
      tags: extractTags((j.contents || "") + " " + (j.name || "")),
      posted: timeAgo(j.publication_date),
      logo: (j.company?.name || "?")[0].toUpperCase(),
      color: jobColor(j.company?.name || ""),
      url: j.refs?.landing_page,
      description: (j.contents || "").replace(/<[^>]+>/g, "").slice(0, 400),
      source: "The Muse",
    }));
  } catch (e) {
    console.error("The Muse error:", e.message);
    return [];
  }
}

async function fetchAdzuna(query) {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return [];
  try {
    const res = await fetch(
      `https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=20&what=${encodeURIComponent(query)}&content-type=application/json`
    );
    const data = await res.json();
    return (data.results || []).map(j => ({
      id: `adzuna-${j.id}`,
      title: j.title,
      company: j.company?.display_name || "Unknown",
      location: j.location?.display_name || "Not specified",
      salary: j.salary_min ? `$${Math.round(j.salary_min / 1000)}k–$${Math.round((j.salary_max || j.salary_min * 1.3) / 1000)}k` : null,
      type: j.contract_time === "full_time" ? "Full-time" : j.contract_time || "Full-time",
      tags: extractTags((j.description || "") + " " + j.title),
      posted: timeAgo(j.created),
      logo: (j.company?.display_name || "?")[0].toUpperCase(),
      color: jobColor(j.company?.display_name || ""),
      url: j.redirect_url,
      description: (j.description || "").slice(0, 400),
      source: "Adzuna",
    }));
  } catch (e) {
    console.error("Adzuna error:", e.message);
    return [];
  }
}

export default async function handler(req, res) {
  const { query = "software engineer" } = req.query;

  const [remotive, muse, adzuna] = await Promise.all([
    fetchRemotive(query),
    fetchTheMuse(query),
    fetchAdzuna(query),
  ]);

  // Merge & deduplicate
  const seen = new Set();
  const all = [...remotive, ...muse, ...adzuna].filter(j => {
    const key = `${j.title.toLowerCase()}|${j.company.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  res.status(200).json({ jobs: all, counts: { remotive: remotive.length, muse: muse.length, adzuna: adzuna.length } });
}
