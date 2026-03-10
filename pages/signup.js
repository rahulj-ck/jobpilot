import { useState, useRef } from "react";
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

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return typeof btoa !== "undefined" ? btoa(binary) : Buffer.from(binary).toString("base64");
}

export default function SignUp() {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resumeFile, setResumeFile] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (!resumeFile) {
      setError("Please upload your resume (PDF)");
      return;
    }
    if (resumeFile.type !== "application/pdf" && !resumeFile.name.toLowerCase().endsWith(".pdf")) {
      setError("Resume must be a PDF file");
      return;
    }
    if (!supabase) {
      setError("Auth is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      return;
    }
    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) throw signUpError;
      if (!data?.user) throw new Error("Sign up failed");

      const arrayBuffer = await resumeFile.arrayBuffer();
      const pdfBase64 = arrayBufferToBase64(arrayBuffer);
      const parseRes = await fetch("/api/parse-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfBase64 }),
      });
      const parseData = await parseRes.json();
      if (!parseRes.ok) throw new Error(parseData.error || "Failed to read resume");
      const profile = parseData.profile || {};

      const row = {
        id: data.user.id,
        name: profile.name || "",
        title: profile.title || "",
        skills: profile.skills || "",
        experience: profile.experience || "",
        location: profile.location || "",
        salary_min: Number(profile.salaryMin) || 0,
        salary_max: Number(profile.salaryMax) || 0,
        bio: profile.bio || "",
        updated_at: new Date().toISOString(),
      };
      const { error: profileError } = await supabase.from("profiles").upsert(row, { onConflict: "id" });
      if (profileError) throw profileError;
      router.replace("/");
    } catch (err) {
      setError(err.message || "Sign up failed");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = { width: "100%", background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 14px", color: text, fontFamily: "inherit", fontSize: 13, outline: "none" };
  const labelStyle = { display: "block", fontSize: 12, color: muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" };

  return (
    <div style={{ minHeight: "100vh", background: bg, color: text, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>⚡</div>
            <span style={{ fontWeight: 700, fontSize: 22 }}>JobPilot</span>
          </div>
          <p style={{ color: muted, fontSize: 14 }}>Create an account and upload your resume so we can tailor jobs for you</p>
        </div>
        <form onSubmit={handleSubmit} style={card}>
          <h2 style={{ fontSize: 14, color: muted, fontWeight: 600, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.04em" }}>Account</h2>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="At least 6 characters" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Confirm password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="Same as above" style={inputStyle} />
          </div>

          <h2 style={{ fontSize: 14, color: muted, fontWeight: 600, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.04em" }}>Resume</h2>
          <p style={{ fontSize: 12, color: muted, marginBottom: 12 }}>Upload your resume (PDF). We’ll read it to tailor job matches.</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={e => setResumeFile(e.target.files?.[0] || null)}
            style={{ display: "none" }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{ ...btn(), width: "100%", padding: "16px", marginBottom: 8, border: `2px dashed ${resumeFile ? accent : border}`, background: resumeFile ? accent + "18" : "transparent" }}
          >
            {resumeFile ? resumeFile.name : "Choose PDF…"}
          </button>
          {resumeFile && <div style={{ fontSize: 11, color: muted }}>Click to change file</div>}

          {error && <div style={{ color: "#ef4444", fontSize: 13, marginTop: 16, marginBottom: 0 }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ ...btn("primary"), width: "100%", padding: "12px", fontSize: 14, marginTop: 24 }}>
            {loading ? "Creating account & reading resume…" : "Sign up"}
          </button>
        </form>
        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: muted }}>
          Already have an account? <Link href="/signin" style={{ color: accent, fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
