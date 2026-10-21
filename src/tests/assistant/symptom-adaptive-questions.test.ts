import { describe, it, expect } from "vitest";
import {
  detectSymptomPathway,
  getNextAdaptiveQuestion,
  hasEnoughInfoForEvaluation,
  SYMPTOM_PATHWAYS,
  SymptomPathway,
} from "@/lib/assistant/symptom-adaptive-questions";

describe("Symptom-Adaptive Question Pathways", () => {
  describe("detectSymptomPathway", () => {
    it("detects respiratory pathway from cough/breathing keywords", () => {
      expect(detectSymptomPathway("I have had a bad dry cough and chest congestion")).toBe(
        "respiratory"
      );
      expect(detectSymptomPathway("Struggling with wheezing and shortness of breath")).toBe(
        "respiratory"
      );
    });

    it("detects gastrointestinal pathway from stomach/nausea/vomiting keywords", () => {
      expect(
        detectSymptomPathway("My stomach has been hurting since morning and I feel like vomiting")
      ).toBe("gastrointestinal");
      expect(detectSymptomPathway("Watery diarrhea and severe belly cramps")).toBe(
        "gastrointestinal"
      );
    });

    it("detects fever/systemic pathway from fever/malaria/chills keywords", () => {
      expect(detectSymptomPathway("High temperature, chills, sweating, and weakness")).toBe(
        "fever_systemic"
      );
      expect(detectSymptomPathway("I think I have malaria, feeling very hot and shivering")).toBe(
        "fever_systemic"
      );
    });

    it("detects headache/neurological pathway", () => {
      expect(detectSymptomPathway("Severe throbbing migraine behind my eyes and dizziness")).toBe(
        "headache_neuro"
      );
    });

    it("detects skin pathway", () => {
      expect(detectSymptomPathway("Red itchy rash and hives spreading on my arms")).toBe("skin");
    });

    it("detects musculoskeletal pathway", () => {
      expect(detectSymptomPathway("Severe lower back pain and stiff knee joint after falling")).toBe(
        "musculoskeletal"
      );
    });

    it("detects urinary pathway", () => {
      expect(detectSymptomPathway("Painful burning sensation when urinating frequently")).toBe(
        "urinary"
      );
    });

    it("defaults to general pathway when symptoms are non-specific", () => {
      expect(detectSymptomPathway("I just feel sick and unwell today")).toBe("general");
    });
  });

  describe("getNextAdaptiveQuestion", () => {
    it("returns the first question when no questions have been answered", () => {
      const q = getNextAdaptiveQuestion("respiratory", []);
      expect(q).not.toBeNull();
      expect(q?.id).toBe("resp_duration");
      expect(q?.options?.length).toBeGreaterThan(0);
    });

    it("returns subsequent questions as prior ones are answered", () => {
      const q1 = getNextAdaptiveQuestion("gastrointestinal", ["gi_location"]);
      expect(q1?.id).toBe("gi_duration");

      const q2 = getNextAdaptiveQuestion("gastrointestinal", [
        "gi_location",
        "gi_duration",
        "gi_severity",
      ]);
      expect(q2?.id).toBe("gi_associated");
    });

    it("returns null when all questions in the pathway have been answered", () => {
      const allGIQuestionIds = SYMPTOM_PATHWAYS.gastrointestinal.questions.map((q) => q.id);
      const q = getNextAdaptiveQuestion("gastrointestinal", allGIQuestionIds);
      expect(q).toBeNull();
    });
  });

  describe("hasEnoughInfoForEvaluation", () => {
    it("returns false if fewer turns than minQuestionsBeforeEvaluation", () => {
      const pathway: SymptomPathway = "respiratory";
      const ready = hasEnoughInfoForEvaluation(pathway, ["resp_duration", "resp_severity"], 2);
      expect(ready).toBe(false);
    });

    it("returns true when required questions are answered and min turns reached", () => {
      const pathway: SymptomPathway = "gastrointestinal";
      const requiredIds = SYMPTOM_PATHWAYS[pathway].questions
        .filter((q) => q.required)
        .map((q) => q.id);

      const ready = hasEnoughInfoForEvaluation(pathway, requiredIds, 4);
      expect(ready).toBe(true);
    });

    it("returns false if required questions are missing even if turn count is high", () => {
      const pathway: SymptomPathway = "respiratory";
      // Missing some required questions
      const ready = hasEnoughInfoForEvaluation(pathway, ["resp_duration"], 5);
      expect(ready).toBe(false);
    });
  });
});
