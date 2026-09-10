import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { analyzeRows } from "./engine";
import { createArtifactBundle } from "./export";
import type { Project } from "../types";

describe("artifact bundle", () => {
  it("exports actual normalized data and all promised files", async () => {
    const run = await analyzeRows(
      [{ id: "proof-731", revenue: 731, currency: "INR" }],
      { name: "proof.json", type: "json", size: 50 },
    );
    const project: Project = {
      id: "11111111-1111-4111-8111-111111111111",
      name: "Proof",
      description: "fixture",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schemaVersion: 1,
      source: "guest",
      run,
    };
    const bytes = new Uint8Array(
      await createArtifactBundle(project, run).arrayBuffer(),
    );
    const files = unzipSync(bytes);
    expect(Object.keys(files).sort()).toEqual([
      "dashboard.json",
      "executive-brief.md",
      "manifest.json",
      "normalized.csv",
      "report.json",
      "schema.json",
      "validation.json",
      "workflow.json",
    ]);
    expect(strFromU8(files["normalized.csv"]!)).toContain("proof-731");
    expect(strFromU8(files["normalized.csv"]!)).toContain("731");
  });
});
