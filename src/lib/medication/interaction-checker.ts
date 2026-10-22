import {
  ApprovedMedication,
  PatientMedicationContext,
  MultiDrugSafetyCheckResult,
  DuplicateIngredientMatch,
  PairwiseInteractionMatch,
  ContraindicationAlert,
  MedicationSafetyStatus,
} from "./types";
import {
  VALIDATED_INTERACTIONS_DATASET,
  DRUG_TO_CLASS_MAP,
  normalizeMedicineToIngredient,
} from "./interaction-dataset";
import { checkEmergencyRules } from "@/lib/safety/triage-engine";
import { defaultMedicationProvider } from "./ghana-provider";

export function detectDuplicateActiveIngredients(
  medications: Array<{ rawName: string; resolved?: ApprovedMedication | null }>
): DuplicateIngredientMatch[] {
  const ingredientToMedsMap = new Map<string, string[]>();

  for (const item of medications) {
    const raw = item.rawName.trim();
    if (!raw) continue;

    // Use resolved medication generic name or normalize
    const active = item.resolved?.genericName
      ? item.resolved.genericName.toLowerCase().trim()
      : normalizeMedicineToIngredient(raw);

    const existing = ingredientToMedsMap.get(active) || [];
    if (!existing.includes(raw)) {
      existing.push(raw);
    }
    ingredientToMedsMap.set(active, existing);
  }

  const duplicates: DuplicateIngredientMatch[] = [];

  for (const [ingredient, medNames] of ingredientToMedsMap.entries()) {
    if (medNames.length > 1) {
      const prettyIngredient = ingredient.charAt(0).toUpperCase() + ingredient.slice(1);
      duplicates.push({
        ingredient: prettyIngredient,
        medications: medNames,
        warning: `Duplicate Active Ingredient Detected: ${medNames.join(
          " and "
        )} both contain the active substance "${prettyIngredient}". Taking both concurrently leads to cumulative exposure and heightens the danger of acute overdose toxicity (such as acute liver damage with paracetamol or peptic bleeding with NSAIDs).`,
        severity: "critical",
      });
    }
  }

  return duplicates;
}

export function findPairwiseInteractions(
  ingredients: string[]
): PairwiseInteractionMatch[] {
  const matches: PairwiseInteractionMatch[] = [];
  const normalizedSet = Array.from(new Set(ingredients.map((i) => i.toLowerCase().trim())));

  // Check all pairs
  for (let i = 0; i < normalizedSet.length; i++) {
    for (let j = i + 1; j < normalizedSet.length; j++) {
      const drugA = normalizedSet[i];
      const drugB = normalizedSet[j];

      const classesA = DRUG_TO_CLASS_MAP[drugA] || [];
      const classesB = DRUG_TO_CLASS_MAP[drugB] || [];

      for (const rule of VALIDATED_INTERACTIONS_DATASET) {
        const ruleA = rule.drugA.toLowerCase();
        const ruleB = rule.drugB.toLowerCase();

        const matchDirect =
          (drugA.includes(ruleA) || ruleA.includes(drugA)) &&
          (drugB.includes(ruleB) || ruleB.includes(drugB));

        const matchReverse =
          (drugA.includes(ruleB) || ruleB.includes(drugA)) &&
          (drugB.includes(ruleA) || ruleA.includes(drugB));

        const matchClass =
          (classesA.includes(ruleA) && classesB.includes(ruleB)) ||
          (classesA.includes(ruleB) && classesB.includes(ruleA));

        if (matchDirect || matchReverse || matchClass) {
          // Avoid duplicate rule insertion
          const alreadyAdded = matches.some(
            (m) =>
              (m.drugA === drugA && m.drugB === drugB && m.effect === rule.effect) ||
              (m.drugA === drugB && m.drugB === drugA && m.effect === rule.effect)
          );

          if (!alreadyAdded) {
            matches.push({
              drugA: drugA.charAt(0).toUpperCase() + drugA.slice(1),
              drugB: drugB.charAt(0).toUpperCase() + drugB.slice(1),
              severity: rule.severity,
              effect: rule.effect,
              management: rule.management,
              evidenceSource: rule.evidenceSource,
            });
          }
        }
      }
    }
  }

  return matches;
}

