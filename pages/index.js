import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { loadSession, clearSession, signOut } from "../lib/auth";

const initialProfile = {
  name: "Rahul",
  title: "Senior Frontend Engineer",
  skills: "React, TypeScript, Node.js, GraphQL, AWS",
  experience: "5 years",
  location: "Remote",
  salaryMin: 140000,
  salaryMax: 200000,
  bio: "Passionate frontend engineer with expertise in building scalable web applications.",
  // Auto-apply fields
  email: "",
  phone: "",
  linkedin: "",
  workAuth: "yes",       // yes | no | visa
  needSponsorship: "no", // yes | no
  applyThreshold: 75,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  if (variant === "green") return { ...base, background: "#22c55e22", color: "#22c55e", border: "1px solid #22c55e33" };
  if (variant === "blue") return { ...base, background: "#3b82f622", color: "#3b82f6", border: "1px solid #3b82f633" };
  return { ...base, background: "#ffffff08", color: text, border: `1px solid ${border}` };
}

function Pill({ color, children }) {
  return (
    <span style={{ background: color + "18", color, border: `1px solid ${color}33`, padding: "2px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600 }}>
      {children}
    </span>
  );
}

function ScoreRing({ score, size = 48 }) {
  const color = score >= 85 ? "#22c55e" : score >= 65 ? "#f59e0b" : "#ef4444";
  const r = size / 2 - 5, c = 2 * Math.PI * r, dash = (score / 100) * c;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#ffffff12" strokeWidth={4} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4}
          strokeDasharray={`${dash} ${c - dash}`} strokeLinecap="round" />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size < 40 ? 10 : 11, fontWeight: 700, color }}>
        {score}
      </div>
    </div>
  );
}

