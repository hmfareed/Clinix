import { describe, it, expect } from "vitest";
import { checkEmergencyRules, normalizeClinicalText } from "@/lib/safety/triage-engine";
import { REVIEWED_TRIAGE_RULES } from "@/lib/safety/rules-data";

describe("Triage Rule Engine - Normalization", () => {
  it("normalizes text and remedies common typos", () => {
    expect(normalizeClinicalText("SHROT OF BRETH!!!")).toBe("short of breath");
    expect(normalizeClinicalText("I had a hart attack")).toBe("i had a heart attack");
    expect(normalizeClinicalText("Patient is unconcious.")).toBe("patient is unconscious");
    expect(normalizeClinicalText("Bleedng from deep wound")).toBe("bleeding from deep wound");
  });
});

describe("Triage Rule Engine - Emergency Level 1 Invariants", () => {
  it("detects textbook respiratory failure symptoms", () => {
    const res = checkEmergencyRules({ text: "Patient has severe cyanosis and stridor" });
    expect(res.emergencyDetected).toBe(true);
    expect(res.floor).toBe("emergency");
    expect(res.matchedRuleIds).toContain("EM-RESP-001");
  });

  it("detects colloquial and paraphrased respiratory distress", () => {
    const phrases = [
      "I can't breathe at all right now",
      "I am gasping for air and my lips are turning blue",
      "cant catch my breath and throat closing",
      "having severe shrot of breth",
    ];

    for (const phrase of phrases) {
      const res = checkEmergencyRules({ text: phrase });
      expect(res.emergencyDetected).toBe(true);
      expect(res.floor).toBe("emergency");
      expect(res.matchedRuleIds).toContain("EM-RESP-001");
    }
  });

  it("detects respiratory emergency through structured vitals (SpO2 <= 90)", () => {
    const res = checkEmergencyRules({
      text: "Feeling tired",
      vitals: { oxygenSaturation: 88 },
    });
    expect(res.emergencyDetected).toBe(true);
    expect(res.floor).toBe("emergency");
    expect(res.matchedRuleIds).toContain("EM-RESP-001");
  });

  it("detects acute cardiovascular emergencies with textbook and colloquial phrasing", () => {
    const cardiacCases = [
      "I have crushing chest pain radiating to my jaw",
      "Feels like an elephant on my chest and severe chest heaviness",
      "My dad is having a hart attack with pain in left arm",
      "Sudden tight chest and severe chest squeezing",
    ];

    for (const phrase of cardiacCases) {
      const res = checkEmergencyRules({ text: phrase });
      expect(res.emergencyDetected).toBe(true);
      expect(res.floor).toBe("emergency");
      expect(res.matchedRuleIds).toContain("EM-CARD-001");
    }
  });

  it("detects acute stroke and neurological warning signs (FAST)", () => {
    const neuroCases = [
      "Sudden face drooping and slurred speech",
      "My sister has arm weakness on one side and sudden numbness",
      "He had a loss of consciousness and fell unconscious",
      "Person passed out and is unconcious",
      "Active violent shaking and having a seizure",
    ];

    for (const phrase of neuroCases) {
      const res = checkEmergencyRules({ text: phrase });
      expect(res.emergencyDetected).toBe(true);
      expect(res.floor).toBe("emergency");
      expect(res.matchedRuleIds).toContain("EM-NEURO-001");
    }
  });

  it("detects severe trauma and uncontrolled bleeding", () => {
    const bleedCases = [
      "There is severe bleeding and spurting blood from the leg",
      "Deep stab wound with blood pouring out uncontrollably",
      "Vomiting coffee ground blood heavily",
    ];

    for (const phrase of bleedCases) {
      const res = checkEmergencyRules({ text: phrase });
      expect(res.emergencyDetected).toBe(true);
      expect(res.floor).toBe("emergency");
      expect(res.matchedRuleIds).toContain("EM-TRAUMA-001");
    }
  });

  it("detects systemic anaphylaxis emergencies", () => {
    const anaphCases = [
      "Allergic reaction swelling with swollen tongue and hard to breathe",
      "Bee sting breathing trouble and throat swelling shut",
      "Severe peanut reaction and lips swelling",
    ];

    for (const phrase of anaphCases) {
      const res = checkEmergencyRules({ text: phrase });
      expect(res.emergencyDetected).toBe(true);
      expect(res.floor).toBe("emergency");
      expect(res.matchedRuleIds).toContain("EM-ANAPH-001");
    }
  });

  it("detects toxicology emergencies", () => {
    const toxCases = [
      "Child drank bleach in the kitchen",
      "Someone swallowed poison",
      "Patient took too many pills and overdosed on pills",
    ];

    for (const phrase of toxCases) {
      const res = checkEmergencyRules({ text: phrase });
      expect(res.emergencyDetected).toBe(true);
      expect(res.floor).toBe("emergency");
      expect(res.matchedRuleIds).toContain("EM-TOX-001");
    }
  });

  it("detects pediatric emergency red flags with age constraints", () => {
    // 2-month-old infant with high fever
    const res = checkEmergencyRules({
      text: "Baby is warm",
      age: 0.16, // ~2 months
      vitals: { temperatureC: 38.5 },
    });
    expect(res.emergencyDetected).toBe(true);
    expect(res.floor).toBe("emergency");
    expect(res.matchedRuleIds).toContain("EM-PED-001");

    // 25-year-old adult with 38.5C fever should NOT trigger pediatric emergency
    const adultRes = checkEmergencyRules({
      text: "Warm forehead",
      age: 25,
      vitals: { temperatureC: 38.5 },
    });
    expect(adultRes.matchedRuleIds).not.toContain("EM-PED-001");
  });
});