export async function evaluateMultiDrugSafety(
  medicationNamesOrIds: string[],
  context: PatientMedicationContext
): Promise<MultiDrugSafetyCheckResult> {
  const checkedAt = new Date().toISOString();
  const cleanedNames = medicationNamesOrIds
    .map((s) => s.trim())
    .filter(Boolean);

  const limitations = [
    "Safety check results are educational and do not constitute a clinical prescription or pharmacist dispensing decision.",
    "Interaction evaluations are limited to verified clinical pairs in the configured reference dataset.",
    "Absence of recorded interactions does not imply safety. Always consult a registered pharmacist before combining medications.",
    "Never exceed official packaging limits or stop essential prescribed medicines without clinical supervision.",
  ];

  // 1. EMERGENCY CHECK
  const combinedSafetyText = [
    context.symptomsOrComplaint,
    context.userQuestion,
    ...cleanedNames,
  ]
    .filter(Boolean)
    .join(" ");

  const safety = checkEmergencyRules({
    text: combinedSafetyText,
    age: context.ageYears,
    pregnancy: context.pregnancy,
  });

  if (safety.emergencyDetected) {
    return {
      status: "emergency_blocked",
      medicationsChecked: cleanedNames,
      duplicateIngredients: [],
      interactions: [],
      contraindicationAlerts: [],
      safetyNotices: [
        "EMERGENCY WARNING: Critical medical warning signs were detected. Discontinue self-care and seek urgent medical evaluation.",
      ],
      missingCriticalFields: [],
      emergencyDetected: true,
      emergencyMessage: safety.patientMessage,
      referral: {
        required: true,
        reason: safety.patientMessage,
        recommendedSpecialist: "emergency_care",
      },
      limitations: [
        "Immediate emergency medical attention takes precedence over all medication advice.",
        "Call 112 or visit the nearest emergency facility immediately.",
      ],
      checkedAt,
    };
  }

  // 2. RESOLVE ALL MEDICATIONS
  const resolvedMeds: Array<{ rawName: string; resolved: ApprovedMedication | null }> = [];
  for (const name of cleanedNames) {
    const med = await defaultMedicationProvider.getByNameOrBrand(name);
    resolvedMeds.push({ rawName: name, resolved: med });
  }

  // 3. DETECT DUPLICATE ACTIVE INGREDIENTS
  const duplicateIngredients = detectDuplicateActiveIngredients(resolvedMeds);

  // 4. EXTRACT INGREDIENTS & RUN PAIRWISE INTERACTION CHECK
  const ingredients: string[] = resolvedMeds.map((m) =>
    m.resolved?.genericName
      ? m.resolved.genericName.toLowerCase().trim()
      : normalizeMedicineToIngredient(m.rawName)
  );

  // If patient reported current medicines in context, include them in interaction cross-check!
  if (context.currentMedicines.status === "yes" && context.currentMedicines.items?.length) {
    for (const cm of context.currentMedicines.items) {
      if (cm.trim()) {
        ingredients.push(normalizeMedicineToIngredient(cm.trim()));
      }
    }
  }

  const interactions = findPairwiseInteractions(ingredients);

  // 5. PATIENT CONTEXT TRI-STATE CHECK
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

  // 6. ALLERGIES & PREGNANCY & CONDITION ALERTS
  const contraindicationAlerts: ContraindicationAlert[] = [];
  const safetyNotices: string[] = [];

  // Pregnancy check
  if (context.pregnancy === "yes") {
    for (const item of resolvedMeds) {
      if (item.resolved?.pregnancyPrecautions.isContraindicated) {
        contraindicationAlerts.push({
          type: "pregnancy",
          severity: "critical",
          message: `Pregnancy Contraindication for ${item.resolved.genericName}: ${item.resolved.pregnancyPrecautions.warning}`,
        });
      } else if (item.resolved?.pregnancyPrecautions.warning) {
        safetyNotices.push(
          `Pregnancy Precaution (${item.resolved.genericName}): ${item.resolved.pregnancyPrecautions.warning}`
        );
      }
    }
  }

  // Allergy check
  if (context.allergies.status === "yes" && context.allergies.items?.length) {
    const allergyList = context.allergies.items.map((i) => i.toLowerCase().trim());
    for (const item of resolvedMeds) {
      if (!item.resolved) continue;
      const generic = item.resolved.genericName.toLowerCase();
      const thClass = item.resolved.therapeuticClass.toLowerCase();
      const brands = item.resolved.brandNames.map((b) => b.toLowerCase());

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
        contraindicationAlerts.push({
          type: "allergy",
          matchedItem: matchedAllergy,
          severity: "critical",
          message: `Known Allergy Conflict: Patient allergy "${matchedAllergy}" conflicts with ${item.resolved.genericName}. High risk of acute hypersensitivity or anaphylaxis.`,
        });
      }
    }
  }

  // Age restrictions
  if (context.ageYears !== undefined) {
    for (const item of resolvedMeds) {
      if (!item.resolved?.ageRestrictions) continue;
      const { minAgeYears, maxAgeYears, warning } = item.resolved.ageRestrictions;
      if (minAgeYears !== undefined && context.ageYears < minAgeYears) {
        contraindicationAlerts.push({
          type: "age",
          severity: "critical",
          message: `Age Restriction (${item.resolved.genericName}): Patient age (${context.ageYears} yrs) is below minimum approved age of ${minAgeYears} yrs. ${warning}`,
        });
      } else if (maxAgeYears !== undefined && context.ageYears > maxAgeYears) {
        contraindicationAlerts.push({
          type: "age",
          severity: "warning",
          message: `Age Precaution (${item.resolved.genericName}): ${warning}`,
        });
      }
    }
  }

  // Conditions check
  if (context.conditions?.length) {
    const patientConds = context.conditions.map((c) => c.toLowerCase().trim());
    for (const item of resolvedMeds) {
      if (!item.resolved?.contraindications) continue;
      for (const contra of item.resolved.contraindications) {
        const condName = contra.condition.toLowerCase();
        const match = patientConds.find((pc) => condName.includes(pc) || pc.includes(condName));
        if (match) {
          contraindicationAlerts.push({
            type: "condition",
            matchedItem: match,
            severity: contra.severity,
            message: `Medical Condition Warning (${item.resolved.genericName}): Contraindicated or caution with "${contra.condition}": ${contra.explanation}`,
          });
        }
      }
    }
  }

  // 7. DETERMINE OVERALL STATUS
  const hasCriticalConflict =
    duplicateIngredients.some((d) => d.severity === "critical") ||
    interactions.some((i) => i.severity === "critical") ||
    contraindicationAlerts.some((a) => a.severity === "critical");

  const hasMajorInteraction =
    interactions.some((i) => i.severity === "major") ||
    contraindicationAlerts.some((a) => a.severity === "warning");

  let finalStatus: MedicationSafetyStatus = "eligible_info";
  let referralRequired = false;
  let referralReason = "";
  let recommendedSpecialist: "pharmacist" | "physician" | "emergency_care" = "pharmacist";

  if (hasCriticalConflict) {
    finalStatus = "contraindicated";
    referralRequired = true;
    referralReason =
      "Critical safety alerts or contraindications were identified. Do not combine or take these medications without immediate physician evaluation.";
    recommendedSpecialist = "physician";
  } else if (hasMajorInteraction) {
    finalStatus = "caution_advised";
    referralRequired = true;
    referralReason =
      "Significant potential interactions or precautions were identified. A licensed pharmacist must review dosing and administration times.";
    recommendedSpecialist = "pharmacist";
  } else if (missingCriticalFields.length > 0) {
    finalStatus = "requires_consultation";
    referralRequired = true;
    referralReason = `Suitability cannot be confirmed because critical patient information (${missingCriticalFields.join(
      ", "
    )}) is unknown. Consult a licensed pharmacist.`;
    recommendedSpecialist = "pharmacist";
  }

  return {
    status: finalStatus,
    medicationsChecked: cleanedNames,
    duplicateIngredients,
    interactions,
    contraindicationAlerts,
    safetyNotices,
    missingCriticalFields,
    emergencyDetected: false,
    referral: {
      required: referralRequired,
      reason: referralReason,
      recommendedSpecialist,
    },
    limitations,
    checkedAt,
  };
}
