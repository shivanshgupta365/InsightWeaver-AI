import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  aiAnalysisSchema,
  applyHeaders,
  clientHash,
  contextSchema,
  evidenceIds,
} from "../_shared.js";

const attempts = new Map<
  string,
  { day: string; count: number; minute: number[] }
>();
function quota(hash: string) {
  const now = Date.now(),
    day = new Date().toISOString().slice(0, 10);
  const state = attempts.get(hash) ?? { day, count: 0, minute: [] };
  if (state.day !== day) {
    state.day = day;
    state.count = 0;
    state.minute = [];
  }
  state.minute = state.minute.filter((t) => now - t < 60_000);
  if (state.count >= 3 || state.minute.length >= 3) return false;
  state.count++;
  state.minute.push(now);
  attempts.set(hash, state);
  return true;
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req: VercRequest, res: VercelResponse) {
  applyHeaders(res);
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });
  const bytes = Buffer.byteLength(JSON.stringify(req.body ?? {}));
  if (bytes > 50 * 1024)
    return res.status(413).json({ error: "Analysis context exceeds 50 KB." });
  if (req.body?.file || req.body?.rows || req.body?.normalizedRows)
    return res
      .status(400)
      .json({ error: "Raw files and full row collections are not accepted." });
  const parsed = contextSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({
      error: "Invalid or unconsented analysis context.",
      details: parsed.error.issues.map((i) => i.path.join(".")),
    });
  const actor = clientHash(req);
  if (!quota(actor))
    return res.status(429).json({
      error:
        "Guest AI limit reached. Try again tomorrow or sign in when cloud mode is configured.",
    });
  const key = process.env.GEMINI_API_KEY,
    model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  if (!key)
    return res.status(503).json({
      error: "Gemini is not configured. Use the deterministic brief.",
    });
  const allowed = evidenceIds(parsed.data);
  const prompt = `You are a careful business analyst. Return concise JSON only. Every finding, risk and action must reference only evidence identifiers present in the supplied context. Never create a financial risk score or autonomous decision. Context:\n${JSON.stringify(parsed.data)}`;
  let failure = "Gemini request failed.";
  for (let n = 0; n < 3; n++) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": key,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              responseJsonSchema: {
                type: "object",
                required: [
                  "executiveSummary",
                  "findings",
                  "risks",
                  "recommendedActions",
                  "assumptions",
                ],
                properties: {
                  executiveSummary: { type: "string" },
                  findings: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["statement", "evidenceRefs"],
                      properties: {
                        statement: { type: "string" },
                        evidenceRefs: {
                          type: "array",
                          items: { type: "string" },
                        },
                      },
                    },
                  },
                  risks: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["statement", "evidenceRefs"],
                      properties: {
                        statement: { type: "string" },
                        evidenceRefs: {
                          type: "array",
                          items: { type: "string" },
                        },
                      },
                    },
                  },
                  recommendedActions: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["action", "evidenceRefs"],
                      properties: {
                        action: { type: "string" },
                        evidenceRefs: {
                          type: "array",
                          items: { type: "string" },
                        },
                      },
                    },
                  },
                  assumptions: { type: "array", items: { type: "string" } },
                },
              },
            },
          }),
          signal: AbortSignal.timeout(20_000),
        },
      );
      if (!response.ok) {
        failure = `Gemini returned ${response.status}.`;
        if (response.status < 500 && response.status !== 429) break;
        throw new Error(failure);
      }
      const raw = (await response.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = raw.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Gemini returned no structured content.");
      const checked = aiAnalysisSchema.safeParse(JSON.parse(text));
      if (!checked.success)
        throw new Error("Gemini response did not match the analysis contract.");
      const invalid = [
        ...checked.data.findings,
        ...checked.data.risks,
        ...checked.data.recommendedActions,
      ]
        .flatMap((x) => x.evidenceRefs)
        .filter((ref) => !allowed.has(ref));
      if (invalid.length)
        throw new Error("Gemini cited evidence that is not in this run.");
      return res.status(200).json({
        analysis: {
          ...checked.data,
          provider: "gemini",
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      failure = error instanceof Error ? error.message : failure;
      if (n < 2) await wait(250 * 2 ** n + Math.random() * 150);
    }
  }
  return res.status(503).json({ error: failure });
}
type VercRequest = VercelRequest;
