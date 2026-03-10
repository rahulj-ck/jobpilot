// lib/auth.js — Supabase browser-side auth client

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function authRequest(path, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Auth error");
  return data;
}

export async function signUp(email, password) {
  return authRequest("/signup", { email, password });
}

export async function signIn(email, password) {
  return authRequest("/token?grant_type=password", { email, password });
}

export async function signOut(accessToken) {
  await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: "POST",
    headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${accessToken}` },
  });
}

export async function getUser(accessToken) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json();
}

// Session stored in localStorage
export function saveSession(session) {
  if (typeof window === "undefined") return;
  localStorage.setItem("jp_session", JSON.stringify(session));
}

export function loadSession() {
  if (typeof window === "undefined") return null;
  try {
    const s = localStorage.getItem("jp_session");
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("jp_session");
}
