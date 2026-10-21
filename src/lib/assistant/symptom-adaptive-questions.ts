/**
 * Symptom-Adaptive Follow-Up Question System
 *
 * Maps patient-reported symptoms to clinical question pathways.
 * Each pathway contains a sequenced set of follow-up questions
 * tailored to the specific symptom presentation.
 *
 * Questions are reviewed for safety and intended to gather information
 * relevant to clinical urgency determination — NOT to diagnose.
 */

export type SymptomPathway =
  | "respiratory"
  | "gastrointestinal"
  | "fever_systemic"
  | "headache_neuro"
  | "skin"
  | "musculoskeletal"
  | "urinary"
  | "general";

export interface AdaptiveFollowUpQuestion {
  id: string;
  text: string;
  type: "single_choice" | "multiple_choice" | "free_text";
  options?: string[];
  /** Clinical category this question belongs to */
  category: "onset" | "duration" | "severity" | "location" | "associated" | "history";
  /** Minimum number of questions that must be asked before evaluation */
  required: boolean;
}

export interface SymptomPathwayDefinition {
  id: SymptomPathway;
  label: string;
  minQuestionsBeforeEvaluation: number;
  questions: AdaptiveFollowUpQuestion[];
}

// =============================================================================
// PATHWAY KEYWORD TRIGGERS
// =============================================================================

const PATHWAY_TRIGGERS: Record<SymptomPathway, string[]> = {
  respiratory: [
    "cough", "breathing", "breath", "chest", "wheeze", "wheezing", "asthma",
    "shortness", "inhaler", "phlegm", "sputum", "mucus", "congestion",
    "runny nose", "sore throat", "throat", "voice", "hoarse",
  ],
  gastrointestinal: [
    "stomach", "abdomen", "belly", "nausea", "vomit", "vomiting", "diarrhea",
    "diarrhoea", "constipation", "bloat", "gas", "cramp", "indigestion",
    "heartburn", "bowel", "stool", "poop", "food poisoning", "appetite",
    "eating", "swallowing",
  ],
  fever_systemic: [
    "fever", "temperature", "hot", "chills", "shivering", "sweating",
    "malaria", "typhoid", "flu", "influenza", "body ache", "body pain",
    "weakness", "fatigue", "tired", "lethargic",
  ],
  headache_neuro: [
    "headache", "head pain", "migraine", "dizzy", "dizziness", "vertigo",
    "lightheaded", "faint", "confused", "confusion", "memory", "numbness",
    "tingling", "balance", "vision", "blurry", "double vision",
  ],
  skin: [
    "rash", "itch", "itching", "swelling", "lesion", "wound", "skin burn", "burns",
    "blister", "hive", "urticaria", "red skin", "skin", "pimple", "boil",
    "abscess", "bruise", "yellow skin", "jaundice",
  ],
  musculoskeletal: [
    "joint", "bone", "muscle", "back pain", "backache", "knee", "ankle",
    "shoulder", "arm pain", "leg pain", "sprain", "strain", "fracture",
    "stiff", "stiffness", "swollen joint", "arthritis", "hip pain",
  ],
  urinary: [
    "urine", "urination", "urinate", "urinating", "pee", "peeing", "bladder",
    "kidney", "urinary", "burning urine", "frequent urination", "uti", "blood in urine",
    "dysuria",
  ],
  general: [],
};

// =============================================================================
// CLINICAL QUESTION PATHWAYS
// =============================================================================