function Spinner({ size = 16 }) {
  return <div style={{ width: size, height: size, border: `2px solid ${accent}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0 }} />;
}

function StatusBadge({ status }) {
  const map = { applied: ["#3b82f6", "Applied"], skipped: ["#6b7280", "Skipped"] };
  const [color, label] = map[status] || ["#6b7280", status];
  return <Pill color={color}>{label}</Pill>;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const [view, setView] = useState("dashboard");
  const [profile, setProfile] = useState(initialProfile);
  const [jobs, setJobs] = useState([]);
  const [scores, setScores] = useState({});
  const [statuses, setStatuses] = useState({});
  const [aiPanel, setAiPanel] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [scoringIds, setScoringIds] = useState(new Set());
  const [filterScore, setFilterScore] = useState(0);
  const [toast, setToast] = useState(null);
  const [sourceCounts, setSourceCounts] = useState({});
  const [session, setSession] = useState(null);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeFile, setResumeFile] = useState(null);
  const [queue, setQueue] = useState([]);
  const [queueing, setQueueing] = useState(new Set());
  const router = useRouter();

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  async function callAI(prompt) {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.text;
  }

  async function scoreJob(job) {
    setScoringIds(s => new Set(s).add(job.id));
    try {
      const prompt = `Score how well this candidate matches this job from 0-100. Only reply with a number, nothing else.
Candidate: ${profile.title}, skills: ${profile.skills}, ${profile.experience} experience
Job: ${job.title} at ${job.company}, tags: ${job.tags.join(", ")}`;
      const res = await callAI(prompt);
      const num = parseInt(res.match(/\d+/)?.[0] || "70");
      setScores(s => ({ ...s, [job.id]: Math.min(100, Math.max(0, num)) }));
    } catch {
      setScores(s => ({ ...s, [job.id]: 70 }));
    }
    setScoringIds(s => { const n = new Set(s); n.delete(job.id); return n; });
  }

  const handleSearch = async () => {
    setSearchLoading(true);
    setJobs([]);
    setScores({});
    try {
      const q = searchQuery.trim();
      const res = await fetch(q ? `/api/jobs?query=${encodeURIComponent(q)}` : `/api/jobs`);
      const data = await res.json();

      // Supabase already filters server-side, just use results directly
      const filtered = data.jobs || [];

      setJobs(filtered);
      setSourceCounts(data.counts || {});
      showToast(`Found ${filtered.length} jobs matching "${q}"`);
      // Score jobs in background, 3 at a time
      const jobList = data.jobs || [];
      for (let i = 0; i < jobList.length; i += 3) {
        await Promise.all(jobList.slice(i, i + 3).map(j => scoreJob(j)));
      }
    } catch (e) {
      showToast("Search failed: " + e.message, "error");
    }
    setSearchLoading(false);
  };

  useEffect(() => {
    const s = loadSession();
    if (!s?.access_token) { router.replace("/login"); return; }
    setSession(s);
    handleSearch();
    fetchQueue(s);
  }, []);

  async function fetchQueue(s) {
    const sess = s || session;
    if (!sess?.access_token) return;
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/apply_queue?select=*&order=created_at.desc&limit=50`,
        { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${sess.access_token}` } }
      );
      const data = await res.json();
      setQueue(Array.isArray(data) ? data : []);
    } catch (e) { console.error("Queue fetch error", e); }
  }

  async function queueJob(job, score) {
    if (!session?.access_token) return;
    setQueueing(q => new Set([...q, job.id]));
    try {
      // Generate cover letter first
      let coverLetter = "";
      try {
        const aiRes = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "cover", job, profile }),
        });
        const aiData = await aiRes.json();
        coverLetter = aiData.content || "";
      } catch (e) {}

      await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/apply_queue`,
        {
          method: "POST",
          headers: {
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
          },
          body: JSON.stringify({
            user_id: session?.user?.id,
            job_id: job.id,
            job_title: job.title,
            company: job.company,
            job_url: job.url,
            score,
            cover_letter: coverLetter,
            status: "queued",
          }),
        }
      );
      showToast(`✓ ${job.company} queued for auto-apply`);
      fetchQueue();
    } catch (e) {
      showToast("Queue failed: " + e.message, "error");
    }
    setQueueing(q => { const n = new Set(q); n.delete(job.id); return n; });
  }

  const generateCoverLetter = async (job) => {
    setAiPanel({ type: "cover", jobId: job.id, content: "", loading: true, job });
    try {
      const prompt = `Write a concise, punchy cover letter (3 short paragraphs) for:
Candidate: ${profile.name}, ${profile.title}
Skills: ${profile.skills}
Bio: ${profile.bio}
Job: ${job.title} at ${job.company}
Requirements: ${job.tags.join(", ")}
Make it enthusiastic but not sycophantic. No "Dear Hiring Manager" — start with a strong hook.`;
      const result = await callAI(prompt);
      setAiPanel(p => ({ ...p, content: result, loading: false }));
    } catch (e) {
      setAiPanel(p => ({ ...p, content: "Error: " + e.message, loading: false }));
    }
  };

  const tailorResume = async (job) => {
    setAiPanel({ type: "resume", jobId: job.id, content: "", loading: true, job });
    try {
      const prompt = `Give 5 specific resume bullet points to add/emphasize for this role. Use metrics. Be concrete.
Candidate: ${profile.title}, skills: ${profile.skills}
Job: ${job.title} at ${job.company}, tags: ${job.tags.join(", ")}`;
      const result = await callAI(prompt);
      setAiPanel(p => ({ ...p, content: result, loading: false }));
    } catch (e) {
      setAiPanel(p => ({ ...p, content: "Error: " + e.message, loading: false }));
    }
  };

  const markApplied = (jobId) => {
    setStatuses(s => ({ ...s, [jobId]: "applied" }));
    showToast("Marked as applied 🎉");
  };

  const appliedJobs = jobs.filter(j => statuses[j.id] === "applied");
  const sortedJobs = [...jobs].filter(j => (scores[j.id] || 0) >= filterScore || scoringIds.has(j.id))
    .sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));
  const avgScore = jobs.length && Object.keys(scores).length
    ? Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length)
    : null;
  const topMatches = jobs.filter(j => (scores[j.id] || 0) >= 80).length;

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Toast */}
      {toast && (
        <div className="toast" style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 999,
          background: toast.type === "error" ? "#ef4444" : "#22c55e",
          color: "#fff", padding: "12px 20px", borderRadius: 12, fontWeight: 600, fontSize: 13,
          boxShadow: "0 8px 32px #00000060", maxWidth: 360,
        }}>{toast.msg}</div>
      )}

      {/* Sidebar */}
      <div style={{ width: 220, background: surface, borderRight: `1px solid ${border}`, display: "flex", flexDirection: "column", padding: "24px 12px", position: "fixed", top: 0, bottom: 0, left: 0, zIndex: 50 }}>
        <div style={{ padding: "0 8px 20px", borderBottom: `1px solid ${border}`, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, boxShadow: `0 0 16px ${accentGlow}` }}>⚡</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>JobPilot</div>
              <div style={{ fontSize: 11, color: muted }}>AI Automator</div>
            </div>
          </div>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {[["dashboard","◈","Dashboard"],["jobs","⊞","Job Search"],["tracker","◎","Tracker"],["profile","⊙","My Profile"]].map(([id, icon, label]) => (
            <div key={id} className={`nav-item${view === id ? " active" : ""}`} onClick={() => setView(id)}>
              <span style={{ fontSize: 16, opacity: 0.6 }}>{icon}</span>{label}
              {id === "tracker" && appliedJobs.length > 0 && (
                <span style={{ marginLeft: "auto", background: accent, color: "#fff", borderRadius: 99, fontSize: 11, padding: "1px 7px", fontWeight: 700 }}>{appliedJobs.length}</span>
              )}
            </div>
          ))}
        </nav>
        <div style={{ marginTop: "auto", padding: "16px 8px 0", borderTop: `1px solid ${border}` }}>
          <div style={{ fontSize: 11, color: muted, marginBottom: 4 }}>Signed in as</div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{profile.name || session?.user?.email?.split("@")[0] || "User"}</div>
          <div style={{ fontSize: 12, color: muted, marginBottom: 12 }}>{profile.title}</div>
          <button
            onClick={async () => {
              if (session?.access_token) await signOut(session.access_token);
              clearSession();
              router.replace("/login");
            }}
            style={{ width: "100%", padding: "8px", background: "#ffffff08", border: `1px solid ${border}`, borderRadius: 8, color: muted, fontSize: 12, fontFamily: "inherit", cursor: "pointer", fontWeight: 600 }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ marginLeft: 220, padding: "36px 32px", flex: 1, maxWidth: 1100 }}>

        {/* ── DASHBOARD ── */}
        {view === "dashboard" && (
          <div className="fadeUp">
            <div style={{ marginBottom: 32 }}>
              <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>Good morning, {profile.name.split(" ")[0]} 👋</h1>
              <p style={{ color: muted }}>Your AI job search is active. Here's your overview.</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 32 }}>
              {[
                { label: "Jobs Found", value: jobs.length, icon: "⊞", color: accent },
                { label: "Top Matches (80+)", value: topMatches, icon: "◈", color: "#22c55e" },
                { label: "Applied", value: appliedJobs.length, icon: "◎", color: "#3b82f6" },
                { label: "Avg Match", value: avgScore ? `${avgScore}%` : "…", icon: "⊙", color: "#f59e0b" },
              ].map(({ label, value, icon, color }) => (
                <div key={label} style={card}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ fontSize: 12, color: muted }}>{label}</span>
                    <span style={{ fontSize: 20, opacity: 0.4 }}>{icon}</span>
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 700, color }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Source breakdown */}
            {Object.keys(sourceCounts).length > 0 && (
              <div style={{ ...card, marginBottom: 24, display: "flex", gap: 24, alignItems: "center" }}>
                <span style={{ color: muted, fontSize: 12 }}>Sources:</span>
                {Object.entries(sourceCounts).map(([src, count]) => (
                  <span key={src} style={{ fontSize: 13 }}>
                    <span style={{ color: accent, fontWeight: 700 }}>{count}</span>
                    <span style={{ color: muted }}> from {src}</span>
                  </span>
                ))}
              </div>
            )}

            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>Top Matches</h2>
                <button style={btn("ghost")} onClick={() => setView("jobs")}>View all →</button>
              </div>
              {searchLoading ? (
                <div style={{ display: "flex", gap: 12, alignItems: "center", color: muted, padding: "24px 0" }}>
                  <Spinner /> Loading jobs from Remotive, The Muse & Adzuna…
                </div>
              ) : sortedJobs.slice(0, 4).map(job => (
                <MiniJobRow key={job.id} job={job} score={scores[job.id]} scoring={scoringIds.has(job.id)}
                  status={statuses[job.id]} onCover={() => { generateCoverLetter(job); setView("jobs"); }}
                  onApply={() => markApplied(job.id)} />
              ))}
              {!searchLoading && jobs.length === 0 && (
                <div style={{ color: muted, textAlign: "center", padding: 32 }}>No jobs loaded yet. <button style={{ ...btn("primary"), marginLeft: 8 }} onClick={() => { setView("jobs"); handleSearch(); }}>Search now</button></div>
              )}
            </div>
          </div>
        )}

        {/* ── JOB SEARCH ── */}
        {view === "jobs" && (
          <div className="fadeUp">
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Job Search</h1>
              <p style={{ color: muted }}>Real listings from Remotive, The Muse & Adzuna — AI-scored for your profile</p>
            </div>
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                placeholder={`Search jobs (default: "${profile.title}")`}
                style={{ flex: 1, background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: "12px 16px", color: text, fontFamily: "inherit", fontSize: 14, outline: "none" }} />
              <button style={{ ...btn("primary"), padding: "12px 24px", fontSize: 14 }} onClick={handleSearch} disabled={searchLoading}>
                {searchLoading ? "Searching…" : "🔍 Search"}
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "center" }}>
              <span style={{ color: muted, fontSize: 12 }}>Min score:</span>
              {[0, 60, 70, 80, 90].map(s => (
                <button key={s} onClick={() => setFilterScore(s)}
                  style={{ ...btn("ghost"), background: filterScore === s ? accent : "#ffffff08", color: filterScore === s ? "#fff" : muted, padding: "4px 12px", fontSize: 12 }}>
                  {s === 0 ? "All" : `${s}+`}
                </button>
              ))}
              <span style={{ marginLeft: "auto", color: muted, fontSize: 12 }}>{sortedJobs.length} jobs</span>
            </div>

            <div style={{ display: "flex", gap: 20 }}>
              {/* Job list */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                {searchLoading && (
                  <div style={{ ...card, display: "flex", gap: 12, alignItems: "center", color: muted }}>
                    <Spinner /> Fetching from Remotive, The Muse & Adzuna…
                  </div>
                )}
                {!searchLoading && sortedJobs.length === 0 && (
                  <div style={{ ...card, textAlign: "center", color: muted, padding: 48 }}>No jobs match your filters</div>
                )}
                {sortedJobs.map(job => (
                  <JobCard key={job.id} job={job} score={scores[job.id]} scoring={scoringIds.has(job.id)}
                    status={statuses[job.id]} active={aiPanel?.jobId === job.id}
                    onCover={() => generateCoverLetter(job)}
                    onResume={() => tailorResume(job)}
                    onApply={() => markApplied(job.id)}
                    onQueue={() => queueJob(job, scores[job.id] || 0)}
                    queuing={queueing.has(job.id)}
                    queued={queue.some(q => q.job_id === job.id)}
                    threshold={profile.applyThreshold || 75} />
                ))}
              </div>

              {/* AI Panel */}
              {aiPanel && (
                <div style={{ width: 360, ...card, flexShrink: 0, alignSelf: "flex-start", position: "sticky", top: 20, animation: "fadeUp 0.3s ease" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <h3 style={{ fontWeight: 700, fontSize: 14 }}>
                      {aiPanel.type === "cover" ? "✍ Cover Letter" : "📄 Resume Tips"}
                    </h3>
                    <button onClick={() => setAiPanel(null)} style={{ background: "none", border: "none", color: muted, cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
                  </div>
                  <div style={{ fontSize: 12, color: muted, marginBottom: 16 }}>
                    {aiPanel.job?.title} @ {aiPanel.job?.company}
                  </div>
                  {aiPanel.loading ? (
                    <div style={{ display: "flex", gap: 10, alignItems: "center", color: muted, padding: "20px 0" }}>
                      <Spinner /> Generating with AI…
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, lineHeight: 1.75, color: "#c8c8d8", whiteSpace: "pre-wrap", maxHeight: 500, overflowY: "auto" }}>
                      {aiPanel.content}
                    </div>
                  )}
                  {!aiPanel.loading && aiPanel.content && (
                    <button style={{ ...btn("primary"), marginTop: 16, width: "100%", fontSize: 13 }}
                      onClick={() => { navigator.clipboard?.writeText(aiPanel.content); showToast("Copied!"); }}>
                      Copy to Clipboard
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TRACKER ── */}
        {view === "tracker" && (
          <div className="fadeUp">
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>Application Tracker</h1>
              <p style={{ color: muted }}>{appliedJobs.length} application{appliedJobs.length !== 1 ? "s" : ""} logged</p>
            </div>
            {appliedJobs.length === 0 ? (
              <div style={{ ...card, textAlign: "center", padding: 64, color: muted }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>◎</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: text, marginBottom: 8 }}>No applications yet</div>
                <p>Go to Job Search, find a role, and click <strong>Mark Applied</strong></p>
              </div>
            ) : (
              <div style={card}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${border}` }}>
                      {["Company", "Role", "Location", "Score", "Source", "Status", ""].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: muted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {appliedJobs.map(job => (
                      <tr key={job.id} style={{ borderBottom: `1px solid ${border}` }}>
                        <td style={{ padding: "14px 12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 8, background: job.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: job.color, flexShrink: 0 }}>{job.logo}</div>
                            <span style={{ fontWeight: 600 }}>{job.company}</span>
                          </div>
                        </td>
                        <td style={{ padding: "14px 12px", color: muted, fontSize: 13 }}>{job.title}</td>
                        <td style={{ padding: "14px 12px", color: muted, fontSize: 12 }}>{job.location}</td>
                        <td style={{ padding: "14px 12px" }}><ScoreRing score={scores[job.id] || 0} size={36} /></td>
                        <td style={{ padding: "14px 12px" }}><Pill color={muted}>{job.source}</Pill></td>
                        <td style={{ padding: "14px 12px" }}><StatusBadge status={statuses[job.id]} /></td>
                        <td style={{ padding: "14px 12px" }}>
                          {job.url && <a href={job.url} target="_blank" rel="noreferrer" style={{ ...btn("blue"), fontSize: 11, textDecoration: "none" }}>Open →</a>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Auto-Apply Queue */}
            <div style={{ marginTop: 32 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>⚡ Auto-Apply Queue</h2>
                  <p style={{ color: muted, fontSize: 13 }}>{queue.length} job{queue.length !== 1 ? "s" : ""} in queue</p>
                </div>
                <button style={btn("ghost")} onClick={() => fetchQueue()}>↻ Refresh</button>
              </div>
              {queue.length === 0 ? (
                <div style={{ ...card, textAlign: "center", padding: 40, color: muted }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>⚡</div>
                  <div style={{ fontWeight: 600, color: text, marginBottom: 6 }}>Queue is empty</div>
                  <p style={{ fontSize: 13 }}>Find jobs scoring {profile.applyThreshold || 75}+ and click <strong>Auto-Apply</strong></p>
                </div>
              ) : (
                <div style={card}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${border}` }}>
                        {["Company", "Role", "Score", "Status", "Queued"].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: muted, fontSize: 11, fontWeight: 600, textTransform: "uppercase" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {queue.map(item => {
                        const statusColors = { queued: "#f59e0b", applying: "#3b82f6", applied: "#22c55e", failed: "#ef4444" };
                        const color = statusColors[item.status] || muted;
                        return (
                          <tr key={item.id} style={{ borderBottom: `1px solid ${border}` }}>
                            <td style={{ padding: "12px 12px", fontWeight: 600 }}>{item.company}</td>
                            <td style={{ padding: "12px 12px", color: muted, fontSize: 13 }}>{item.job_title}</td>
                            <td style={{ padding: "12px 12px" }}><ScoreRing score={item.score || 0} size={34} /></td>
                            <td style={{ padding: "12px 12px" }}>
                              <Pill color={color}>{item.status}</Pill>
                              {item.error_msg && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{item.error_msg}</div>}
                            </td>
                            <td style={{ padding: "12px 12px", color: muted, fontSize: 12 }}>
                              {new Date(item.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PROFILE ── */}
        {view === "profile" && (
          <div className="fadeUp">
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>My Profile</h1>
              <p style={{ color: muted }}>Used to AI-score jobs and generate tailored applications</p>
            </div>

            {/* Resume Upload */}
            <div style={{ ...card, maxWidth: 600, marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>📄 Resume</div>
                  <div style={{ fontSize: 12, color: muted }}>Upload a PDF — we'll auto-fill your profile and use it for AI features</div>
                </div>
                {profile.resume_filename && (
                  <div style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>✓ {profile.resume_filename}</div>
                )}
              </div>
              <label style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                border: `2px dashed ${border}`, borderRadius: 12, padding: "24px",
                cursor: resumeUploading ? "not-allowed" : "pointer",
                background: "#ffffff04", transition: "all 0.15s",
              }}>
                <input type="file" accept=".pdf" style={{ display: "none" }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setResumeFile(file.name);
                    setResumeUploading(true);
                    showToast("Parsing resume with AI…");
                    try {
                      const base64 = await new Promise((res) => {
                        const reader = new FileReader();
                        reader.onload = () => res(reader.result.split(",")[1]);
                        reader.readAsDataURL(file);
                      });
                      const resp = await fetch("/api/resume", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          "Authorization": `Bearer ${session?.access_token}`,
                        },
                        body: JSON.stringify({ pdfBase64: base64, fileName: file.name }),
                      });
                      const data = await resp.json();
                      if (data.parsed) {
                        setProfile(p => ({ ...p, ...data.parsed, resume_url: data.resumeUrl, resume_filename: file.name }));
                        showToast("✓ Resume parsed! Profile auto-filled.");
                      } else {
                        showToast("Parse failed: " + (data.parseError || "unknown error"), "error");
                      }
                    } catch (err) {
                      showToast("Upload failed: " + err.message, "error");
                    }
                    setResumeUploading(false);
                  }}
                />
                {resumeUploading
                  ? <><Spinner size={20} /><span style={{ color: muted, fontSize: 13 }}>Parsing with AI…</span></>
                  : <><span style={{ fontSize: 24 }}>📎</span><span style={{ color: muted, fontSize: 13 }}>{resumeFile || "Click to upload PDF resume"}</span></>
                }
              </label>
            </div>

            <div style={{ ...card, maxWidth: 600 }}>
              {[
                { key: "name", label: "Full Name" },
                { key: "title", label: "Job Title / Role" },
                { key: "skills", label: "Skills (comma-separated)" },
                { key: "experience", label: "Years of Experience" },
                { key: "location", label: "Preferred Location" },
                { key: "bio", label: "Bio / Summary", multiline: true },
              ].map(({ key, label, multiline }) => (
                <div key={key} style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 12, color: muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</label>
                  {multiline ? (
                    <textarea value={profile[key]} rows={3}
                      onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))}
                      style={{ width: "100%", background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 14px", color: text, fontFamily: "inherit", fontSize: 13, resize: "vertical", outline: "none" }} />
                  ) : (
                    <input value={profile[key]}
                      onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))}
                      style={{ width: "100%", background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 14px", color: text, fontFamily: "inherit", fontSize: 13, outline: "none" }} />
                  )}
                </div>
              ))}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                {[["salaryMin", "Min Salary ($)"], ["salaryMax", "Max Salary ($)"]].map(([key, label]) => (
                  <div key={key}>
                    <label style={{ display: "block", fontSize: 12, color: muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</label>
                    <input type="number" value={profile[key]}
                      onChange={e => setProfile(p => ({ ...p, [key]: +e.target.value }))}
                      style={{ width: "100%", background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 14px", color: text, fontFamily: "inherit", fontSize: 13, outline: "none" }} />
                  </div>
                ))}
              </div>

              {/* Auto-Apply Fields */}
              <div style={{ borderTop: `1px solid ${border}`, paddingTop: 24, marginBottom: 24 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>⚡ Auto-Apply Settings</div>
                <div style={{ fontSize: 12, color: muted, marginBottom: 20 }}>Used by the apply script to fill Greenhouse forms</div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  {[["email", "Email Address"], ["phone", "Phone Number"]].map(([key, label]) => (
                    <div key={key}>
                      <label style={{ display: "block", fontSize: 12, color: muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</label>
                      <input value={profile[key] || ""} onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))}
                        style={{ width: "100%", background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 14px", color: text, fontFamily: "inherit", fontSize: 13, outline: "none" }} />
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, color: muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>LinkedIn URL</label>
                  <input value={profile.linkedin || ""} placeholder="https://linkedin.com/in/yourname"
                    onChange={e => setProfile(p => ({ ...p, linkedin: e.target.value }))}
                    style={{ width: "100%", background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 14px", color: text, fontFamily: "inherit", fontSize: 13, outline: "none" }} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Work Auth (US)</label>
                    <select value={profile.workAuth || "yes"} onChange={e => setProfile(p => ({ ...p, workAuth: e.target.value }))}
                      style={{ width: "100%", background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 14px", color: text, fontFamily: "inherit", fontSize: 13, outline: "none" }}>
                      <option value="yes">Yes — authorized</option>
                      <option value="no">No</option>
                      <option value="visa">Yes — on visa</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Need Sponsorship</label>
                    <select value={profile.needSponsorship || "no"} onChange={e => setProfile(p => ({ ...p, needSponsorship: e.target.value }))}
                      style={{ width: "100%", background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 14px", color: text, fontFamily: "inherit", fontSize: 13, outline: "none" }}>
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: muted, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Min Score to Apply</label>
                    <select value={profile.applyThreshold || 75} onChange={e => setProfile(p => ({ ...p, applyThreshold: +e.target.value }))}
                      style={{ width: "100%", background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: "10px 14px", color: text, fontFamily: "inherit", fontSize: 13, outline: "none" }}>
                      <option value={70}>70+</option>
                      <option value={75}>75+</option>
                      <option value={80}>80+</option>
                      <option value={85}>85+</option>
                    </select>
                  </div>
                </div>
              </div>

              <button style={{ ...btn("primary"), width: "100%", padding: "12px", fontSize: 14 }}
                onClick={() => { showToast("Profile saved! Re-scoring jobs…"); setView("jobs"); handleSearch(); }}>
                Save & Re-Score Jobs
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function JobCard({ job, score, scoring, status, active, onCover, onResume, onApply, onQueue, queuing, queued, threshold }) {
  return (
    <div className="job-card" style={{ ...card, border: active ? `1px solid ${accent}66` : `1px solid ${border}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, background: job.color + "22", border: `1px solid ${job.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: job.color, flexShrink: 0 }}>
          {job.logo}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{job.title}</span>
            {status && <StatusBadge status={status} />}
          </div>
          <div style={{ color: muted, fontSize: 13, marginBottom: 8 }}>
            {job.company} · {job.location} {job.salary && job.salary !== "Not specified" ? `· ${job.salary}` : ""} · {job.posted}
          </div>
          {job.description && (
            <div style={{ color: "#8888a0", fontSize: 12, lineHeight: 1.6, marginBottom: 10, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {job.description?.replace(/<[^>]*>/g, "").replace(/&[a-z]+;/gi, " ").trim()}
            </div>
          )}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {job.tags.map(t => <Pill key={t} color={accent}>{t}</Pill>)}
            <Pill color={muted}>{job.source}</Pill>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {scoring ? <div style={{ width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center" }}><Spinner size={20} /></div>
            : <ScoreRing score={score || 0} />}
          <span style={{ fontSize: 10, color: muted }}>Match</span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${border}`, flexWrap: "wrap", alignItems: "center" }}>
        <button style={btn()} onClick={onCover}>✍ Cover Letter</button>
        <button style={btn()} onClick={onResume}>📄 Resume Tips</button>
        {job.url && (
          <a href={job.url} target="_blank" rel="noreferrer" style={{ ...btn("blue"), textDecoration: "none" }}>Apply →</a>
        )}
        {!queued && status !== "applied" && (
          <button
            style={{ ...btn(), background: "#7c6af722", color: "#7c6af7", border: "1px solid #7c6af733", opacity: queuing ? 0.6 : 1 }}
            onClick={onQueue} disabled={queuing}>
            {queuing ? "Queuing…" : "⚡ Auto-Apply"}
          </button>
        )}
        {queued && <span style={{ fontSize: 12, color: "#7c6af7", fontWeight: 600 }}>⚡ Queued</span>}
        {status !== "applied" && (
          <button style={{ ...btn("green"), marginLeft: "auto" }} onClick={onApply}>✓ Mark Applied</button>
        )}
      </div>
    </div>
  );
}

function MiniJobRow({ job, score, scoring, status, onCover, onApply }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0", borderBottom: `1px solid ${border}` }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: job.color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: job.color, flexShrink: 0 }}>{job.logo}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>{job.title}</div>
        <div style={{ fontSize: 12, color: muted }}>{job.company} · {job.location}</div>
      </div>
      {status && <StatusBadge status={status} />}
      {scoring ? <Spinner size={20} /> : <ScoreRing score={score || 0} size={38} />}
      <div style={{ display: "flex", gap: 6 }}>
        <button style={btn()} onClick={onCover}>Cover</button>
        {!status && <button style={btn("green")} onClick={onApply}>Applied</button>}
      </div>
    </div>
  );
}
