import { TriState } from "@/lib/safety/types";

export type PregnancyStatus = "yes" | "no" | "unknown" | "not_applicable";

export type MedicationClassification =
  | "over_the_counter" // OTC: safe for self-care under packaging guidance
  | "prescription_only" // POM: strictly requires clinician prescription
  | "pharmacist_only"; // Pharmacy-supervised dispensing

export interface MedicationReferenceSource {
  name: string;
  jurisdiction: string; // e.g. "GH"
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

export interface ApprovedMedication {
  id: string; // e.g. "GH-MED-001"
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
}

export interface PatientMedicationContext {
  ageYears?: number;
  pregnancy: PregnancyStatus;
  allergies: {
    status: TriState;
    items?: string[];
  };
  currentMedicines: {
    status: TriState;
    items?: string[];
  };
  symptomsOrComplaint?: string;
  userQuestion?: string;
}

export type MedicationSafetyStatus =
  | "eligible_info" // Safe reference info with packaging and pharmacist disclaimer
  | "requires_consultation" // Missing critical field(s) - must consult pharmacist
  | "emergency_blocked" // Emergency red flags detected - immediate emergency care required
  | "prescription_only_blocked" // Prescription-only - cannot recommend or self-administer
  | "contraindicated"; // Known severe allergy or interaction match

export interface ContraindicationAlert {
  type: "allergy" | "pregnancy" | "age" | "drug_interaction";
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

export interface IMedicationKnowledgeProvider {
  search(query: string): Promise<ApprovedMedication[]>;
  getById(id: string): Promise<ApprovedMedication | null>;
  getByNameOrBrand(name: string): Promise<ApprovedMedication | null>;
  getAll(): Promise<ApprovedMedication[]>;
}
