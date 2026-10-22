import { PairwiseInteractionMatch } from "./types";

export interface ClinicalInteractionRule {
  drugA: string; // Generic name or Class keyword
  drugB: string; // Generic name or Class keyword
  severity: "critical" | "major" | "moderate" | "minor";
  effect: string;
  management: string;
  evidenceSource: string;
}

export const VALIDATED_INTERACTIONS_DATASET: ClinicalInteractionRule[] = [
  // 1. NSAID + Anticoagulant
  {
    drugA: "ibuprofen",
    drugB: "warfarin",
    severity: "critical",
    effect:
      "Concomitant use substantially increases the risk of severe gastrointestinal ulceration, massive upper GI hemorrhage, and internal bleeding due to combined platelet inhibition and hypoprothrombinemia.",
    management:
      "Avoid concurrent use. If analgesia is required, paracetamol is preferred under medical supervision. If antiplatelet therapy is clinically mandatory with anticoagulation, co-prescribe a proton pump inhibitor and monitor INR closely.",
    evidenceSource: "Ghana MoH Standard Treatment Guidelines / British National Formulary (BNF 86)",
  },
  {
    drugA: "aspirin",
    drugB: "warfarin",
    severity: "critical",
    effect:
      "Dual antiplatelet and anticoagulant action markedly heightens the risk of major systemic and intracranial hemorrhages.",
    management:
      "Combination requires strict specialist physician justification (e.g. mechanical heart valves) and rigorous prothrombin time / INR surveillance.",
    evidenceSource: "WHO Model Formulary / Ghana FDA Clinical Guidelines",
  },
  {
    drugA: "nsaid",
    drugB: "anticoagulant",
    severity: "critical",
    effect:
      "NSAIDs impair platelet function and injure gastric mucosa, compounding anticoagulant-induced hemorrhagic risk.",
    management: "Avoid combination unless specifically directed and monitored by a hematologist or cardiologist.",
    evidenceSource: "Ghana National Drug Formulary",
  },

  // 2. NSAID + NSAID / Aspirin
  {
    drugA: "ibuprofen",
    drugB: "aspirin",
    severity: "major",
    effect:
      "Significantly increases gastric mucosal damage and peptic ulceration. Regular ibuprofen competitively interferes with the irreversible cardioprotective platelet inhibition of low-dose aspirin.",
    management:
      "Do not combine multiple systemic NSAIDs. If taking low-dose aspirin for cardiovascular protection, take immediate-release aspirin at least 30 minutes before or 8 hours after ibuprofen.",
    evidenceSource: "US FDA Drug Safety Communication / BNF",
  },

  // 3. NSAID + ACE Inhibitor / ARB
  {
    drugA: "ibuprofen",
    drugB: "lisinopril",
    severity: "moderate",
    effect:
      "NSAIDs attenuate the blood-pressure-lowering effect of ACE inhibitors and cause additive renal afferent arteriolar vasoconstriction, potentially precipitating acute renal impairment or hyperkalemia.",
    management:
      "Monitor blood pressure and renal function. Maintain adequate patient hydration. Limit NSAID duration to shortest period.",
    evidenceSource: "Kidney Disease: Improving Global Outcomes (KDIGO) / Ghana MoH Guidelines",
  },
  {
    drugA: "nsaid",
    drugB: "ace_inhibitor",
    severity: "moderate",
    effect: "Antagonism of hypotensive effect and increased risk of acute kidney injury.",
    management: "Monitor blood pressure and kidney function; avoid prolonged co-administration.",
    evidenceSource: "Ghana MoH Standard Treatment Guidelines",
  },

  // 4. Paracetamol + Alcohol / Warfarin
  {
    drugA: "paracetamol",
    drugB: "warfarin",
    severity: "moderate",
    effect:
      "Regular prolonged paracetamol intake (>2000 mg/day for several consecutive days) can inhibit warfarin metabolism and prolong INR, increasing bleeding tendency.",
    management:
      "Occasional therapeutic doses of paracetamol have negligible impact. If high doses are taken for more than 3-4 days, monitor INR.",
    evidenceSource: "American College of Chest Physicians (CHEST) / BNF",
  },
  {
    drugA: "paracetamol",
    drugB: "alcohol",
    severity: "major",
    effect:
      "Chronic heavy alcohol consumption induces hepatic CYP2E1 enzymes and depletes glutathione, dramatically increasing production of the toxic metabolite NAPQI and the likelihood of severe liver necrosis even at therapeutic paracetamol doses.",
    management:
      "Patients with chronic alcohol use should restrict total daily paracetamol to maximum 2000 mg in 24 hours, or avoid paracetamol. Seek urgent medical care if abdominal pain or jaundice occurs.",
    evidenceSource: "Ghana FDA Drug Safety Register / US DailyMed Labeling",
  },

  // 5. Antacids + Antibiotics (Fluoroquinolones / Tetracyclines)
  {
    drugA: "magnesium trisilicate compound",
    drugB: "ciprofloxacin",
    severity: "critical",
    effect:
      "Multivalent metal cations (magnesium, aluminum) form insoluble chelates with ciprofloxacin in the gastrointestinal tract, reducing oral antibiotic absorption by 80-90% and causing therapeutic failure.",
    management:
      "Administer ciprofloxacin at least 2 hours before or 6 hours after magnesium/aluminum antacids.",
    evidenceSource: "Clinical Pharmacokinetics / Ghana MoH Standard Treatment Guidelines",
  },
  {
    drugA: "antacid",
    drugB: "fluoroquinolone",
    severity: "critical",
    effect: "Divalent and trivalent cations bind fluoroquinolones, preventing oral absorption.",
    management: "Separate intake times by at least 2 hours before or 4-6 hours after antacid.",
    evidenceSource: "Ghana Standard Treatment Guidelines",
  },

  // 6. ACT Antimalarials (Artemether + Lumefantrine) + QT Prolonging Agents / CYP3A4
  {
    drugA: "artemether + lumefantrine",
    drugB: "erythromycin",
    severity: "major",
    effect:
      "Erythromycin strongly inhibits CYP3A4-mediated clearance of lumefantrine and both agents have potential to prolong cardiac QTc interval, increasing risk of life-threatening ventricular arrhythmias (torsades de pointes).",
    management:
      "Avoid concurrent administration. Select an alternative antibacterial or alternative antimalarial therapy under physician supervision.",
    evidenceSource: "WHO Malaria Treatment Guidelines / Ghana NMEP Guidelines",
  },
  {
    drugA: "artemether + lumefantrine",
    drugB: "ketoconazole",
    severity: "major",
    effect:
      "Potent CYP3A4 inhibition increases lumefantrine plasma concentrations and risk of cardiotoxicity.",
    management: "Avoid combination. Use alternative antifungal therapy.",
    evidenceSource: "Ghana MoH Standard Treatment Guidelines",
  },

  // 7. Amoxicillin + Methotrexate / Allopurinol
  {
    drugA: "amoxicillin",
    drugB: "methotrexate",
    severity: "major",
    effect:
      "Amoxicillin competitively inhibits renal tubular excretion of methotrexate, increasing serum methotrexate levels and risks of bone marrow suppression and severe mucositis.",
    management:
      "Carefully monitor complete blood count and signs of methotrexate toxicity. Consider alternative antibiotic.",
    evidenceSource: "British National Formulary / Lexicomp",
  },
  {
    drugA: "amoxicillin",
    drugB: "allopurinol",
    severity: "moderate",
    effect: "Substantially increased incidence of erythematous maculopapular skin eruptions.",
    management:
      "Warn patient to report any skin rash immediately. Discontinue if hypersensitivity rash develops.",
    evidenceSource: "Ghana MoH Standard Treatment Guidelines",
  },

  // 8. Metronidazole + Alcohol
  {
    drugA: "metronidazole",
    drugB: "alcohol",
    severity: "critical",
    effect:
      "Metronidazole inhibits alcohol dehydrogenase, precipitating an acute disulfiram-like reaction characterized by severe abdominal cramps, violent nausea, vomiting, cutaneous flushing, palpitations, and hypotension.",
    management:
      "Strictly avoid all alcohol and alcohol-containing medicinal syrups during metronidazole treatment and for at least 48 hours following the final dose.",
    evidenceSource: "Ghana FDA Approved Prescribing Information / WHO Model Formulary",
  },
  {
    drugA: "metronidazole",
    drugB: "warfarin",
    severity: "major",
    effect:
      "Metronidazole inhibits warfarin metabolism, significantly increasing prothrombin time and risk of sudden hemorrhagic complications.",
    management:
      "Monitor INR closely if concurrent therapy is unavoidable; warfarin dosage reduction is frequently required.",
    evidenceSource: "Chest / Ghana MoH Guidelines",
  },

  // 9. Antihistamines + CNS Depressants
  {
    drugA: "chlorpheniramine",
    drugB: "alcohol",
    severity: "major",
    effect:
      "Additive central nervous system depression leading to profound drowsiness, impaired psychomotor skills, decreased reflexes, and respiratory depression.",
    management: "Avoid alcoholic beverages entirely while taking first-generation antihistamines.",
    evidenceSource: "Ghana MoH Standard Treatment Guidelines",
  },
  {
    drugA: "chlorpheniramine",
    drugB: "cetirizine",
    severity: "moderate",
    effect:
      "Additive H1-receptor blockade and enhanced sedation without added clinical benefit.",
    management:
      "Do not take multiple antihistamines simultaneously unless specifically directed by an allergist.",
    evidenceSource: "American Academy of Allergy, Asthma & Immunology (AAAAI)",
  },

  // 10. Beta-blockers + Salbutamol
  {
    drugA: "salbutamol",
    drugB: "propranolol",
    severity: "critical",
    effect:
      "Non-selective beta-blockers antagonize salbutamol bronchodilation and can precipitate severe, potentially fatal bronchospasm in patients with reactive airway disease.",
    management:
      "Non-cardioselective beta-blockers are contraindicated in patients with asthma or COPD. If beta-blocker is required, cardioselective agents must be used with extreme caution under specialist care.",
    evidenceSource: "Global Initiative for Asthma (GINA) / Ghana MoH Guidelines",
  },

  // 11. Metformin + Contrast Media / Alcohol
  {
    drugA: "metformin",
    drugB: "alcohol",
    severity: "major",
    effect:
      "Acute or chronic alcohol ingestion potentiates the effect of metformin on lactate metabolism, substantially escalating the risk of life-threatening lactic acidosis.",
    management: "Avoid excessive alcohol consumption during metformin treatment.",
    evidenceSource: "American Diabetes Association (ADA) / Ghana MoH Guidelines",
  },

  // 12. Amlodipine + Simvastatin
  {
    drugA: "amlodipine",
    drugB: "simvastatin",
    severity: "major",
    effect:
      "Amlodipine increases systemic simvastatin exposure by approximately 77%, significantly increasing the risk of myopathy and rhabdomyolysis.",
    management:
      "Do not exceed a daily dose of 20 mg simvastatin when taken concurrently with amlodipine, or switch to an alternative statin (e.g. atorvastatin or rosuvastatin).",
    evidenceSource: "US FDA Drug Safety Communication / BNF",
  },

  // 13. Omeprazole + Clopidogrel
  {
    drugA: "omeprazole",
    drugB: "clopidogrel",
    severity: "major",
    effect:
      "Omeprazole inhibits CYP2C19, significantly reducing the formation of clopidogrel's active antiplatelet metabolite and attenuating its protection against ischemic events.",
    management:
      "If a proton pump inhibitor is necessary with clopidogrel, pantoprazole is preferred as it exhibits substantially less CYP2C19 inhibition.",
    evidenceSource: "American College of Cardiology (ACC) / US FDA",
  },
];

