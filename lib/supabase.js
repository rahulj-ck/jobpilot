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
    const q = query.trim();
    // Use individual ilike filters with proper encoding instead of or()
    const encoded = encodeURIComponent(`%${q}%`);
    path += `&or=(title.ilike.${encoded},company.ilike.${encoded})`;
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

// ── User Profile (per-user, requires auth token) ──────────────────────────────

export async function getProfile(userId, token) {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/user_profiles?user_id=eq.${userId}&select=*&limit=1`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
        },
      }
    );
    const rows = await res.json();
    return rows?.[0] || null;
  } catch { return null; }
}

export async function saveProfile(userId, profile, token) {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Try update first, then insert if not exists
  const updateRes = await fetch(
    `${SUPABASE_URL}/rest/v1/user_profiles?user_id=eq.${userId}`,
    {
      method: "PATCH",
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({ ...profile, updated_at: new Date().toISOString() }),
    }
  );
  // If no row existed (0 rows updated), insert instead
  const count = updateRes.headers.get("content-range");
  if (count === "*" || count === null) {
    await fetch(`${SUPABASE_URL}/rest/v1/user_profiles`, {
      method: "POST",
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({ user_id: userId, ...profile, updated_at: new Date().toISOString() }),
    });
  }
}
