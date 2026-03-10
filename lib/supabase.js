// lib/supabase.js — lightweight Supabase client (no SDK needed)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // for writes (cron)
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;       // for reads (frontend)

async function supabaseRequest(path, options = {}, useServiceKey = false) {
  const key = useServiceKey ? SUPABASE_SERVICE_KEY : SUPABASE_ANON_KEY;
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      "apikey": key,
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
      "Prefer": options.prefer || "return=minimal",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error ${res.status}: ${err}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Upsert jobs in batches (service key required)
export async function upsertJobs(jobs) {
  const BATCH = 100;
  let total = 0;
  for (let i = 0; i < jobs.length; i += BATCH) {
    const batch = jobs.slice(i, i + BATCH);
    await supabaseRequest("/jobs", {
      method: "POST",
      prefer: "resolution=merge-duplicates",
      body: JSON.stringify(batch),
    }, true);
    total += batch.length;
  }
  return total;
}

// Read jobs with optional search (anon key)
export async function queryJobs(query = "", limit = 200) {
  let path = `/jobs?select=*&order=scraped_at.desc&limit=${limit}`;
  if (query.trim()) {
    const t = `%${query.trim()}%`;
    // PostgREST: values with % or special chars must be in double quotes (see url_grammar)
    const encoded = "%22" + encodeURIComponent(t).replace(/%22/g, "%5C%22") + "%22";
    path += `&or=(title.ilike.${encoded},company.ilike.${encoded},description.ilike.${encoded})`;
  }
  return supabaseRequest(path, { method: "GET", prefer: "" }, false);
}

// Get last scrape time
export async function getLastScrape() {
  try {
    const rows = await supabaseRequest(
      "/jobs?select=scraped_at&order=scraped_at.desc&limit=1",
      { method: "GET", prefer: "" }, false
    );
    return rows?.[0]?.scraped_at || null;
  } catch { return null; }
}
