import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { signIn, signUp, saveSession, loadSession } from "../lib/auth";

const accent = "#7c6af7";
const bg = "#0a0a0f";
const surface = "#111118";
const border = "#ffffff0f";
const text = "#e8e8f0";
const muted = "#6b6b80";

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const session = loadSession();
    if (session?.access_token) router.replace("/");
  }, []);

  async function handleSubmit() {
    if (!email || !password) { setError("Email and password required"); return; }
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      if (mode === "signup") {
        const data = await signUp(email, password);
        if (data.access_token) {
          saveSession(data);
          router.replace("/");
        } else {
          setSuccess("Check your email to confirm your account, then log in.");
        }
      } else {
        const data = await signIn(email, password);
        saveSession(data);
        router.replace("/");
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  const inputStyle = {
    width: "100%", padding: "12px 16px", background: "#ffffff08",
    border: `1px solid ${border}`, borderRadius: 10, color: text,
    fontSize: 14, fontFamily: "DM Sans, sans-serif", outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "DM Sans, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        input::placeholder { color: ${muted}; }
        input:focus { border-color: ${accent} !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ width: "100%", maxWidth: 420, padding: 24 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: text, letterSpacing: -1 }}>
            Job<span style={{ color: accent }}>Pilot</span>
          </div>
          <div style={{ color: muted, fontSize: 13, marginTop: 6 }}>AI-powered job application automation</div>
        </div>

        {/* Card */}
        <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 20, padding: 32 }}>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, background: "#ffffff06", borderRadius: 10, padding: 4, marginBottom: 28 }}>
            {["login", "signup"].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(""); setSuccess(""); }}
                style={{
                  flex: 1, padding: "8px", borderRadius: 8, border: "none", cursor: "pointer",
                  fontFamily: "inherit", fontWeight: 600, fontSize: 13,
                  background: mode === m ? accent : "transparent",
                  color: mode === m ? "#fff" : muted,
                  transition: "all 0.15s",
                }}>
                {m === "login" ? "Log In" : "Sign Up"}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ color: muted, fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>EMAIL</label>
              <input
                type="email" placeholder="you@example.com"
                value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ color: muted, fontSize: 12, fontWeight: 600, display: "block", marginBottom: 6 }}>PASSWORD</label>
              <input
                type="password" placeholder="••••••••"
                value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSubmit()}
                style={inputStyle}
              />
            </div>

            {error && (
              <div style={{ background: "#ef444418", border: "1px solid #ef444433", borderRadius: 8, padding: "10px 14px", color: "#ef4444", fontSize: 13 }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{ background: "#22c55e18", border: "1px solid #22c55e33", borderRadius: 8, padding: "10px 14px", color: "#22c55e", fontSize: 13 }}>
                {success}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                width: "100%", padding: "13px", background: accent, color: "#fff",
                border: "none", borderRadius: 10, fontFamily: "inherit",
                fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.7 : 1, marginTop: 4,
                boxShadow: `0 0 24px ${accent}40`,
              }}>
              {loading
                ? "Please wait…"
                : mode === "login" ? "Log In →" : "Create Account →"}
            </button>
          </div>
        </div>

        <div style={{ textAlign: "center", color: muted, fontSize: 12, marginTop: 20 }}>
          Your data is private and only visible to you.
        </div>
      </div>
    </div>
  );
}