const RESPIRATORY_QUESTIONS: AdaptiveFollowUpQuestion[] = [
  {
    id: "resp_duration",
    text: "How long have you had this cough or breathing difficulty?",
    type: "single_choice",
    options: ["Less than 24 hours", "1 to 3 days", "4 to 7 days", "More than a week", "Not sure"],
    category: "duration",
    required: true,
  },
  {
    id: "resp_severity",
    text: "How would you describe the severity of your breathing difficulty?",
    type: "single_choice",
    options: [
      "Mild — I can breathe but it feels uncomfortable",
      "Moderate — It's affecting my daily activity",
      "Severe — I'm struggling to breathe at rest",
      "No breathing difficulty, just cough",
    ],
    category: "severity",
    required: true,
  },
  {
    id: "resp_sputum",
    text: "Are you producing any phlegm or mucus when you cough?",
    type: "single_choice",
    options: ["No — dry cough", "Yes — clear or white", "Yes — yellow or green", "Yes — with blood", "Not sure"],
    category: "associated",
    required: true,
  },
  {
    id: "resp_fever",
    text: "Do you also have a fever, chills, or body aches?",
    type: "single_choice",
    options: ["Yes, fever and chills", "Yes, body aches only", "No", "Not sure"],
    category: "associated",
    required: true,
  },
  {
    id: "resp_triggers",
    text: "Does anything trigger or worsen your breathing symptoms?",
    type: "single_choice",
    options: ["Exercise or exertion", "Lying flat", "Exposure to dust or smoke", "Nothing specific", "Not sure"],
    category: "history",
    required: false,
  },
  {
    id: "resp_history",
    text: "Do you have a known history of asthma, allergies, or chronic lung conditions?",
    type: "single_choice",
    options: ["Yes — asthma", "Yes — allergies", "Yes — another lung condition", "No known history", "Not sure"],
    category: "history",
    required: false,
  },
];

const GASTROINTESTINAL_QUESTIONS: AdaptiveFollowUpQuestion[] = [
  {
    id: "gi_location",
    text: "Where exactly do you feel the stomach pain or discomfort?",
    type: "single_choice",
    options: ["Upper abdomen (stomach area)", "Lower abdomen", "Around the navel", "Right side", "Left side", "Across the whole abdomen", "No specific pain — just nausea"],
    category: "location",
    required: true,
  },
  {
    id: "gi_duration",
    text: "How long have you been experiencing these symptoms?",
    type: "single_choice",
    options: ["Less than 6 hours", "6 to 24 hours", "1 to 3 days", "More than 3 days", "Not sure"],
    category: "duration",
    required: true,
  },
  {
    id: "gi_severity",
    text: "How severe is the pain or discomfort?",
    type: "single_choice",
    options: ["Mild — bearable", "Moderate — quite uncomfortable", "Severe — very intense", "No pain, mainly nausea or vomiting"],
    category: "severity",
    required: true,
  },
  {
    id: "gi_associated",
    text: "Are you experiencing any of these alongside your stomach symptoms?",
    type: "single_choice",
    options: ["Vomiting", "Diarrhea (loose stools)", "Fever or chills", "Blood in stool or vomit", "None of these", "Not sure"],
    category: "associated",
    required: true,
  },
  {
    id: "gi_food",
    text: "Did symptoms start after eating a particular meal or food?",
    type: "single_choice",
    options: ["Yes, shortly after eating", "Yes, many hours after eating", "No connection to food", "Not sure"],
    category: "history",
    required: false,
  },
];

const FEVER_SYSTEMIC_QUESTIONS: AdaptiveFollowUpQuestion[] = [
  {
    id: "fever_duration",
    text: "How long have you had this fever or feeling of being unwell?",
    type: "single_choice",
    options: ["Less than 24 hours", "1 to 3 days", "4 to 7 days", "More than a week", "Not sure"],
    category: "duration",
    required: true,
  },
  {
    id: "fever_severity",
    text: "How high do you think your temperature is, or how severe is the fever?",
    type: "single_choice",
    options: ["Mild warmth — no thermometer", "Moderate — measured around 38°C / 100.4°F", "High — above 39°C / 102°F", "Extremely high or unable to measure", "Not sure"],
    category: "severity",
    required: true,
  },
  {
    id: "fever_chills_rash",
    text: "Are you experiencing any of the following?",
    type: "single_choice",
    options: ["Chills and shivering", "Sweating heavily", "Skin rash", "Chills and rash both", "None of these"],
    category: "associated",
    required: true,
  },
  {
    id: "fever_headache_pain",
    text: "Do you also have a headache or body / joint pains?",
    type: "single_choice",
    options: ["Severe headache", "Mild headache", "Mainly body and joint pain", "Both headache and body pain", "No headache or body pain"],
    category: "associated",
    required: true,
  },
  {
    id: "fever_travel",
    text: "Have you recently traveled to a rural area, forest, or region with mosquitoes or waterborne diseases?",
    type: "single_choice",
    options: ["Yes, within the past 2 weeks", "Yes, more than 2 weeks ago", "No recent travel", "Not sure"],
    category: "history",
    required: false,
  },
  {
    id: "fever_gi",
    text: "Do you also have nausea, vomiting, or diarrhea with the fever?",
    type: "single_choice",
    options: ["Yes, nausea and vomiting", "Yes, diarrhea", "Yes, all three", "No digestive symptoms"],
    category: "associated",
    required: false,
  },
];

