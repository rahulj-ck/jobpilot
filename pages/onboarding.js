import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { getValidSession } from "../lib/auth";
import { saveProfile } from "../lib/supabase";

const accent = "#7c6af7";
const accentGlow = "#7c6af720";
const bg = "#07070f";
const surface = "#0e0e1a";
const border = "#ffffff0d";
const text = "#e8e8f4";
const muted = "#5a5a72";

function Spinner() {
  return <div style={{ width: 20, height: 20, border: `2px solid ${border}`, borderTop: `2px solid ${accent}`, borderRadius: "50%", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />;
}

function ProgressBar({ step }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, marginBottom: 48 }}>
      {[1, 2].map((s, i) => (
        <div key={s} style={{ display: "flex", alignItems: "center" }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: s <= step ? accent : surface,
            border: `2px solid ${s <= step ? accent : border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700,
            color: s <= step ? "#fff" : muted,
            transition: "all 0.3s",
            boxShadow: s === step ? `0 0 20px ${accentGlow}` : "none",
          }}>
            {s < step ? "✓" : s}
          </div>
          {i === 0 && <div style={{ width: 80, height: 2, background: step > 1 ? accent : border, transition: "all 0.3s" }} />}
        </div>
      ))}
    </div>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
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
      setProfile(p => ({ ...p, email: s.user?.email || "" }));
    });
  }, []);

  async function handleFile(file) {
    if (!file) return;
    setUploading(true);
    try {
      const base64 = await new Promise(res => {
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
      setProfile(p => ({
        ...p, ...(data.parsed || {}),
        resume_url: data.resumeUrl || "",
        resume_filename: file.name,
        work_history: data.parsed?.work_history || [],
        education_history: data.parsed?.education_history || [],
        certifications: Array.isArray(data.parsed?.certifications) ? data.parsed.certifications.join(", ") : (data.parsed?.certifications || ""),
      }));
    } catch (e) { console.error(e); }
    setUploading(false);
    setStep(2);
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
        work_history: profile.work_history?.length ? JSON.stringify(profile.work_history) : null,
        education_history: profile.education_history?.length ? JSON.stringify(profile.education_history) : null,
        certifications: profile.certifications || null,
      }, session?.access_token);
      router.replace("/");
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  const inputStyle = { width: "100%", background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "11px 14px", color: text, fontFamily: "inherit", fontSize: 14, outline: "none", transition: "border-color 0.2s" };
  const labelStyle = { display: "block", fontSize: 11, color: muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" };

  return (
    <div style={{ minHeight: "100vh", background: bg, color: text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } } @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} } * { box-sizing: border-box; } input:focus,textarea:focus,select:focus { border-color: ${accent} !important; outline: none; } input::placeholder { color: ${muted}; }`}</style>

      <div style={{ width: "100%", maxWidth: 520, animation: "fadeUp 0.4s ease" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: "10px 20px", marginBottom: 32 }}>
            <span style={{ fontSize: 20 }}>⚡</span>
            <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em" }}>JobPilot</span>
          </div>
          <ProgressBar step={step} />
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 8px", letterSpacing: "-0.03em" }}>
            {step === 1 ? "Let's set up your profile" : "Work authorization"}
          </h1>
          <p style={{ color: muted, margin: 0, fontSize: 14, lineHeight: 1.6 }}>
            {step === 1 ? "Upload your resume and we'll auto-fill everything in seconds" : "Helps us match jobs and fill applications correctly"}
          </p>
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <div style={{ animation: "fadeUp 0.3s ease" }}>
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
              style={{ border: `2px dashed ${dragOver || uploading ? accent : border}`, borderRadius: 20, padding: "56px 32px", textAlign: "center", background: dragOver ? accentGlow : "#ffffff02", transition: "all 0.2s", marginBottom: 16 }}
            >
              <label style={{ cursor: uploading ? "default" : "pointer", display: "block" }}>
                <input type="file" accept=".pdf" style={{ display: "none" }} onChange={e => handleFile(e.target.files?.[0])} />
                {uploading ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                    <div style={{ fontSize: 40, animation: "pulse 1.5s ease infinite" }}>📄</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Spinner />
                      <span style={{ color: muted, fontSize: 14 }}>Parsing your resume with AI…</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                    <div style={{ fontSize: 44 }}>{profile.resume_filename ? "✅" : "📎"}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{profile.resume_filename || "Drop your resume here"}</div>
                      <div style={{ color: muted, fontSize: 13 }}>{profile.resume_filename ? "Resume uploaded — click Next to continue" : "PDF format · Click or drag to upload"}</div>
                    </div>
                    {!profile.resume_filename && (
                      <div style={{ background: accent, color: "#fff", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 600, marginTop: 4 }}>Browse files</div>
                    )}
                  </div>
                )}
              </label>
            </div>

            {profile.resume_filename && (
              <button onClick={() => setStep(2)} style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: accent, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 24px ${accentGlow}`, marginBottom: 12 }}>
                Next →
              </button>
            )}
            <button onClick={() => setStep(2)} style={{ width: "100%", background: "none", border: "none", color: muted, cursor: "pointer", fontSize: 13, padding: "12px", textDecoration: "underline" }}>
              Skip — I'll fill in my details manually
            </button>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div style={{ animation: "fadeUp 0.3s ease", display: "flex", flexDirection: "column", gap: 16 }}>

            <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>🇺🇸 US Work Authorization</div>
              <div style={{ color: muted, fontSize: 13, marginBottom: 20 }}>Are you authorized to work in the United States?</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { value: "yes", label: "Yes — US citizen or permanent resident", icon: "✅" },
                  { value: "visa", label: "Yes — currently on a work visa (H-1B, OPT, etc.)", icon: "🛂" },
                  { value: "no", label: "No — not authorized to work in the US", icon: "❌" },
                ].map(opt => (
                  <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 14, background: profile.workAuth === opt.value ? accentGlow : bg, border: `1.5px solid ${profile.workAuth === opt.value ? accent : border}`, borderRadius: 12, padding: "14px 16px", cursor: "pointer", transition: "all 0.15s" }}>
                    <input type="radio" name="workAuth" value={opt.value} checked={profile.workAuth === opt.value} onChange={e => setProfile(p => ({ ...p, workAuth: e.target.value }))} style={{ display: "none" }} />
                    <span style={{ fontSize: 18 }}>{opt.icon}</span>
                    <span style={{ fontSize: 14, fontWeight: profile.workAuth === opt.value ? 600 : 400 }}>{opt.label}</span>
                    {profile.workAuth === opt.value && <div style={{ marginLeft: "auto", width: 18, height: 18, borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff" }}>✓</div>}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>🎫 Visa Sponsorship</div>
              <div style={{ color: muted, fontSize: 13, marginBottom: 20 }}>Do you require visa sponsorship?</div>
              <div style={{ display: "flex", gap: 12 }}>
                {[{ value: "no", label: "No sponsorship needed", icon: "👍" }, { value: "yes", label: "Yes, I need sponsorship", icon: "📋" }].map(opt => (
                  <label key={opt.value} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, background: profile.needSponsorship === opt.value ? accentGlow : bg, border: `1.5px solid ${profile.needSponsorship === opt.value ? accent : border}`, borderRadius: 12, padding: "16px", cursor: "pointer", transition: "all 0.15s", textAlign: "center" }}>
                    <input type="radio" name="sponsorship" value={opt.value} checked={profile.needSponsorship === opt.value} onChange={e => setProfile(p => ({ ...p, needSponsorship: e.target.value }))} style={{ display: "none" }} />
                    <span style={{ fontSize: 24 }}>{opt.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: profile.needSponsorship === opt.value ? 600 : 400, lineHeight: 1.4 }}>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>💰 Salary Expectations</div>
              <div style={{ color: muted, fontSize: 13, marginBottom: 20 }}>Used to filter jobs and answer salary questions</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label style={labelStyle}>Minimum ($)</label>
                  <input type="number" value={profile.salaryMin} onChange={e => setProfile(p => ({ ...p, salaryMin: +e.target.value }))} style={inputStyle} placeholder="100000" />
                </div>
                <div>
                  <label style={labelStyle}>Maximum ($)</label>
                  <input type="number" value={profile.salaryMax} onChange={e => setProfile(p => ({ ...p, salaryMax: +e.target.value }))} style={inputStyle} placeholder="200000" />
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
              <button onClick={() => setStep(1)} style={{ flex: "0 0 auto", padding: "14px 20px", borderRadius: 12, border: `1px solid ${border}`, background: surface, color: text, fontSize: 14, cursor: "pointer" }}>← Back</button>
              <button onClick={handleSave} disabled={saving} style={{ flex: 1, padding: "14px", borderRadius: 12, border: "none", background: accent, color: "#fff", fontSize: 15, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: `0 4px 24px ${accentGlow}` }}>
                {saving ? <><Spinner /> Setting up…</> : "Start finding jobs →"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
