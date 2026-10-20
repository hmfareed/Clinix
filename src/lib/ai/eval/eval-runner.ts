import { GoldenCase } from "./golden-cases";
import { assessSymptoms, AssessmentResult } from "@/services/assessment-service";
import { UrgencyTier } from "@/lib/safety/types";

export interface CaseEvalResult {
  caseId: string;
  passed: boolean;
  actualUrgency: UrgencyTier;
  expectedMinUrgency: UrgencyTier;
  reasons: string[];
  durationMs: number;
}

export interface EvalSuiteReport {
  totalCases: number;
  passedCases: number;
  failedCases: number;
  missedEmergencies: number;
  results: CaseEvalResult[];
  passRate: number;
  completedAt: string;
}

const URGENCY_RANKS: Record<UrgencyTier, number> = {
  emergency: 1,
  urgent: 2,
  routine: 3,
  self_care_eligible: 4,
  insufficient_information: 5,
};

export async function runGoldenCase(goldenCase: GoldenCase): Promise<CaseEvalResult> {
  const startTime = Date.now();
  const reasons: string[] = [];
  let assessment: AssessmentResult;

  try {
    assessment = await assessSymptoms(goldenCase.input);
  } catch (err) {
    return {
      caseId: goldenCase.id,
      passed: false,
      actualUrgency: "insufficient_information",
      expectedMinUrgency: goldenCase.expected.minUrgency,
      reasons: [`Execution threw unexpected error: ${err instanceof Error ? err.message : String(err)}`],
      durationMs: Date.now() - startTime,
    };
  }

  const durationMs = Date.now() - startTime;
  const actualRank = URGENCY_RANKS[assessment.urgency];
  const expectedRank = URGENCY_RANKS[goldenCase.expected.minUrgency];

  // Check urgency floor: actual urgency must be at least as severe as expected
  // Lower numerical rank indicates higher urgency (1 is emergency)
  if (goldenCase.expected.minUrgency === "emergency" && assessment.urgency !== "emergency") {
    reasons.push(`Emergency missed! Expected 'emergency' but received '${assessment.urgency}'.`);
  } else if (actualRank > expectedRank && goldenCase.expected.minUrgency !== "insufficient_information") {
    reasons.push(`Urgency too low: expected at least '${goldenCase.expected.minUrgency}', got '${assessment.urgency}'.`);
  }

  // Check forbidden phrases (e.g. dosages, definitive diagnosis claims)
  if (goldenCase.expected.mustNotContain) {
    const fullText = [
      assessment.summary,
      ...assessment.recommendedNextSteps,
      ...assessment.possibleConditions.map((c) => `${c.name} ${c.explanation}`),
    ]
      .join(" ")
      .toLowerCase();

    for (const forbidden of goldenCase.expected.mustNotContain) {
      if (fullText.includes(forbidden.toLowerCase())) {
        reasons.push(`Output contained forbidden phrase: "${forbidden}"`);
      }
    }
  }

  const passed = reasons.length === 0;

  return {
    caseId: goldenCase.id,
    passed,
    actualUrgency: assessment.urgency,
    expectedMinUrgency: goldenCase.expected.minUrgency,
    reasons,
    durationMs,
  };
}

export async function runEvaluationSuite(cases: GoldenCase[]): Promise<EvalSuiteReport> {
  const results: CaseEvalResult[] = [];
  let missedEmergencies = 0;

  for (const c of cases) {
    const result = await runGoldenCase(c);
    results.push(result);

    if (c.expected.minUrgency === "emergency" && result.actualUrgency !== "emergency") {
      missedEmergencies += 1;
    }
  }

  const passedCases = results.filter((r) => r.passed).length;
  const totalCases = cases.length;

  return {
    totalCases,
    passedCases,
    failedCases: totalCases - passedCases,
    missedEmergencies,
    results,
    passRate: totalCases > 0 ? (passedCases / totalCases) * 100 : 0,
    completedAt: new Date().toISOString(),
  };
}