const HEADACHE_NEURO_QUESTIONS: AdaptiveFollowUpQuestion[] = [
  {
    id: "head_location",
    text: "Where is the headache located?",
    type: "single_choice",
    options: ["Entire head", "Front (forehead / behind the eyes)", "One side only", "Back of the head", "Top of the head", "Not sure"],
    category: "location",
    required: true,
  },
  {
    id: "head_onset",
    text: "How did the headache start?",
    type: "single_choice",
    options: ["Suddenly — like a thunderclap", "Gradually over minutes to hours", "Slowly over a day or more", "Not sure"],
    category: "onset",
    required: true,
  },
  {
    id: "head_severity",
    text: "How severe is the headache right now?",
    type: "single_choice",
    options: ["Mild — manageable", "Moderate — hard to concentrate", "Severe — worst headache of my life", "Varies"],
    category: "severity",
    required: true,
  },
  {
    id: "head_associated",
    text: "Are you experiencing any of the following with the headache?",
    type: "single_choice",
    options: ["Fever and neck stiffness", "Vomiting or nausea", "Sensitivity to light or sound", "Vision changes or blurry vision", "None of these"],
    category: "associated",
    required: true,
  },
  {
    id: "head_duration",
    text: "How long have you had this headache?",
    type: "single_choice",
    options: ["Less than 4 hours", "4 to 24 hours", "1 to 3 days", "More than 3 days (recurring)"],
    category: "duration",
    required: true,
  },
];

const SKIN_QUESTIONS: AdaptiveFollowUpQuestion[] = [
  {
    id: "skin_location",
    text: "Where on your body is the rash, swelling, or skin problem?",
    type: "single_choice",
    options: ["Face or neck", "Arms or hands", "Trunk / chest / back", "Legs or feet", "Widespread — multiple areas", "Groin or private area"],
    category: "location",
    required: true,
  },
  {
    id: "skin_duration",
    text: "How long have you had this skin issue?",
    type: "single_choice",
    options: ["A few hours", "1 to 3 days", "4 to 7 days", "More than a week", "Not sure"],
    category: "duration",
    required: true,
  },
  {
    id: "skin_appearance",
    text: "How would you describe the skin appearance?",
    type: "single_choice",
    options: ["Red and raised bumps or hives", "Flat red patches", "Blisters or fluid-filled spots", "Swelling without visible rash", "Open sore or wound", "Yellowish skin"],
    category: "associated",
    required: true,
  },
  {
    id: "skin_itch_pain",
    text: "Is the affected area itchy, painful, or warm to touch?",
    type: "single_choice",
    options: ["Very itchy", "Painful and tender", "Warm or hot to touch", "All of these", "None — just visible change"],
    category: "severity",
    required: true,
  },
  {
    id: "skin_exposure",
    text: "Did you recently come into contact with anything new — a plant, animal, soap, food, medication or chemical?",
    type: "single_choice",
    options: ["Yes — new soap, detergent, or cosmetic", "Yes — plant or insect", "Yes — new medication", "Yes — food", "No new exposures", "Not sure"],
    category: "history",
    required: false,
  },
];

