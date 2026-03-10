// scripts/claude.js — answers custom form questions using Claude

const { anthropicKey } = require("./config");

async function answerQuestion(question, options, job, profile) {
  const isDropdown = options && options.length > 0;

  const prompt = `You are filling out a job application on behalf of a candidate.

CANDIDATE PROFILE:
Name: ${profile.firstName} ${profile.lastName}
Title: ${profile.title}
Skills: ${profile.skills}
Experience: ${profile.experience}
Bio: ${profile.bio}
Work Authorization: ${profile.workAuth === "yes" ? "Authorized to work in the US" : profile.workAuth === "visa" ? "Authorized on visa" : "Not authorized"}
Needs Sponsorship: ${profile.needSponsorship === "yes" ? "Yes" : "No"}

JOB:
Company: ${job.company}
Title: ${job.title}
Description: ${(job.description || "").slice(0, 800)}

QUESTION: ${question}
${isDropdown ? `\nOPTIONS (pick exactly one):\n${options.map((o, i) => `${i}: ${o}`).join("\n")}` : ""}

${isDropdown
  ? "Respond with ONLY the index number (0, 1, 2...) of the best option. Nothing else."
  : "Respond with a concise, professional answer (1-3 sentences max). Be specific to the candidate and role. No fluff."}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    const answer = data.content?.[0]?.text?.trim() || "";

    if (isDropdown) {
      const idx = parseInt(answer);
      return isNaN(idx) ? 0 : Math.min(idx, options.length - 1);
    }
    return answer;
  } catch (e) {
    console.error("Claude answer error:", e.message);
    if (isDropdown) return 0;
    return `${profile.firstName} ${profile.lastName} is a ${profile.title} with ${profile.experience} of experience in ${profile.skills}.`;
  }
}

module.exports = { answerQuestion };
