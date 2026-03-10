// scripts/config.js — loads profile + env for the apply script
require("dotenv").config({ path: ".env.local" });

function required(key) {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

module.exports = {
  supabaseUrl: required("SUPABASE_URL"),
  supabaseServiceKey: required("SUPABASE_SERVICE_KEY"),
  anthropicKey: required("ANTHROPIC_API_KEY"),

  // Your profile — loaded from env so the script is portable
  profile: {
    firstName:       process.env.APPLY_FIRST_NAME   || "Rahul",
    lastName:        process.env.APPLY_LAST_NAME    || "",
    email:           required("APPLY_EMAIL"),
    phone:           process.env.APPLY_PHONE        || "",
    linkedin:        process.env.APPLY_LINKEDIN     || "",
    resumePath:      required("APPLY_RESUME_PATH"),  // local path to your PDF
    title:           process.env.APPLY_TITLE        || "Senior Frontend Engineer",
    skills:          process.env.APPLY_SKILLS       || "React, TypeScript, Node.js",
    experience:      process.env.APPLY_EXPERIENCE   || "5 years",
    bio:             process.env.APPLY_BIO          || "",
    workAuth:        process.env.APPLY_WORK_AUTH    || "yes",   // yes | no | visa
    needSponsorship: process.env.APPLY_SPONSORSHIP  || "no",    // yes | no
    salaryMin:       process.env.APPLY_SALARY_MIN   || "140000",
    salaryMax:       process.env.APPLY_SALARY_MAX   || "200000",
    school:          process.env.APPLY_SCHOOL         || "University of Delhi",
    degree:          process.env.APPLY_DEGREE         || "Bachelor's in Computer Science",
    discipline:      process.env.APPLY_DISCIPLINE     || "Computer Science",
  },

  // Apply run settings
  maxPerRun:     parseInt(process.env.APPLY_MAX_PER_RUN  || "20"),
  delayMin:      parseInt(process.env.APPLY_DELAY_MIN    || "30"),  // seconds between apps
  delayMax:      parseInt(process.env.APPLY_DELAY_MAX    || "90"),
  dryRun:        process.argv.includes("--dry-run"),
  headless:      !process.argv.includes("--visible"),  // run headless by default
};