describe("Triage Rule Engine - Level 2 (Urgent) & Level 3 (Routine)", () => {
  it("detects urgent suspected meningitis presentation", () => {
    const res = checkEmergencyRules({ text: "Patient has a stiff neck and fever with photophobia" });
    expect(res.emergencyDetected).toBe(false);
    expect(res.floor).toBe("urgent");
    expect(res.matchedRuleIds).toContain("URG-MENING-001");
  });

  it("detects urgent severe abdominal pain", () => {
    const res = checkEmergencyRules({ text: "Experiencing sharp lower right stomach pain for 8 hours" });
    expect(res.emergencyDetected).toBe(false);
    expect(res.floor).toBe("urgent");
    expect(res.matchedRuleIds).toContain("URG-ABD-001");
  });

  it("detects routine mild symptoms without escalating to emergency", () => {
    const res = checkEmergencyRules({ text: "I have a mild runny nose and slight cough today" });
    expect(res.emergencyDetected).toBe(false);
    expect(res.floor).toBe("routine");
    expect(res.matchedRuleIds).toContain("ROUT-MILD-001");
  });

  it("does NOT falsely trigger emergency or urgent for ordinary complaints", () => {
    const benignCases = [
      "I have a mild papercut on my index finger",
      "Feeling a bit sleepy after a long work day",
      "Need advice on healthy vegetables for dinner",
    ];

    for (const text of benignCases) {
      const res = checkEmergencyRules({ text });
      expect(res.emergencyDetected).toBe(false);
      expect(res.floor).toBeNull();
      expect(res.matchedRuleIds).toHaveLength(0);
    }
  });
});

describe("Triage Rule Engine - Mutation & Completeness Check", () => {
  it("every rule in the reviewed set has unique ID, valid category, and review metadata", () => {
    const ids = new Set<string>();
    for (const rule of REVIEWED_TRIAGE_RULES) {
      expect(ids.has(rule.id)).toBe(false);
      ids.add(rule.id);
      expect([1, 2, 3]).toContain(rule.level);
      expect(rule.reviewedBy).toBeTruthy();
      expect(rule.reviewedAt).toBeTruthy();
      expect(rule.patterns.keywords.length + rule.patterns.phrases.length + (rule.patterns.structured?.length || 0)).toBeGreaterThan(0);
    }
  });
});