// Mapping of common brands, variants, and synonyms to normalized active ingredients
export const BRAND_TO_ACTIVE_INGREDIENT_MAP: Record<string, string> = {
  // Paracetamol
  paracetamol: "paracetamol",
  acetaminophen: "paracetamol",
  panadol: "paracetamol",
  "panadol extra": "paracetamol",
  "panadol baby": "paracetamol",
  febrax: "paracetamol",
  calpol: "paracetamol",
  emcap: "paracetamol",
  tylenol: "paracetamol",
  efferalgan: "paracetamol",
  "crocin": "paracetamol",

  // Ibuprofen
  ibuprofen: "ibuprofen",
  advil: "ibuprofen",
  brufen: "ibuprofen",
  nurofen: "ibuprofen",
  motrin: "ibuprofen",

  // Aspirin
  aspirin: "aspirin",
  "acetylsalicylic acid": "aspirin",
  disprin: "aspirin",
  aspro: "aspirin",
  ecotrin: "aspirin",
  "bayer aspirin": "aspirin",

  // Cetirizine
  cetirizine: "cetirizine",
  zyrtec: "cetirizine",
  cetriz: "cetirizine",
  alerid: "cetirizine",
  virlix: "cetirizine",

  // Artemether + Lumefantrine
  "artemether + lumefantrine": "artemether + lumefantrine",
  "artemether lumefantrine": "artemether + lumefantrine",
  coartem: "artemether + lumefantrine",
  lonart: "artemether + lumefantrine",
  artefan: "artemether + lumefantrine",
  riamet: "artemether + lumefantrine",
  lumart: "artemether + lumefantrine",

  // Amoxicillin
  amoxicillin: "amoxicillin",
  amoxil: "amoxicillin",
  moxatag: "amoxicillin",
  trimox: "amoxicillin",
  penamox: "amoxicillin",

  // Magnesium Trisilicate
  "magnesium trisilicate compound": "magnesium trisilicate compound",
  "magnesium trisilicate": "magnesium trisilicate compound",
  gestid: "magnesium trisilicate compound",
  gelusil: "magnesium trisilicate compound",
  asilone: "magnesium trisilicate compound",
  magsil: "magnesium trisilicate compound",
  "andrews liver salt": "magnesium trisilicate compound",

  // Metronidazole
  metronidazole: "metronidazole",
  flagyl: "metronidazole",
  metrogyl: "metronidazole",
  trichozole: "metronidazole",

  // Chlorpheniramine
  chlorpheniramine: "chlorpheniramine",
  piriton: "chlorpheniramine",
  allercalm: "chlorpheniramine",
  "cafenol cold": "chlorpheniramine",

  // Omeprazole
  omeprazole: "omeprazole",
  prilosec: "omeprazole",
  losec: "omeprazole",
  omez: "omeprazole",
  gasec: "omeprazole",

  // Salbutamol
  salbutamol: "salbutamol",
  albuterol: "salbutamol",
  ventolin: "salbutamol",
  asthalin: "salbutamol",
  aerolin: "salbutamol",
  proventil: "salbutamol",

  // Ciprofloxacin
  ciprofloxacin: "ciprofloxacin",
  cipro: "ciprofloxacin",
  cifran: "ciprofloxacin",
  ciproxin: "ciprofloxacin",
  ciprolet: "ciprofloxacin",

  // Metformin
  metformin: "metformin",
  glucophage: "metformin",
  diabex: "metformin",
  formin: "metformin",
  metfor: "metformin",

  // Amlodipine
  amlodipine: "amlodipine",
  norvasc: "amlodipine",
  amlopin: "amlodipine",
  amlo: "amlodipine",
  istin: "amlodipine",

  // Warfarin
  warfarin: "warfarin",
  coumadin: "warfarin",

  // Alcohol
  alcohol: "alcohol",
  beer: "alcohol",
  wine: "alcohol",
  spirits: "alcohol",

  // Propranolol
  propranolol: "propranolol",
  inderal: "propranolol",

  // Simvastatin
  simvastatin: "simvastatin",
  zocor: "simvastatin",

  // Clopidogrel
  clopidogrel: "clopidogrel",
  plavix: "clopidogrel",
};

