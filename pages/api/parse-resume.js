// POST: body { pdfBase64: string } — extract text from PDF, then AI parses into profile JSON
import { PDFParse } from "pdf-parse";

export const config = {
  api: { bodyParser: { sizeLimit: "5mb" } },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { pdfBase64 } = req.body || {};
  if (!pdfBase64 || typeof pdfBase64 !== "string") {
    return res.status(400).json({ error: "Missing pdfBase64 in body" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });
  }

  let buffer;
  try {
    buffer = Buffer.from(pdfBase64, "base64");
  } catch {
    return res.status(400).json({ error: "Invalid base64" });
  }

  let parser;
  try {
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();
    var resumeText = result.text || "";
  } catch (e) {
    return res.status(400).json({ error: "Could not read PDF: " + (e.message || "invalid file") });
  }

  if (!resumeText.trim()) {
    return res.status(400).json({ error: "PDF has no extractable text" });
  }

  const system = "You extract structured data from resume text. Reply with only valid JSON, no markdown or explanation.";
  const prompt = `From this resume text, extract exactly these fields. Reply with ONLY a single JSON object, no other text.
Use empty string "" for missing text fields and 0 for missing numbers.

Resume text:
---
${resumeText.slice(0, 12000)}
---

Return this exact structure (same keys):
{"name":"","title":"","skills":"","experience":"","location":"","bio":"","salaryMin":0,"salaryMax":0}

- name: full name
- title: current or desired job title / role
- skills: comma-separated list of skills
- experience: e.g. "5 years" or "3 years"
- location: preferred or current location
- bio: short professional summary (1-2 sentences)
- salaryMin, salaryMax: numbers only, or 0 if not stated`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 800,
        system,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await response.json();
    const raw = (data.content?.map((b) => b.text || "").join("") || "").trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const profile = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    const out = {
      name: String(profile.name ?? "").trim(),
      title: String(profile.title ?? "").trim(),
      skills: String(profile.skills ?? "").trim(),
      experience: String(profile.experience ?? "").trim(),
      location: String(profile.location ?? "").trim(),
      bio: String(profile.bio ?? "").trim(),
      salaryMin: Number(profile.salaryMin) || 0,
      salaryMax: Number(profile.salaryMax) || 0,
    };
    res.status(200).json({ profile: out });
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to parse resume" });
  }
}
