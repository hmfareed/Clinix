import { TriState } from "@/lib/safety/types";

export type PregnancyStatus = "yes" | "no" | "unknown" | "not_applicable";
export type BreastfeedingStatus = "yes" | "no" | "unknown" | "not_applicable";

export type MedicationClassification =
  | "over_the_counter" // OTC: safe for self-care under packaging guidance
  | "prescription_only" // POM: strictly requires clinician prescription
  | "pharmacist_only"; // Pharmacy-supervised dispensing

export interface MedicationReferenceSource {
  name: string;
  jurisdiction: string; // e.g. "GH", "US", "WHO"
  version: string;
  sourceUrl?: string;
  lastReviewedAt: string;
  reviewedBy: string;
}

export interface MedicationContraindication {
  condition: string;
  explanation: string;
  severity: "critical" | "warning";
}

export interface MedicationInteraction {
  medicineOrClass: string;
  effect: string;
  severity: "major" | "moderate";
}

export interface ActiveIngredientDetail {
  name: string;
  strength?: string;
}

export interface DosageFormDetail {
  form: string; // e.g. "Tablet", "Capsule", "Oral Suspension", "Inhaler"
  route: string; // e.g. "Oral", "Inhalation", "Topical"
  standardStrength?: string;
}

export interface FoodAlcoholInteraction {
  item: string; // e.g. "Alcohol", "Grapefruit Juice", "Dairy/Calcium"
  warning: string;
  severity?: "major" | "moderate" | "minor";
}

export interface ApprovedMedication {
  id: string; // e.g. "GH-MED-001" or DailyMed SPL ID
  genericName: string; // Active ingredient (e.g. "Paracetamol")
  brandNames: string[]; // Locally marketed brands (e.g. ["Panadol", "Febrax"])
  therapeuticClass: string;
  classification: MedicationClassification;
  approvedIndications: string[];
  contraindications: MedicationContraindication[];
  ageRestrictions?: {
    minAgeYears?: number;
    maxAgeYears?: number;
    warning: string;
  };
  pregnancyPrecautions: {
    isContraindicated: boolean;
    warning: string;
  };
  interactions: MedicationInteraction[];
  commonSideEffects: string[];
  administrationWarnings: string[];
  dosageDisclaimer: string;
  referenceSource: MedicationReferenceSource;

  // Rich clinical data fields
  activeIngredients?: ActiveIngredientDetail[];
  availableForms?: DosageFormDetail[];
  dosageForms?: string[]; // Quick filter array (e.g. ["Tablet", "Syrup"])
  routes?: string[]; // e.g. ["Oral", "Topical"]
  seriousAdverseEffects?: string[]; // Serious reactions requiring immediate care
  foodAlcoholInteractions?: FoodAlcoholInteraction[];
  storageAndHandling?: string; // Temperature, light, humidity, child safety
  breastfeedingPrecautions?: {
    isContraindicated?: boolean;
    warning: string;
  };
  pediatricPrecautions?: string;
  olderAdultPrecautions?: string;
  boxedWarning?: string; // Black box warning if present
  manufacturerOrDistributor?: string;
  registrationNumber?: string; // e.g. Ghana FDA or NDC registration code
  officialLabelUrl?: string;
}

export interface PatientMedicationContext {
  ageYears?: number;
  pregnancy: PregnancyStatus;
  breastfeeding?: BreastfeedingStatus;
  allergies: {
    status: TriState;
    items?: string[];
  };
  currentMedicines: {
    status: TriState;
    items?: string[];
  };
  conditions?: string[]; // Pre-existing conditions (e.g. Asthma, Peptic Ulcer)
  symptomsOrComplaint?: string;
  userQuestion?: string;
}

export type MedicationSafetyStatus =
  | "eligible_info" // Safe reference info with packaging and pharmacist disclaimer
  | "requires_consultation" // Missing critical field(s) - must consult pharmacist
  | "emergency_blocked" // Emergency red flags detected - immediate emergency care required
  | "prescription_only_blocked" // Prescription-only - cannot recommend or self-administer
  | "contraindicated" // Known severe allergy or interaction match
  | "caution_advised"; // Moderate warnings or non-critical interactions present

export interface ContraindicationAlert {
  type: "allergy" | "pregnancy" | "breastfeeding" | "age" | "drug_interaction" | "condition";
  matchedItem?: string;
  message: string;
  severity: "critical" | "warning";
}

export interface MedicationEvaluationResult {
  status: MedicationSafetyStatus;
  medication: ApprovedMedication | null;
  missingCriticalFields: string[];
  contraindicationAlerts: ContraindicationAlert[];
  safetyNotices: string[];
  dosageRefusalNotice: string | null;
  referral: {
    required: boolean;
    reason: string;
    recommendedSpecialist: "pharmacist" | "physician" | "emergency_care";
  };
  limitations: string[];
  evaluatedAt: string;
}

export interface MedicationSearchOptions {
  category?: string;
  form?: string;
  classification?: MedicationClassification;
  limit?: number;
}

export interface DuplicateIngredientMatch {
  ingredient: string;
  medications: string[];
  warning: string;
  severity: "critical" | "warning";
}

export interface PairwiseInteractionMatch {
  drugA: string;
  drugB: string;
  severity: "critical" | "major" | "moderate" | "minor";
  effect: string;
  management: string;
  evidenceSource: string;
}

export interface MultiDrugSafetyCheckResult {
  status: MedicationSafetyStatus;
  medicationsChecked: string[];
  duplicateIngredients: DuplicateIngredientMatch[];
  interactions: PairwiseInteractionMatch[];
  contraindicationAlerts: ContraindicationAlert[];
  safetyNotices: string[];
  missingCriticalFields: string[];
  emergencyDetected: boolean;
  emergencyMessage?: string;
  referral: {
    required: boolean;
    reason: string;
    recommendedSpecialist: "pharmacist" | "physician" | "emergency_care";
  };
  limitations: string[];
  checkedAt: string;
}

export interface ClarificationOption {
  medicationId: string;
  displayName: string;
  formulation?: string;
  strength?: string;
}

export interface MedicationAiQueryResult {
  answer: string;
  medicationIdentified?: {
    id: string;
    genericName: string;
    classification: MedicationClassification;
    formulation?: string;
  };
  ambiguousMatches?: ClarificationOption[];
  safetyWarnings: string[];
  limitations: string[];
  sourceCitations: Array<{
    title: string;
    jurisdiction: string;
    lastReviewedAt: string;
    url?: string;
  }>;
  pharmacistQuestions: string[];
  followUpQuestion?: string | null;
  isEmergency: boolean;
  emergencyInstructions?: string;
}

export interface IMedicationKnowledgeProvider {
  search(query: string, options?: MedicationSearchOptions): Promise<ApprovedMedication[]>;
  getById(id: string): Promise<ApprovedMedication | null>;
  getByNameOrBrand(name: string): Promise<ApprovedMedication | null>;
  getAll(): Promise<ApprovedMedication[]>;
}
