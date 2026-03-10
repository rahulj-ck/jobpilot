import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

const accent = "#7c6af7";
const accentGlow = "#7c6af740";
const bg = "#0a0a0f";
const surface = "#111118";
const border = "#ffffff0f";
const text = "#e8e8f0";
const muted = "#6b6b80";

const card = { background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: 24 };

function btn(variant = "primary") {
  const base = { padding: "8px 16px", borderRadius: 10, fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", transition: "all 0.15s", display: "inline-block", textAlign: "center" };
  if (variant === "primary") return { ...base, background: accent, color: "#fff", boxShadow: `0 0 20px ${accentGlow}` };
  return { ...base, background: "#ffffff08", color: text, border: `1px solid ${border}` };
}

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!supabase) {
      setError("Auth is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      router.replace("/");
    } catch (err) {
      setError(err.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = { width: "100%", background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 14px", color: text, fontFamily: "inherit", fontSize: 13, outline: "none" };
  const labelStyle = { display: "block", fontSize: 12, color: muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" };

  return (
    <div style={{ minHeight: "100vh", background: bg, color: text, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>⚡</div>
            <span style={{ fontWeight: 700, fontSize: 22 }}>JobPilot</span>
          </div>
          <p style={{ color: muted, fontSize: 14 }}>Sign in to your account</p>
        </div>
        <form onSubmit={handleSubmit} style={card}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={inputStyle} />
          </div>
          {error && <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 16 }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ ...btn("primary"), width: "100%", padding: "12px", fontSize: 14 }}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: muted }}>
          Don&apos;t have an account? <Link href="/signup" style={{ color: accent, fontWeight: 600 }}>Sign up</Link>
        </p>
      </div>
    </div>
  );
}