const MUSCULOSKELETAL_QUESTIONS: AdaptiveFollowUpQuestion[] = [
  {
    id: "msk_location",
    text: "Which part of your body has pain or swelling?",
    type: "single_choice",
    options: ["Back (lower)", "Back (upper)", "Knee", "Ankle or foot", "Shoulder or arm", "Hip", "Multiple joints", "Muscles generally"],
    category: "location",
    required: true,
  },
  {
    id: "msk_onset",
    text: "Did this pain start after an injury or did it come on gradually?",
    type: "single_choice",
    options: ["After an injury or fall", "After strenuous exercise", "Gradually without injury", "After waking up (stiffness)", "Not sure"],
    category: "onset",
    required: true,
  },
  {
    id: "msk_severity",
    text: "How severe is the pain on a scale?",
    type: "single_choice",
    options: ["Mild — aches but I can move normally", "Moderate — limits my movement", "Severe — I cannot bear weight or use the limb", "Varies throughout the day"],
    category: "severity",
    required: true,
  },
  {
    id: "msk_swelling",
    text: "Is there visible swelling, bruising, or deformity at the painful area?",
    type: "single_choice",
    options: ["Yes — swelling", "Yes — bruising", "Yes — looks deformed or out of place", "No visible change", "Not sure"],
    category: "associated",
    required: true,
  },
  {
    id: "msk_fever",
    text: "Do you also have a fever, warmth around the joint, or feel generally unwell?",
    type: "single_choice",
    options: ["Yes — fever and warm joint", "Yes — just feel generally unwell", "No fever or systemic symptoms"],
    category: "associated",
    required: false,
  },
];

const URINARY_QUESTIONS: AdaptiveFollowUpQuestion[] = [
  {
    id: "uti_symptom",
    text: "What urinary symptoms are you experiencing?",
    type: "single_choice",
    options: ["Burning or pain when urinating", "Needing to urinate very frequently", "Unable to urinate", "Blood in the urine", "Cloudy or smelly urine", "Multiple of these"],
    category: "associated",
    required: true,
  },
  {
    id: "uti_duration",
    text: "How long have you had these urinary symptoms?",
    type: "single_choice",
    options: ["Less than 24 hours", "1 to 3 days", "More than 3 days", "Not sure"],
    category: "duration",
    required: true,
  },
  {
    id: "uti_pain_location",
    text: "Do you also have pain in your lower abdomen, back, or side (flank)?",
    type: "single_choice",
    options: ["Lower abdominal pain", "Lower back pain", "Pain in the side / flank", "No additional pain"],
    category: "location",
    required: true,
  },
  {
    id: "uti_fever",
    text: "Do you have a fever, chills, or feel very unwell along with these symptoms?",
    type: "single_choice",
    options: ["Yes — fever and chills", "Yes — just feel generally unwell", "No fever or chills"],
    category: "associated",
    required: true,
  },
];

const GENERAL_QUESTIONS: AdaptiveFollowUpQuestion[] = [
  {
    id: "gen_duration",
    text: "How long have you been experiencing these symptoms?",
    type: "single_choice",
    options: ["Less than 24 hours", "1 to 3 days", "4 to 7 days", "More than a week", "Not sure"],
    category: "duration",
    required: true,
  },
  {
    id: "gen_severity",
    text: "How severe are your symptoms right now?",
    type: "single_choice",
    options: ["Mild — manageable", "Moderate — affecting daily activities", "Severe — intense distress", "Not sure"],
    category: "severity",
    required: true,
  },
  {
    id: "gen_fever",
    text: "Do you have a fever, chills, or sweating?",
    type: "single_choice",
    options: ["Yes — fever", "Yes — chills or sweating", "Both fever and chills", "No"],
    category: "associated",
    required: true,
  },
  {
    id: "gen_associated",
    text: "Are you experiencing any of the following?",
    type: "single_choice",
    options: [
      "Difficulty breathing or chest tightness",
      "Nausea or vomiting",
      "Headache",
      "None of these",
      "Multiple of these",
    ],
    category: "associated",
    required: true,
  },
  {
    id: "gen_worsening",
    text: "Are your symptoms getting worse, staying the same, or improving?",
    type: "single_choice",
    options: ["Getting worse quickly", "Getting worse slowly", "Staying about the same", "Improving slightly"],
    category: "onset",
    required: false,
  },
];

