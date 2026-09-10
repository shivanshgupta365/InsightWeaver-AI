import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHash } from "node:crypto";
import { z } from "zod";

export const aiAnalysisSchema = z.object({
  executiveSummary: z.string().min(1).max(3000),
  findings: z
    .array(
      z.object({
        statement: z.string().min(1).max(1000),
        evidenceRefs: z.array(z.string().min(1)).max(8),
      }),
    )
    .max(10),
  risks: z
    .array(
      z.object({
        statement: z.string().min(1).max(1000),
        evidenceRefs: z.array(z.string().min(1)).max(8),
      }),
    )
    .max(10),
  recommendedActions: z
    .array(
      z.object({
        action: z.string().min(1).max(1000),
        evidenceRefs: z.array(z.string().min(1)).max(8),
      }),
    )
    .max(10),
  assumptions: z.array(z.string().max(500)).max(10),
});
export const contextSchema = z
  .object({
    taskType: z.enum(["executive_brief", "risk_review", "next_actions"]),
    schemaProfile: z
      .array(
        z.object({
          originalName: z.string(),
          canonicalName: z.string(),
          inferredRole: z.string(),
          dataType: z.string(),
          nullCount: z.number(),
          uniqueCount: z.number(),
          examples: z
            .array(z.union([z.string(), z.number(), z.boolean(), z.null()]))
            .max(3),
          ambiguity: z.string().optional(),
        }),
      )
      .max(200),
    aggregateMetrics: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          value: z.union([z.number(), z.string()]),
          format: z.string(),
          currency: z.string().optional(),
          evidence: z.string(),
        }),
      )
      .max(30),
    validationFindings: z
      .array(
        z.object({
          ruleId: z.string(),
          label: z.string(),
          severity: z.string(),
          status: z.string(),
          count: z.number(),
          message: z.string(),
          evidence: z.record(z.string(), z.unknown()),
        }),
      )
      .max(200),
    workflowTrace: z
      .array(
        z.object({
          id: z.string(),
          step: z.string(),
          at: z.string(),
          beforeCount: z.number(),
          afterCount: z.number(),
          detail: z.string(),
        }),
      )
      .max(30),
    conversationContext: z.string().max(4000).optional(),
    consent: z.literal(true),
    redactedSampleRows: z
      .array(
        z.record(
          z.string(),
          z.union([z.string(), z.number(), z.boolean(), z.null()]),
        ),
      )
      .max(5)
      .optional(),
  })
  .strict();

export function clientHash(req: VercelRequest) {
  const ip = String(
    req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "unknown",
  ).split(",")[0];
  return createHash("sha256")
    .update(`${process.env.AI_RATE_LIMIT_SALT ?? "local-development"}:${ip}`)
    .digest("hex");
}
export function applyHeaders(res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
}
export function evidenceIds(body: z.infer<typeof contextSchema>) {
  return new Set([
    ...body.aggregateMetrics.map((x) => x.evidence),
    ...body.aggregateMetrics.map((x) => x.id),
    ...body.validationFindings.map((x) => x.ruleId),
    ...body.workflowTrace.map((x) => `workflow:${x.step.toLowerCase()}`),
    ...body.workflowTrace.map((x) => x.id),
  ]);
}