// Therapeutic class tags
export const DRUG_TO_CLASS_MAP: Record<string, string[]> = {
  ibuprofen: ["nsaid", "analgesic"],
  aspirin: ["nsaid", "analgesic", "antiplatelet"],
  paracetamol: ["analgesic", "antipyretic"],
  amoxicillin: ["antibacterial", "penicillin", "beta_lactam"],
  ciprofloxacin: ["antibacterial", "fluoroquinolone"],
  metronidazole: ["antimicrobial", "nitroimidazole"],
  "artemether + lumefantrine": ["antimalarial", "act"],
  cetirizine: ["antihistamine", "second_generation_antihistamine"],
  chlorpheniramine: ["antihistamine", "first_generation_antihistamine", "sedating_antihistamine"],
  "magnesium trisilicate compound": ["antacid"],
  omeprazole: ["ppi", "antisecretory"],
  salbutamol: ["bronchodilator", "beta2_agonist"],
  metformin: ["antidiabetic", "biguanide"],
  amlodipine: ["calcium_channel_blocker", "antihypertensive"],
  warfarin: ["anticoagulant"],
  lisinopril: ["ace_inhibitor", "antihypertensive"],
  propranolol: ["beta_blocker", "antihypertensive"],
  simvastatin: ["statin", "lipid_lowering"],
  clopidogrel: ["antiplatelet"],
};

export function normalizeMedicineToIngredient(rawName: string): string {
  const clean = rawName.toLowerCase().trim();
  if (BRAND_TO_ACTIVE_INGREDIENT_MAP[clean]) {
    return BRAND_TO_ACTIVE_INGREDIENT_MAP[clean];
  }

  // Check if any brand key is substring
  for (const [key, ingredient] of Object.entries(BRAND_TO_ACTIVE_INGREDIENT_MAP)) {
    if (clean.includes(key) || key.includes(clean)) {
      return ingredient;
    }
  }

  return clean;
}
