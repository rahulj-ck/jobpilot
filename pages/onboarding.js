import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { getValidSession } from "../lib/auth";
import { saveProfile } from "../lib/supabase";

const accent = "#7c6af7";
const bg = "#0a0a0f";
const surface = "#111118";
const border = "#ffffff0f";
const text = "#e8e8f0";
const muted = "#6b6b80";

const card = { background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: 28 };
const inputStyle = { width: "100%", background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 14px", color: text, fontFamily: "inherit", fontSize: 13, outline: "none", boxSizing: "border-box" };
const labelStyle = { display: "block", fontSize: 11, color: muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" };

function Spinner() {
  return <div style={{ width: 18, height: 18, border: `2px solid ${border}`, borderTop: `2px solid ${accent}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />;
}

export default function Onboarding() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [step, setStep] = useState(1); // 1=upload, 2=confirm
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resumeFile, setResumeFile] = useState("");
  const [profile, setProfile] = useState({
    name: "", email: "", phone: "", linkedin: "",
    title: "", skills: "", experience: "", location: "", bio: "",
    school: "", degree: "", discipline: "",
    workAuth: "yes", needSponsorship: "no",
    salaryMin: 100000, salaryMax: 200000,
    resume_url: "", resume_filename: "",
    work_history: [], education_history: [], certifications: "",
  });

  useEffect(() => {
    getValidSession().then(s => {
      if (!s?.access_token) { router.replace("/login"); return; }
      setSession(s);
      // Pre-fill email from auth
      setProfile(p => ({ ...p, email: s.user?.email || "" }));
    });
  }, []);

  async function handleResumeUpload(file) {
    if (!file) return;
    setResumeFile(file.name);
    setUploading(true);
    try {
      const base64 = await new Promise((res) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result.split(",")[1]);
        reader.readAsDataURL(file);
      });
      const resp = await fetch("/api/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
        body: JSON.stringify({ pdfBase64: base64, fileName: file.name }),
      });
      const data = await resp.json();
      if (data.parsed) {
        setProfile(p => ({
          ...p,
          ...data.parsed,
          resume_url: data.resumeUrl || "",
          resume_filename: file.name,
          work_history: data.parsed.work_history || [],
          education_history: data.parsed.education_history || [],
          certifications: Array.isArray(data.parsed.certifications) ? data.parsed.certifications.join(", ") : (data.parsed.certifications || ""),
        }));
        setStep(2);
      } else if (data.resumeUploaded) {
        setProfile(p => ({ ...p, resume_url: data.resumeUrl || "", resume_filename: file.name }));
        setStep(2);
      }
    } catch (e) {
      console.error(e);
    }
    setUploading(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveProfile(session?.user?.id, {
        name: profile.name, email: profile.email, phone: profile.phone,
        linkedin: profile.linkedin, title: profile.title, skills: profile.skills,
        experience: profile.experience, location: profile.location, bio: profile.bio,
        school: profile.school, degree: profile.degree, discipline: profile.discipline,
        work_auth: profile.workAuth, need_sponsorship: profile.needSponsorship,
        salary_min: parseInt(profile.salaryMin) || null,
        salary_max: parseInt(profile.salaryMax) || null,
        resume_url: profile.resume_url, resume_filename: profile.resume_filename,
        work_history: profile.work_history ? JSON.stringify(profile.work_history) : null,
        education_history: profile.education_history ? JSON.stringify(profile.education_history) : null,
        certifications: profile.certifications,
      }, session?.access_token);
      router.replace("/");
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: bg, color: text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:none; } } * { box-sizing: border-box; }`}</style>

      <div style={{ width: "100%", maxWidth: 620, animation: "fadeUp 0.4s ease" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚡</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, marginBottom: 8 }}>Welcome to JobPilot</h1>
          <p style={{ color: muted, margin: 0 }}>
            {step === 1 ? "Upload your resume to get started — we'll auto-fill everything" : "Confirm your details and we'll start finding you jobs"}
          </p>
        </div>

        {/* Step indicator */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 32 }}>
          {[1, 2].map(s => (
            <div key={s} style={{ width: s === step ? 32 : 8, height: 8, borderRadius: 4, background: s === step ? accent : border, transition: "all 0.3s" }} />
          ))}
        </div>

        {/* Step 1 — Upload */}
        {step === 1 && (
          <div style={card}>
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>📄 Upload your resume</h2>
            <p style={{ color: muted, fontSize: 13, marginBottom: 24 }}>PDF format · We'll extract your name, experience, education, skills and more</p>

            <label style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              border: `2px dashed ${uploading ? accent : border}`, borderRadius: 16, padding: "48px 24px",
              cursor: uploading ? "not-allowed" : "pointer", background: "#ffffff03",
              transition: "all 0.2s", gap: 12,
            }}>
              <input type="file" accept=".pdf" style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleResumeUpload(f); }} />
              {uploading ? (
                <><Spinner /><span style={{ color: muted, fontSize: 14 }}>Parsing with AI…</span></>
              ) : (
                <>
                  <span style={{ fontSize: 40 }}>📎</span>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{resumeFile || "Click to upload PDF"}</span>
                  <span style={{ color: muted, fontSize: 12 }}>or drag and drop</span>
                </>
              )}
            </label>

            <div style={{ textAlign: "center", marginTop: 20 }}>
              <button onClick={() => setStep(2)}
                style={{ background: "none", border: "none", color: muted, cursor: "pointer", fontSize: 13, textDecoration: "underline" }}>
                Skip — I'll fill in my details manually
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Confirm profile */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Basic info */}
            <div style={card}>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>👤 Basic Info</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {[["name", "Full Name"], ["title", "Job Title"]].map(([key, label]) => (
                  <div key={key}>
                    <label style={labelStyle}>{label}</label>
                    <input value={profile[key] || ""} onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))} style={inputStyle} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16 }}>
                <label style={labelStyle}>Bio / Summary</label>
                <textarea value={profile.bio || ""} rows={3} onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
                  style={{ ...inputStyle, resize: "vertical" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
                {[["location", "Location"], ["experience", "Years of Experience"]].map(([key, label]) => (
                  <div key={key}>
                    <label style={labelStyle}>{label}</label>
                    <input value={profile[key] || ""} onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))} style={inputStyle} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16 }}>
                <label style={labelStyle}>Skills (comma-separated)</label>
                <input value={profile.skills || ""} onChange={e => setProfile(p => ({ ...p, skills: e.target.value }))} style={inputStyle} />
              </div>
            </div>

            {/* Contact */}
            <div style={card}>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>📬 Contact Details</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {[["email", "Email"], ["phone", "Phone"]].map(([key, label]) => (
                  <div key={key}>
                    <label style={labelStyle}>{label}</label>
                    <input value={profile[key] || ""} onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))} style={inputStyle} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16 }}>
                <label style={labelStyle}>LinkedIn URL</label>
                <input value={profile.linkedin || ""} placeholder="https://linkedin.com/in/yourname"
                  onChange={e => setProfile(p => ({ ...p, linkedin: e.target.value }))} style={inputStyle} />
              </div>
            </div>

            {/* Education */}
            <div style={card}>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>🎓 Education</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                {[["school", "School / University"], ["degree", "Degree"], ["discipline", "Field of Study"]].map(([key, label]) => (
                  <div key={key}>
                    <label style={labelStyle}>{label}</label>
                    <input value={profile[key] || ""} onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))} style={inputStyle} />
                  </div>
                ))}
              </div>
              {profile.certifications && (
                <div style={{ marginTop: 16 }}>
                  <label style={labelStyle}>Certifications</label>
                  <input value={profile.certifications || ""} onChange={e => setProfile(p => ({ ...p, certifications: e.target.value }))} style={inputStyle} />
                </div>
              )}
            </div>

            {/* Work history preview */}
            {profile.work_history?.length > 0 && (
              <div style={card}>
                <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>💼 Work History</h2>
                {profile.work_history.map((w, i) => (
                  <div key={i} style={{ borderBottom: i < profile.work_history.length - 1 ? `1px solid ${border}` : "none", paddingBottom: 16, marginBottom: 16 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{w.title} <span style={{ color: accent }}>@ {w.company}</span></div>
                    <div style={{ color: muted, fontSize: 12, marginBottom: 6 }}>{w.start} — {w.end}</div>
                    <div style={{ color: "#9999b0", fontSize: 12 }}>{w.description}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Auto-apply settings */}
            <div style={card}>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>⚡ Auto-Apply Settings</h2>
              <p style={{ color: muted, fontSize: 12, marginBottom: 20 }}>Used when the worker applies to jobs on your behalf</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                <div>
                  <label style={labelStyle}>Work Auth (US)</label>
                  <select value={profile.workAuth} onChange={e => setProfile(p => ({ ...p, workAuth: e.target.value }))} style={{ ...inputStyle }}>
                    <option value="yes">Yes — authorized</option>
                    <option value="no">No</option>
                    <option value="visa">Yes — on visa</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Need Sponsorship</label>
                  <select value={profile.needSponsorship} onChange={e => setProfile(p => ({ ...p, needSponsorship: e.target.value }))} style={{ ...inputStyle }}>
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Min Salary ($)</label>
                  <input type="number" value={profile.salaryMin} onChange={e => setProfile(p => ({ ...p, salaryMin: +e.target.value }))} style={inputStyle} />
                </div>
              </div>
            </div>

            <button onClick={handleSave} disabled={saving}
              style={{ width: "100%", padding: "16px", borderRadius: 12, border: "none", background: accent, color: "#fff", fontSize: 15, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
              {saving ? <><Spinner /> Saving…</> : "Complete Setup →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