// =============================================================================
// PATHWAY DEFINITIONS
// =============================================================================

export const SYMPTOM_PATHWAYS: Record<SymptomPathway, SymptomPathwayDefinition> = {
  respiratory: {
    id: "respiratory",
    label: "Respiratory / Chest",
    minQuestionsBeforeEvaluation: 4,
    questions: RESPIRATORY_QUESTIONS,
  },
  gastrointestinal: {
    id: "gastrointestinal",
    label: "Stomach / Digestive",
    minQuestionsBeforeEvaluation: 4,
    questions: GASTROINTESTINAL_QUESTIONS,
  },
  fever_systemic: {
    id: "fever_systemic",
    label: "Fever / Systemic Illness",
    minQuestionsBeforeEvaluation: 4,
    questions: FEVER_SYSTEMIC_QUESTIONS,
  },
  headache_neuro: {
    id: "headache_neuro",
    label: "Headache / Neurological",
    minQuestionsBeforeEvaluation: 4,
    questions: HEADACHE_NEURO_QUESTIONS,
  },
  skin: {
    id: "skin",
    label: "Skin / Rash",
    minQuestionsBeforeEvaluation: 4,
    questions: SKIN_QUESTIONS,
  },
  musculoskeletal: {
    id: "musculoskeletal",
    label: "Joint / Muscle / Back Pain",
    minQuestionsBeforeEvaluation: 4,
    questions: MUSCULOSKELETAL_QUESTIONS,
  },
  urinary: {
    id: "urinary",
    label: "Urinary / Bladder",
    minQuestionsBeforeEvaluation: 4,
    questions: URINARY_QUESTIONS,
  },
  general: {
    id: "general",
    label: "General Symptoms",
    minQuestionsBeforeEvaluation: 4,
    questions: GENERAL_QUESTIONS,
  },
};

// =============================================================================
// PATHWAY DETECTION
// =============================================================================

/**
 * Detects the most appropriate clinical symptom pathway from the patient's
 * initial symptom description text.
 */
export function detectSymptomPathway(symptomText: string): SymptomPathway {
  const lower = symptomText.toLowerCase();

  let bestPathway: SymptomPathway = "general";
  let bestScore = 0;

  for (const [pathway, triggers] of Object.entries(PATHWAY_TRIGGERS)) {
    if (pathway === "general") continue;
    let score = 0;
    for (const trigger of triggers) {
      if (trigger.includes(" ")) {
        if (lower.includes(trigger)) score += 2; // Multi-word triggers get higher weight
      } else {
        const regex = new RegExp(`\\b${trigger}`, "i");
        if (regex.test(lower)) score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestPathway = pathway as SymptomPathway;
    }
  }

  return bestPathway;
}

/**
 * Returns the next unanswered question for a given pathway,
 * given the set of already-answered question IDs.
 */
export function getNextAdaptiveQuestion(
  pathway: SymptomPathway,
  answeredQuestionIds: string[]
): AdaptiveFollowUpQuestion | null {
  const def = SYMPTOM_PATHWAYS[pathway];
  if (!def) return null;

  for (const q of def.questions) {
    if (!answeredQuestionIds.includes(q.id)) {
      return q;
    }
  }

  return null; // All questions answered
}

/**
 * Returns true if enough required questions have been answered
 * to proceed to AI evaluation.
 */
export function hasEnoughInfoForEvaluation(
  pathway: SymptomPathway,
  answeredQuestionIds: string[],
  userTurnCount: number
): boolean {
  const def = SYMPTOM_PATHWAYS[pathway];
  if (!def) return userTurnCount >= 3;

  // Must have answered at least minQuestionsBeforeEvaluation turns
  if (userTurnCount < def.minQuestionsBeforeEvaluation) return false;

  // All required questions must be answered
  const required = def.questions.filter((q) => q.required);
  const allRequiredAnswered = required.every((q) => answeredQuestionIds.includes(q.id));

  return allRequiredAnswered;
}
