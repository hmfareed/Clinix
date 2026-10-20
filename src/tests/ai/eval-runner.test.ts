import { describe, it, expect } from "vitest";
import { runGoldenCase, runEvaluationSuite } from "@/lib/ai/eval/eval-runner";
import { GOLDEN_CASES } from "@/lib/ai/eval/golden-cases";

describe("AI Golden Case Evaluation Runner", () => {
  it("detects cardiac emergency case with zero missed emergency", async () => {
    const cardiacCase = GOLDEN_CASES.find((c) => c.id === "GOLD-EM-001")!;
    const result = await runGoldenCase(cardiacCase);

    expect(result.actualUrgency).toBe("emergency");
    expect(result.passed).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it("detects respiratory failure case with zero missed emergency", async () => {
    const respCase = GOLDEN_CASES.find((c) => c.id === "GOLD-EM-002")!;
    const result = await runGoldenCase(respCase);

    expect(result.actualUrgency).toBe("emergency");
    expect(result.passed).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it("escalates suspected meningitis case to urgent floor", async () => {
    const meningCase = GOLDEN_CASES.find((c) => c.id === "GOLD-URG-001")!;
    const result = await runGoldenCase(meningCase);

    expect(["emergency", "urgent"]).toContain(result.actualUrgency);
    expect(result.passed).toBe(true);
  });

  it("runs full evaluation suite and verifies zero missed emergencies", async () => {
    const report = await runEvaluationSuite(
      GOLDEN_CASES.filter((c) => c.category === "emergency" || c.category === "urgent")
    );

    expect(report.missedEmergencies).toBe(0);
    expect(report.totalCases).toBeGreaterThanOrEqual(3);
    expect(report.passRate).toBe(100);
  });
});
