import type { VercelRequest, VercelResponse } from "@vercel/node";
import { applyHeaders } from "./_shared.js";
export default function handler(_req: VercelRequest, res: VercelResponse) {
  applyHeaders(res);
  return res.status(200).json({
    status: "ok",
    version: "1.0.0-beta.1",
    integrations: {
      gemini: Boolean(process.env.GEMINI_API_KEY),
      supabase: Boolean(
        process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY,
      ),
    },
    time: new Date().toISOString(),
  });
}
