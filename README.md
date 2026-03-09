# ⚡ JobPilot — AI Job Application Automator

A Next.js app that pulls real jobs from 3 free APIs, AI-scores them against your profile, and generates tailored cover letters and resume tips.

## 🚀 Deploy to Vercel (5 minutes)

### Step 1 — Upload to GitHub
1. Create a new repo at https://github.com/new
2. Upload all these files (drag & drop the folder)

### Step 2 — Deploy on Vercel
1. Go to https://vercel.com and sign in with GitHub
2. Click **"Add New Project"**
3. Import your GitHub repo
4. Click **"Deploy"** — Vercel auto-detects Next.js

### Step 3 — Add Environment Variables
In your Vercel project → **Settings → Environment Variables**, add:

| Key | Value | Required |
|-----|-------|----------|
| `ANTHROPIC_API_KEY` | Your key from https://console.anthropic.com | ✅ Yes |
| `ADZUNA_APP_ID` | From https://developer.adzuna.com | Optional |
| `ADZUNA_APP_KEY` | From https://developer.adzuna.com | Optional |

Then go to **Deployments → Redeploy** to apply the env vars.

## 🏃 Run Locally

```bash
npm install
cp .env.example .env.local
# Fill in your API keys in .env.local
npm run dev
# Open http://localhost:3000
```

## 📦 Job Sources
- **Remotive** — Remote tech jobs (free, no key needed)
- **The Muse** — Broad job listings (free, no key needed)  
- **Adzuna** — Large aggregator with salary data (free key at developer.adzuna.com)

## 🤖 AI Features (require Anthropic API key)
- Match scoring (0–100) for every job vs your profile
- Tailored cover letter generation
- Resume bullet point suggestions

## 📁 Structure
```
pages/
  index.js          # Main dashboard UI
  api/
    jobs.js         # Server-side job fetcher (no CORS issues)
    ai.js           # Claude API proxy
styles/
  globals.css
```
