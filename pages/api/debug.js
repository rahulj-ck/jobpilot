// pages/api/debug.js — temporary debug endpoint, delete after fixing
export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  const envCheck = {
    SUPABASE_URL: SUPABASE_URL ? `${SUPABASE_URL.slice(0, 30)}...` : "MISSING",
    SUPABASE_ANON_KEY: SUPABASE_ANON_KEY ? `${SUPABASE_ANON_KEY.slice(0, 20)}...` : "MISSING",
    SUPABASE_SERVICE_KEY: SUPABASE_SERVICE_KEY ? `${SUPABASE_SERVICE_KEY.slice(0, 20)}...` : "MISSING",
  };

  // Try a direct Supabase query
  let queryResult = null;
  let queryError = null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/jobs?select=id&limit=3`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    const text = await r.text();
    queryResult = { status: r.status, body: text.slice(0, 300) };
  } catch (e) {
    queryError = e.message;
  }

  res.status(200).json({ envCheck, queryResult, queryError });
}
