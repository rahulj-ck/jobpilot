// pages/api/jobs.js — reads from Supabase (instant, pre-scraped data)

import { queryJobs, getLastScrape } from "../../lib/supabase";

export default async function handler(req, res) {
  const { query = "" } = req.query;

  try {
    const [jobs, lastScrape] = await Promise.all([
      queryJobs(query, 200),
      getLastScrape(),
    ]);

    const counts = (jobs || []).reduce((acc, j) => {
      acc[j.source] = (acc[j.source] || 0) + 1;
      return acc;
    }, {});

    res.status(200).json({
      jobs: jobs || [],
      counts,
      lastScrape,
      total: jobs?.length || 0,
    });
  } catch (e) {
    console.error("Jobs API error:", e);
    res.status(500).json({ error: e.message, jobs: [], counts: {} });
  }
}
