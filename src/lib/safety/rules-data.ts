import { TriageRule } from "./types";

export const DEFAULT_RULESET_VERSION = "clinix-reviewed-v1.0";

export const REVIEWED_TRIAGE_RULES: TriageRule[] = [
  // ==========================================
  // LEVEL 1: EMERGENCY (Life-threatening)
  // ==========================================
  {
    id: "EM-RESP-001",
    version: DEFAULT_RULESET_VERSION,
    level: 1,
    category: "respiratory",
    patterns: {
      keywords: ["dyspnea", "stridor", "cyanosis", "asphyxia", "apnea", "suffocating", "choking"],
      phrases: [
        "cannot breathe",
        "cant breathe",
        "can't breathe",
        "hard to breathe",
        "struggling to breathe",
        "gasping for air",
        "short of breath",
        "shortness of breath",
        "shrot of breth",
        "cant catch my breath",
        "lips turning blue",
        "blue lips",
        "severe asthma attack",
        "throat closing",
      ],
      structured: [
        { field: "vitals.oxygenSaturation", op: "lte", value: 90 },
      ],
    },
    patientMessageKey: "emergency_respiratory",
    nextStepsKey: "emergency_steps",
    reviewedBy: "Dr. K. Mensah (Emergency Medicine Reviewer)",
    reviewedAt: "2026-10-01T00:00:00Z",
  },
  {
    id: "EM-CARD-001",
    version: DEFAULT_RULESET_VERSION,
    level: 1,
    category: "cardiovascular",
    patterns: {
      keywords: ["infarction", "angina"],
      phrases: [
        "chest pain",
        "chest pressure",
        "crushing chest",
        "tight chest",
        "elephant on my chest",
        "pain in left arm",
        "pain radiating to jaw",
        "heart attack",
        "hart attack",
        "crushing pain in chest",
        "chest squeezing",
        "severe chest heaviness",
      ],
    },
    patientMessageKey: "emergency_cardiac",
    nextStepsKey: "emergency_steps",
    reviewedBy: "Dr. K. Mensah (Emergency Medicine Reviewer)",
    reviewedAt: "2026-10-01T00:00:00Z",
  },
  {
    id: "EM-NEURO-001",
    version: DEFAULT_RULESET_VERSION,
    level: 1,
    category: "neurological",
    patterns: {
      keywords: ["unconscious", "unresponsive", "syncope", "seizure", "convulsion", "coma", "thunderclap"],
      phrases: [
        "loss of consciousness",
        "passed out",
        "fell unconscious",
        "face drooping",
        "facial droop",
        "arm weakness",
        "slurred speech",
        "sudden numbness",
        "suspected stroke",
        "cannot wake",
        "wont wake up",
        "having a seizure",
        "violent shaking",
        "unconcious",
        "thunderclap headache",
        "thunderclap",
        "worst headache of my life",
        "worst headache",
        "sudden severe headache",
        "sudden explosive headache",
      ],
    },
    patientMessageKey: "emergency_stroke_neuro",
    nextStepsKey: "emergency_steps",
    reviewedBy: "Dr. E. Appiah (Clinical Governance)",
    reviewedAt: "2026-10-01T00:00:00Z",
  },
  {
    id: "EM-TRAUMA-001",
    version: DEFAULT_RULESET_VERSION,
    level: 1,
    category: "trauma_hemorrhage",
    patterns: {
      keywords: ["hemorrhage", "arterial", "exsanguination"],
      phrases: [
        "severe bleeding",
        "spurting blood",
        "uncontrolled bleeding",
        "bleeding heavily",
        "wont stop bleeding",
        "blood pouring",
        "deep stab wound",
        "coughing up large amounts of blood",
        "vomiting coffee ground blood",
      ],
    },
    patientMessageKey: "emergency_bleeding",
    nextStepsKey: "emergency_steps",
    reviewedBy: "Dr. K. Mensah (Emergency Medicine Reviewer)",
    reviewedAt: "2026-10-01T00:00:00Z",
  },
  {
    id: "EM-ANAPH-001",
    version: DEFAULT_RULESET_VERSION,
    level: 1,
    category: "anaphylaxis",
    patterns: {
      keywords: ["anaphylaxis"],
      phrases: [
        "allergic reaction swelling",
        "swollen tongue",
        "swollen lips and hard to breathe",
        "throat swelling shut",
        "severe peanut reaction",
        "bee sting breathing trouble",
      ],
    },
    patientMessageKey: "emergency_anaphylaxis",
    nextStepsKey: "emergency_steps",
    reviewedBy: "Dr. E. Appiah (Clinical Governance)",
    reviewedAt: "2026-10-01T00:00:00Z",
  },
  {
    id: "EM-TOX-001",
    version: DEFAULT_RULESET_VERSION,
    level: 1,
    category: "toxicology",
    patterns: {
      keywords: ["poisoned", "overdose", "pesticide"],
      phrases: [
        "swallowed poison",
        "drank bleach",
        "drank kerosene",
        "overdosed on pills",
        "took too many pills",
        "chemical swallowed",
      ],
    },
    patientMessageKey: "emergency_toxicology",
    nextStepsKey: "emergency_steps",
    reviewedBy: "Dr. E. Appiah (Clinical Governance)",
    reviewedAt: "2026-10-01T00:00:00Z",
  },
  {
    id: "EM-PED-001",
    version: DEFAULT_RULESET_VERSION,
    level: 1,
    category: "pediatric",
    patterns: {
      keywords: ["lethargic", "floppy"],
      phrases: [
        "baby won't wake up",
        "baby not responsive",
        "infant turning blue",
        "newborn high fever",
      ],
      structured: [
        { field: "age", op: "lte", value: 0.25 }, // under 3 months
        { field: "vitals.temperatureC", op: "gte", value: 38.0 },
      ],
    },
    appliesTo: { maxAge: 1 },
    patientMessageKey: "emergency_pediatric",
    nextStepsKey: "emergency_steps",
    reviewedBy: "Dr. E. Appiah (Clinical Governance)",
    reviewedAt: "2026-10-01T00:00:00Z",
  },

  // ==========================================
  // LEVEL 2: URGENT (Prompt clinical review)
  // ==========================================
  {
    id: "URG-MENING-001",
    version: DEFAULT_RULESET_VERSION,
    level: 2,
    category: "neurological",
    patterns: {
      keywords: ["photophobia"],
      phrases: [
        "stiff neck and fever",
        "fever and neck stiffness",
        "cannot bend neck",
        "light hurts eyes with fever",
        "stiff neck",
        "neck is so stiff",
        "neck is stiff",
        "neck stiffness",
      ],
    },
    patientMessageKey: "urgent_meningitis_suspect",
    nextStepsKey: "urgent_steps",
    reviewedBy: "Dr. K. Mensah (Emergency Medicine Reviewer)",
    reviewedAt: "2026-10-01T00:00:00Z",
  },
  {
    id: "URG-ABD-001",
    version: DEFAULT_RULESET_VERSION,
    level: 2,
    category: "general",
    patterns: {
      keywords: ["appendicitis"],
      phrases: [
        "severe stomach pain",
        "severe abdominal pain",
        "sharp lower right stomach pain",
        "vomiting for 2 days",
        "unable to keep water down",
      ],
    },
    patientMessageKey: "urgent_abdominal",
    nextStepsKey: "urgent_steps",
    reviewedBy: "Dr. K. Mensah (Emergency Medicine Reviewer)",
    reviewedAt: "2026-10-01T00:00:00Z",
  },
  {
    id: "URG-FEV-001",
    version: DEFAULT_RULESET_VERSION,
    level: 2,
    category: "general",
    patterns: {
      keywords: ["hyperpyrexia"],
      phrases: ["fever over 40", "very high fever", "burning up with shaking"],
      structured: [
        { field: "vitals.temperatureC", op: "gte", value: 39.5 },
      ],
    },
    patientMessageKey: "urgent_fever",
    nextStepsKey: "urgent_steps",
    reviewedBy: "Dr. E. Appiah (Clinical Governance)",
    reviewedAt: "2026-10-01T00:00:00Z",
  },

  // ==========================================
  // LEVEL 3: ROUTINE (Standard evaluation)
  // ==========================================
  {
    id: "ROUT-MILD-001",
    version: DEFAULT_RULESET_VERSION,
    level: 3,
    category: "general",
    patterns: {
      keywords: ["scratchy"],
      phrases: [
        "mild runny nose",
        "slight cough",
        "sneezing a little",
        "mild headache since morning",
        "scratchy throat",
      ],
    },
    patientMessageKey: "routine_mild",
    nextStepsKey: "routine_steps",
    reviewedBy: "Dr. E. Appiah (Clinical Governance)",
    reviewedAt: "2026-10-01T00:00:00Z",
  },
];

