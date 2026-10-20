import {
  ApprovedMedication,
  PatientMedicationContext,
  MedicationEvaluationResult,
  MedicationSafetyStatus,
  ContraindicationAlert,
} from "./types";
import { checkEmergencyRules } from "@/lib/safety/triage-engine";

const DOSAGE_INTENT_PATTERNS = [
  /\bhow (much|many)\b/i,
  /\b(what|which) dose\b/i,
  /\bdosage\b/i,
  /\bhow often\b/i,
  /\bhow many (pills|tablets|drops|capsules|spoons|ml|mg)\b/i,
  /\bdose calculation\b/i,
  /\bcan i take \d+\b/i,
  /\bhow much to give\b/i,
  /\bmg per kg\b/i,
];

export function detectDosageInquiry(query?: string): boolean {
  if (!query) return false;
  return DOSAGE_INTENT_PATTERNS.some((pattern) => pattern.test(query));
}

export function evaluateMedicationSafety(
  medication: ApprovedMedication | null,
  context: PatientMedicationContext
): MedicationEvaluationResult {
  const evaluatedAt = new Date().toISOString();
  const limitations = [
    "This guidance is educational and does not constitute a clinical prescription or medical diagnosis.",
    "Always verify active ingredient, strength, and packaging instructions with a registered pharmacist.",
    "Never exceed manufacturer recommended intake.",
  ];

  // 1. EMERGENCY CHECK
  // Check symptoms or user questions for red flags
  const combinedSafetyText = [
    context.symptomsOrComplaint,
    context.userQuestion,
  ]
    .filter(Boolean)
    .join(" ");

  if (combinedSafetyText) {
    const safety = checkEmergencyRules({
      text: combinedSafetyText,
      age: context.ageYears,
      pregnancy: context.pregnancy,
    });

    if (safety.emergencyDetected) {
      return {
        status: "emergency_blocked",
        medication,
        missingCriticalFields: [],
        contraindicationAlerts: [],
        safetyNotices: [
          "Emergency warning signs were identified. Medication information cannot be provided when emergency care is indicated.",
        ],
        dosageRefusalNotice: null,
        referral: {
          required: true,
          reason: safety.patientMessage,
          recommendedSpecialist: "emergency_care",
        },
        limitations: [
          "Emergency clinical red flags take precedence over all medication advice.",
          "Immediate in-person hospital evaluation is required.",
        ],
        evaluatedAt,
      };
    }
  }

  // 2. CHECK FOR DOSAGE CALCULATION REQUEST
  let dosageRefusalNotice: string | null = null;
  if (detectDosageInquiry(context.userQuestion)) {
    dosageRefusalNotice =
      "Clinix does not calculate or recommend individual drug dosages. Proper dosing requires consideration of exact body weight, organ function, and clinical assessment. Please refer directly to the manufacturer packaging leaflet or consult a registered pharmacist.";
  }

  // 3. MEDICATION EXISTENCE CHECK
  if (!medication) {
    return {
      status: "requires_consultation",
      medication: null,
      missingCriticalFields: [],
      contraindicationAlerts: [],
      safetyNotices: [
        "The requested medication was not found in the approved Ghana clinical reference registry.",
      ],
      dosageRefusalNotice,
      referral: {
        required: true,
        reason:
          "Please consult a licensed pharmacist or physician for information regarding unlisted or brand-specific medications.",
        recommendedSpecialist: "pharmacist",
      },
      limitations,
      evaluatedAt,
    };
  }

  // 4. PRESCRIPTION-ONLY MEDICINE (POM) INVARIANT
  if (medication.classification === "prescription_only") {
    return {
      status: "prescription_only_blocked",
      medication,
      missingCriticalFields: [],
      contraindicationAlerts: [],
      safetyNotices: [
        `Prescription-Only Medicine: ${medication.genericName} requires a clinical examination and valid prescription by a licensed medical practitioner.`,
        "In compliance with Ghana FDA regulations, Clinix cannot recommend initiating or self-administering prescription-only treatments.",
      ],
      dosageRefusalNotice,
      referral: {
        required: true,
        reason: `${medication.genericName} is a prescription-only medicine. Please visit a clinic or licensed medical doctor for evaluation and prescription.`,
        recommendedSpecialist: "physician",
      },
      limitations: [
        ...limitations,
        "Prescription medicines require formal in-person diagnostic confirmation.",
      ],
      evaluatedAt,
    };
  }

  // 5. TRI-STATE CLINICAL SAFETY EVALUATION
  // Missing/unknown age, pregnancy, allergies, or current medicines MUST bar self-care suitability
  const missingCriticalFields: string[] = [];

  if (context.ageYears === undefined || context.ageYears === null || isNaN(context.ageYears)) {
    missingCriticalFields.push("age");
  }

  if (!context.pregnancy || context.pregnancy === "unknown") {
    missingCriticalFields.push("pregnancy");
  }

  if (!context.allergies || context.allergies.status === "unknown") {
    missingCriticalFields.push("allergies");
  }

  if (!context.currentMedicines || context.currentMedicines.status === "unknown") {
    missingCriticalFields.push("current_medicines");
  }

  if (missingCriticalFields.length > 0) {
    const formattedFields = missingCriticalFields.join(", ").replace(/_/g, " ");
    return {
      status: "requires_consultation",
      medication,
      missingCriticalFields,
      contraindicationAlerts: [],
      safetyNotices: [
        `Clinical suitability cannot be confirmed because critical patient information (${formattedFields}) is unknown.`,
        "In accordance with medical safety rules, unknown clinical fields are never assumed to be negative.",
      ],
      dosageRefusalNotice,
      referral: {
        required: true,
        reason: `Suitability for ${medication.genericName} cannot be assessed without complete clinical history (${formattedFields}). Please speak with a licensed pharmacist or doctor before taking this medicine.`,
        recommendedSpecialist: "pharmacist",
      },
      limitations: [
        ...limitations,
        "Unknown clinical factors require professional clinical assessment.",
      ],
      evaluatedAt,
    };
  }

  // 6. KNOWN CLINICAL RISK AND CONTRAINDICATION CHECKS
  const alerts: ContraindicationAlert[] = [];
  const safetyNotices: string[] = [];

  // Age restriction check
  if (medication.ageRestrictions && context.ageYears !== undefined) {
    const { minAgeYears, maxAgeYears, warning } = medication.ageRestrictions;
    if (minAgeYears !== undefined && context.ageYears < minAgeYears) {
      alerts.push({
        type: "age",
        severity: "critical",
        message: `Age restriction alert: ${warning} (Patient age: ${context.ageYears} years, minimum: ${minAgeYears} years).`,
      });
    } else if (maxAgeYears !== undefined && context.ageYears > maxAgeYears) {
      alerts.push({
        type: "age",
        severity: "warning",
        message: `Age precaution: ${warning}`,
      });
    }
  }

  // Pregnancy check
  if (context.pregnancy === "yes") {
    if (medication.pregnancyPrecautions.isContraindicated) {
      alerts.push({
        type: "pregnancy",
        severity: "critical",
        message: `Pregnancy Contraindication: ${medication.pregnancyPrecautions.warning}`,
      });
    } else {
      safetyNotices.push(
        `Pregnancy Precaution: ${medication.pregnancyPrecautions.warning}`
      );
    }
  }

  // Allergy cross-check
  if (context.allergies.status === "yes" && context.allergies.items?.length) {
    const allergyList = context.allergies.items.map((i) => i.toLowerCase().trim());
    const generic = medication.genericName.toLowerCase();
    const thClass = medication.therapeuticClass.toLowerCase();
    const brands = medication.brandNames.map((b) => b.toLowerCase());

    const matchedAllergy = allergyList.find((allergy) => {
      return (
        generic.includes(allergy) ||
        allergy.includes(generic) ||
        thClass.includes(allergy) ||
        brands.some((b) => b.includes(allergy) || allergy.includes(b)) ||
        (allergy.includes("penicillin") && generic.includes("amoxicillin")) ||
        (allergy.includes("nsaid") && (generic.includes("ibuprofen") || generic.includes("aspirin"))) ||
        (allergy.includes("aspirin") && generic.includes("aspirin"))
      );
    });

    if (matchedAllergy) {
      alerts.push({
        type: "allergy",
        matchedItem: matchedAllergy,
        severity: "critical",
        message: `Critical Allergy Match: Patient has a recorded allergy matching "${matchedAllergy}". Administration of ${medication.genericName} is strictly contraindicated due to risk of acute hypersensitivity or anaphylaxis.`,
      });
    }
  }

  // Drug Interaction cross-check
  if (context.currentMedicines.status === "yes" && context.currentMedicines.items?.length) {
    const currentMeds = context.currentMedicines.items.map((m) => m.toLowerCase().trim());

    for (const interaction of medication.interactions) {
      const interactingTarget = interaction.medicineOrClass.toLowerCase();
      const matchedMed = currentMeds.find((userMed) => {
        return (
          interactingTarget.includes(userMed) ||
          userMed.includes(interactingTarget) ||
          (interactingTarget.includes("anticoagulant") && (userMed.includes("warfarin") || userMed.includes("heparin"))) ||
          (interactingTarget.includes("nsaid") && (userMed.includes("ibuprofen") || userMed.includes("aspirin")))
        );
      });

      if (matchedMed) {
        alerts.push({
          type: "drug_interaction",
          matchedItem: matchedMed,
          severity: interaction.severity === "major" ? "critical" : "warning",
          message: `Drug Interaction Detected (${matchedMed}): ${interaction.effect}`,
        });
      }
    }
  }

  // 7. DETERMINE OVERALL STATUS
  const hasCriticalAlert = alerts.some((a) => a.severity === "critical");
  let finalStatus: MedicationSafetyStatus = "eligible_info";
  let referralRequired = false;
  let referralReason = "";
  let recommendedSpecialist: "pharmacist" | "physician" | "emergency_care" = "pharmacist";

  if (hasCriticalAlert) {
    finalStatus = "contraindicated";
    referralRequired = true;
    referralReason = `Critical safety contraindications detected: ${alerts.map((a) => a.message).join(" ")}`;
    recommendedSpecialist = "physician";
  } else if (alerts.length > 0) {
    referralRequired = true;
    referralReason = `Potential moderate interactions or precautions detected. Please verify with a licensed pharmacist.`;
    recommendedSpecialist = "pharmacist";
  }

  return {
    status: finalStatus,
    medication,
    missingCriticalFields: [],
    contraindicationAlerts: alerts,
    safetyNotices: [
      ...safetyNotices,
      ...medication.administrationWarnings,
    ],
    dosageRefusalNotice,
    referral: {
      required: referralRequired,
      reason: referralReason,
      recommendedSpecialist,
    },
    limitations,
    evaluatedAt,
  };
}
