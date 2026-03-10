// pages/api/resume.js — parse PDF resume with Claude, store in Supabase Storage

export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
  const token = authHeader.replace("Bearer ", "");

  const { pdfBase64, fileName } = req.body;
  if (!pdfBase64) return res.status(400).json({ error: "No PDF provided" });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

  // 1. Get user id from token
  let userId;
  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!userRes.ok) return res.status(401).json({ error: "Invalid session" });
    const user = await userRes.json();
    userId = user.id;
  } catch (e) {
    return res.status(401).json({ error: "Auth failed" });
  }

  // 2. Store PDF in Supabase Storage
  let resumeUrl = null;
  try {
    const fileBuffer = Buffer.from(pdfBase64, "base64");
    const storagePath = `${userId}/resume.pdf`;
    const uploadRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/resumes/${storagePath}`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/pdf",
          "x-upsert": "true",
        },
        body: fileBuffer,
      }
    );
    if (uploadRes.ok) {
      resumeUrl = `${SUPABASE_URL}/storage/v1/object/public/resumes/${storagePath}`;
    }
  } catch (e) {
    console.error("Storage upload error:", e);
  }

  // 3. Parse resume with Claude (send as base64 PDF)
  let parsed = null;
  let parseError = null;
  try {
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "pdfs-2024-09-25",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfBase64,
              },
            },
            {
              type: "text",
              text: `Extract ALL of the following from this resume and return ONLY a valid JSON object (no markdown, no explanation):
{
  "name": "full name",
  "email": "email address if present",
  "phone": "phone number if present",
  "linkedin": "linkedin url if present",
  "title": "current or most recent job title",
  "skills": "comma-separated list of all technical and soft skills",
  "experience": "X years (estimate total years of work experience)",
  "location": "city, country",
  "bio": "3-sentence professional summary based on their background",
  "school": "most recent university or college name",
  "degree": "full degree name e.g. Bachelor of Engineering in Computer Science",
  "discipline": "field of study e.g. Computer Science",
  "work_history": [
    {
      "company": "company name",
      "title": "job title",
      "start": "month year",
      "end": "month year or Present",
      "description": "2-sentence summary of role and impact"
    }
  ],
  "education_history": [
    {
      "school": "school name",
      "degree": "degree name",
      "field": "field of study",
      "start": "year",
      "end": "year or Present"
    }
  ],
  "certifications": ["cert1", "cert2"]
}`,
            },
          ],
        }],
      }),
    });

    const claudeData = await claudeRes.json();
    console.log("Claude response:", JSON.stringify(claudeData).slice(0, 500));
    
    if (claudeData.error) {
      parseError = claudeData.error.message;
      throw new Error(claudeData.error.message);
    }
    
    const raw = claudeData.content?.[0]?.text || "";
    const clean = raw.replace(/```json|```/g, "").trim();
    parsed = JSON.parse(clean);
  } catch (e) {
    parseError = e.message;
    console.error("Claude parse error:", e);
  }

  // 4. Save profile to Supabase
  if (parsed) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/user_profiles`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          user_id: userId,
          name: parsed.name,
          email: parsed.email,
          phone: parsed.phone,
          linkedin: parsed.linkedin,
          title: parsed.title,
          skills: parsed.skills,
          experience: parsed.experience,
          location: parsed.location,
          bio: parsed.bio,
          school: parsed.school,
          degree: parsed.degree,
          discipline: parsed.discipline,
          work_history: parsed.work_history ? JSON.stringify(parsed.work_history) : null,
          education_history: parsed.education_history ? JSON.stringify(parsed.education_history) : null,
          certifications: parsed.certifications ? parsed.certifications.join(", ") : null,
          resume_url: resumeUrl,
          resume_filename: fileName || "resume.pdf",
          updated_at: new Date().toISOString(),
        }),
      });
    } catch (e) {
      console.error("Profile save error:", e);
    }
  }

  res.status(200).json({ 
    parsed, 
    resumeUrl, 
    parseError,
    resumeUploaded: !!resumeUrl,
  });
}