export const PATIENT_MESSAGES: Record<string, string> = {
  emergency_respiratory:
    "You have reported severe difficulty breathing or signs of respiratory failure. This is a medical emergency requiring immediate professional care.",
  emergency_cardiac:
    "You are experiencing symptoms that could indicate an acute cardiac event (such as a heart attack). Do not delay seeking emergency help.",
  emergency_stroke_neuro:
    "You have described warning signs of a stroke, seizure, or sudden neurological compromise. Immediate medical intervention is critical.",
  emergency_bleeding:
    "You are reporting severe or uncontrolled bleeding. Immediate emergency care and pressure to the wound are required.",
  emergency_anaphylaxis:
    "You have described symptoms consistent with a severe systemic allergic reaction (anaphylaxis). Immediate emergency medical attention is needed.",
  emergency_toxicology:
    "You have reported ingestion of a hazardous chemical or potential overdose. Immediate emergency toxicology evaluation is required.",
  emergency_pediatric:
    "The symptoms described in this infant or child represent a potential pediatric emergency requiring immediate hospital evaluation.",
  urgent_meningitis_suspect:
    "High fever accompanied by neck stiffness requires urgent in-person medical evaluation to rule out acute infections such as meningitis.",
  urgent_abdominal:
    "Severe abdominal pain or inability to retain fluids requires prompt clinical examination at an urgent care clinic or hospital today.",
  urgent_fever:
    "A very high temperature requires prompt medical evaluation by a clinician today.",
  routine_mild:
    "Your reported symptoms appear consistent with a condition that can be evaluated during routine primary care hours if they persist.",
  default_emergency:
    "You have reported symptoms that match emergency warning criteria. Immediate medical attention is strongly advised.",
};

export const NEXT_STEPS_CATALOG: Record<string, string[]> = {
  emergency_steps: [
    "Call 112 immediately to request the Ghana National Ambulance Service, or proceed to the nearest emergency room.",
    "Do not attempt to drive yourself. Have someone stay with you.",
    "Rest quietly in a comfortable position (sitting upright often helps with breathing difficulty).",
    "Do not eat, drink, or take medications unless specifically directed by emergency medical staff.",
  ],
  urgent_steps: [
    "Visit a hospital emergency department or urgent care clinic today for evaluation.",
    "Stay hydrated if you are able to drink fluids safely.",
    "If your condition worsens or you experience shortness of breath or fainting, dial 112 immediately.",
  ],
  routine_steps: [
    "Book an appointment with a primary care doctor or local clinic.",
    "Monitor your symptoms and rest.",
    "Seek urgent medical evaluation if your symptoms worsen or do not improve within 48 to 72 hours.",
  ],
};
