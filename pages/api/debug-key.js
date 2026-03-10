export default function handler(req, res) {
  const key = process.env.ANTHROPIC_API_KEY || "NOT SET";
  res.json({
    keyPrefix: key.slice(0, 20) + "...",
    keyLength: key.length,
    set: !!process.env.ANTHROPIC_API_KEY,
  });
}
