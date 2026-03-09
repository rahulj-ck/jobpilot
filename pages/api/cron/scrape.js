// pages/api/cron/scrape.js
// Vercel cron job — runs every 6 hours automatically
// Scrapes all job boards and saves to Supabase

import { scrapeAll } from "../../../lib/scraper";
import { upsertJobs } from "../../../lib/supabase";

export default async function handler(req, res) {
  // Protect endpoint — only Vercel cron or requests with secret can trigger
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  console.log("[cron] Scrape job started at", new Date().toISOString());
  const startTime = Date.now();

  try {
    // 1. Scrape all sources
    const { jobs, counts } = await scrapeAll();

    // 2. Save to Supabase
    const saved = await upsertJobs(jobs);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[cron] Done in ${duration}s. Saved ${saved} jobs.`);

    return res.status(200).json({
      success: true,
      duration: `${duration}s`,
      counts,
      total: saved,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[cron] Error:", error);
    return res.status(500).json({ error: error.message });
  }
}

// Tell Vercel this can run for up to 300 seconds (max for Pro, 10s for Hobby)
export const config = {
  maxDuration: 300,
};
