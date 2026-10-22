import {
  ApprovedMedication,
  MedicationAiQueryResult,
  PatientMedicationContext,
  ClarificationOption,
} from "@/lib/medication/types";
import { defaultCompositeMedicationProvider } from "@/lib/medication/composite-provider";
import { detectDosageInquiry } from "@/lib/medication/safety-evaluator";
import { checkEmergencyRules } from "@/lib/safety/triage-engine";
import { getNvidiaClient, MODEL, isNvidiaConfigured } from "@/lib/ai/nvidia";
import { BRAND_TO_ACTIVE_INGREDIENT_MAP } from "@/lib/medication/interaction-dataset";

const OVERDOSE_PATTERNS = [
  /\boverdose\b/i,
  /\btook (too much|too many|all the pills|entire bottle|whole pack)\b/i,
  /\bswallowed (a lot|entire|a bottle|pills by accident)\b/i,
  /\b(swallowed|drank|took).*(entire|whole|a|all).*(bottle|pack|strip)\b/i,
  /\b(child|baby|infant|toddler) (drank|swallowed|ate|ingested)\b/i,
  /\bpoison\b/i,
  /\bpassed out after\b/i,
  /\baccidental ingestion\b/i,
  /\bthroat is closing\b/i,
  /\bcannot breathe\b/i,
  /\blips swollen.*rash\b/i,
];

export function detectMedicationEmergency(text?: string): boolean {
  if (!text) return false;
  return OVERDOSE_PATTERNS.some((pattern) => pattern.test(text));
}

export interface AskMedicationAiInput {
  medicationId?: string;
  medicationName?: string;
  question: string;
  patientContext?: PatientMedicationContext;
}

export class MedicationAiService {
  private provider = defaultCompositeMedicationProvider;

  async extractMedicationFromText(text: string): Promise<ApprovedMedication | null> {
    const clean = text.trim();
    if (!clean) return null;

    // 1. Check all registered medications from local registry
    const allMeds = await this.provider.getAll();
    const sorted = [...allMeds].sort((a, b) => b.genericName.length - a.genericName.length);

    for (const med of sorted) {
      const escapedGeneric = med.genericName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`(?:^|[^a-zA-Z0-9])${escapedGeneric}(?:$|[^a-zA-Z0-9])`, "i").test(clean)) {
        return med;
      }
      for (const brand of med.brandNames) {
        if (brand.length < 3) continue;
        const escapedBrand = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (new RegExp(`(?:^|[^a-zA-Z0-9])${escapedBrand}(?:$|[^a-zA-Z0-9])`, "i").test(clean)) {
          return med;
        }
      }
      for (const ingredient of med.activeIngredients || []) {
        if (ingredient.name.length < 3) continue;
        const escapedIng = ingredient.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (new RegExp(`(?:^|[^a-zA-Z0-9])${escapedIng}(?:$|[^a-zA-Z0-9])`, "i").test(clean)) {
          return med;
        }
      }
    }

    // 2. Check brand to active ingredient map
    for (const [brand, ingredient] of Object.entries(BRAND_TO_ACTIVE_INGREDIENT_MAP)) {
      if (brand.length < 3) continue;
      const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`(?:^|[^a-zA-Z0-9])${escaped}(?:$|[^a-zA-Z0-9])`, "i").test(clean)) {
        const found = await this.provider.getByNameOrBrand(ingredient);
        if (found) return found;
      }
    }

    return null;
  }

  async askQuestion(input: AskMedicationAiInput): Promise<MedicationAiQueryResult> {
    const { medicationId, medicationName, question, patientContext } = input;
    const cleanQuestion = question.trim();

    // 1. FAST EMERGENCY ESCALATION
    const isEmergency =
      detectMedicationEmergency(cleanQuestion) ||
      checkEmergencyRules({
        text: cleanQuestion,
        age: patientContext?.ageYears,
        pregnancy: patientContext?.pregnancy,
      }).emergencyDetected;

    if (isEmergency) {
      return {
        answer:
          "🚨 **CRITICAL MEDICAL EMERGENCY DETECTED**\n\nYour question describes symptoms or circumstances consistent with an acute medication overdose, toxic ingestion, or severe allergic reaction. **Do not wait for further AI advice or search results.**\n\n- **Call Emergency 112 immediately** (or your local emergency ambulance service).\n- If the patient is unconscious, place them in the recovery position on their side.\n- Keep the medication packaging, bottle, or blister strip ready to show emergency responders.\n- Do not induce vomiting unless specifically instructed by poison control or emergency doctors.",
        safetyWarnings: [
          "Emergency clinical situation: immediate hospital emergency department care required.",
          "Do not administer home remedies or induce vomiting without emergency direction.",
        ],
        limitations: ["Emergency triage takes absolute precedence over all medication educational content."],
        sourceCitations: [
          {
            title: "National Ambulance Service Emergency Protocol / Ghana Poison Control",
            jurisdiction: "GH",
            lastReviewedAt: new Date().toISOString(),
          },
        ],
        pharmacistQuestions: [],
        followUpQuestion: null,
        isEmergency: true,
        emergencyInstructions: "Call 112 immediately for emergency medical transport.",
      };
    }

    // 2. RESOLVE MEDICATION RECORD
    let med: ApprovedMedication | null = null;
    const hasMedicationId = Boolean(medicationId && medicationId !== "general");
    const hasMedicationName = Boolean(medicationName && medicationName.toLowerCase() !== "general");

    if (hasMedicationId) {
      med = await this.provider.getById(medicationId!);
    }
    if (!med && hasMedicationName) {
      med = await this.provider.getByNameOrBrand(medicationName!);
    }
    // Fallback: extract medication directly from the question text
    if (!med) {
      med = await this.extractMedicationFromText(cleanQuestion);
    }

    // 3. AMBIGUOUS OR UNRESOLVED MEDICATION
    if (!med) {
      // If a specific medication name was provided by the user but could not be resolved
      if (hasMedicationName) {
        const searchMatches = await this.provider.search(medicationName!, { limit: 4 });

        if (searchMatches.length > 0) {
          const clarificationOptions: ClarificationOption[] = searchMatches.map((m) => ({
            medicationId: m.id,
            displayName: m.genericName,
            formulation: m.availableForms?.[0]?.form,
            strength: m.activeIngredients?.[0]?.strength,
          }));

          return {
            answer: `I found several possible medicines matching **"${medicationName}"**. To give you accurate, verified safety guidance, please select or clarify the specific medicine and formulation you are asking about:`,
            ambiguousMatches: clarificationOptions,
            safetyWarnings: [
              "Medication names and active ingredients must be confirmed before taking any medication.",
            ],
            limitations: [
              "Clinix only provides guidance grounded in verified regulatory medication labels.",
            ],
            sourceCitations: [],
            pharmacistQuestions: [
              "What is the exact active ingredient and strength of this medicine?",
              "Is this the exact product recommended for my condition?",
            ],
            followUpQuestion: `Did you mean ${searchMatches
              .map((m) => m.genericName)
              .slice(0, 3)
              .join(", ")}?`,
            isEmergency: false,
          };
        }

        return {
          answer: `I could not locate **"${medicationName}"** in the verified national formulary or official label database. To protect patient safety, Clinix does not guess or provide speculative information for unverified medicines. Please consult a licensed pharmacist or medical practitioner for accurate information.`,
          safetyWarnings: [
            "Unverified medicine: never take unknown or unlabelled medications.",
          ],
          limitations: [
            "Only verified regulatory medicines registered with official health authorities are supported.",
          ],
          sourceCitations: [],
          pharmacistQuestions: [
            "Can you confirm the registered brand or generic name for this medicine?",
            "Are there approved equivalents in the national formulary?",
          ],
          followUpQuestion: null,
          isEmergency: false,
        };
      }

      // General medication inquiry where no specific medicine was identified
      return {
        answer: `### Verified Medication Information & Safety\n\nClinix provides clinical guidance grounded in official regulatory formularies (including the Ghana FDA and US DailyMed). To review verified uses, precautions, contraindications, and potential interactions, please select a medicine from the topic dropdown above or mention it by name (for example: **Paracetamol**, **Amoxicillin**, **Ibuprofen**, or **Metformin**).\n\n**General Medication Safety Principles:**\n- Always verify the active ingredient and strength on the manufacturer box or blister packaging.\n- Never alter dosages or discontinue prescription medicines without consulting your physician.\n- Tell your pharmacist about all other medicines, supplements, or herbal remedies you are taking to prevent harmful drug interactions.\n- If you suspect an overdose, severe swelling, or trouble breathing, call **112** immediately.`,
        safetyWarnings: [
          "No specific medicine identified. Please name the medicine or select a topic from the dropdown.",
          "Never take unknown or unlabelled medications.",
        ],
        limitations: [
          "Only verified regulatory medicines registered with official health authorities are supported.",
        ],
        sourceCitations: [
          {
            title: "Ghana National Drug Formulary / WHO Essential Medicines",
            jurisdiction: "GH",
            lastReviewedAt: new Date().toISOString(),
          },
        ],
        pharmacistQuestions: [
          "Can you recommend the appropriate registered medication for my symptoms?",
          "What dosage and timing should I follow for my condition?",
        ],
        followUpQuestion: "Which specific medicine would you like to review safety information for?",
        isEmergency: false,
      };
    }

    // 4. CHECK DOSAGE INQUIRY
    const isDosageRequest = detectDosageInquiry(cleanQuestion);
    let dosageRefusal = "";
    if (isDosageRequest) {
      dosageRefusal = `\n\n⚠️ **Dosage Safety Policy:** Clinix does not calculate or recommend individual drug dosages. Safe dosing requires weighing the patient, checking renal/hepatic function, and reviewing your doctor's instructions. The standard label information below is educational only. Always follow the manufacturer box instructions or speak with a licensed pharmacist.`;
    }

    // 5. GROUNDED AI ANSWER GENERATION
    const isPrescriptionOnly = med.classification === "prescription_only";
    const classificationLabel = isPrescriptionOnly
      ? "Prescription-Only Medicine (POM)"
      : "Over-The-Counter (OTC)";

    const sources = [
      {
        title: med.referenceSource.name,
        jurisdiction: med.referenceSource.jurisdiction,
        lastReviewedAt: med.referenceSource.lastReviewedAt,
        url: med.officialLabelUrl || med.referenceSource.sourceUrl,
      },
    ];

    const pharmacistQuestions = [
      `What is the appropriate dosage of ${med.genericName} for my specific age, weight, and health status?`,
      `Are there any interactions between ${med.genericName} and any other medicines or herbal remedies I take?`,
      `What should I do if I experience side effects or miss a dose?`,
    ];

    // If AI is configured, generate dynamic grounded response
    if (isNvidiaConfigured()) {
      try {
        const client = getNvidiaClient();
        const systemPrompt = `You are the Clinix Medication Assistant, a clinical healthcare AI providing verified educational information.
CRITICAL CLINICAL RULES:
1. STRICT FACTUAL GROUNDING: Rely ONLY on the provided medicine record. Never invent interactions, unlisted uses, or non-approved indications.
2. NEVER PRESCRIBE: You cannot prescribe, initiate prescription-only medicines, or calculate individualized doses (mg, ml, or tablet count).
3. IF DOSAGE ASKED: Clearly state that individualized dosages must be determined by a registered pharmacist or physician. Reference packaging guidance generally.
4. TONE: Compassionate, professional, objective, plain English.
5. CONCISE: Provide clear headings, bullet points, and highlight warnings.
6. SOURCE CITATION: End with regulatory source attribution and date.`;

        const userPrompt = `Patient Question: "${cleanQuestion}"

Verified Medicine Record:
- Generic Name: ${med.genericName}
- Brand Names: ${med.brandNames.join(", ") || "None"}
- Therapeutic Class: ${med.therapeuticClass}
- Classification: ${classificationLabel}
- Approved Uses: ${med.approvedIndications.join("; ")}
- Active Ingredients: ${med.activeIngredients?.map((a) => `${a.name} ${a.strength || ""}`).join(", ") || med.genericName}
- Available Forms: ${med.availableForms?.map((f) => `${f.form} (${f.standardStrength || ""})`).join(", ") || med.dosageForms?.join(", ") || "Standard"}
- Key Precautions & Warnings: ${med.administrationWarnings.join("; ")}
- Contraindications: ${med.contraindications.map((c) => `${c.condition}: ${c.explanation}`).join("; ")}
- Common Side Effects: ${med.commonSideEffects.join("; ")}
- Serious Adverse Effects: ${med.seriousAdverseEffects?.join("; ") || "Anaphylaxis, severe hypersensitivity"}
- Interactions: ${med.interactions.map((i) => `${i.medicineOrClass} (${i.effect})`).join("; ")}
- Food/Alcohol Warnings: ${med.foodAlcoholInteractions?.map((f) => `${f.item}: ${f.warning}`).join("; ") || "Follow packaging"}
- Storage: ${med.storageAndHandling || "Store in a dry, cool place"}
- Source Authority: ${med.referenceSource.name} (${med.referenceSource.jurisdiction})
- Last Reviewed: ${med.referenceSource.lastReviewedAt}

Answer the patient's question clearly, grounded solely in the above verified record. Highlight safety warnings and when to consult a pharmacist.`;

        const completion = await client.chat.completions.create({
          model: MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.2,
          max_tokens: 650,
        });

        const generatedAnswer = completion.choices[0]?.message?.content;
        if (generatedAnswer && generatedAnswer.trim().length > 20) {
          return {
            answer: generatedAnswer + dosageRefusal,
            medicationIdentified: {
              id: med.id,
              genericName: med.genericName,
              classification: med.classification,
              formulation: med.availableForms?.[0]?.form,
            },
            safetyWarnings: med.administrationWarnings.slice(0, 3),
            limitations: [
              "Medication guidance is educational and does not constitute a clinical prescription.",
              "Always check the manufacturer packaging leaflet and consult a registered pharmacist.",
            ],
            sourceCitations: sources,
            pharmacistQuestions,
            followUpQuestion: `Would you like to review common side effects or check drug interactions for ${med.genericName}?`,
            isEmergency: false,
          };
        }
      } catch (err) {
        console.warn("[MedicationAiService] AI generation failed, falling back to deterministic grounding:", err);
      }
    }

    // Deterministic High-Quality Grounded Template Fallback
    const uses = med.approvedIndications.join(", ");
    const commonEffects = med.commonSideEffects.join(", ");
    const warnings = med.administrationWarnings.join(" ");

    let defaultAnswer = `### **${med.genericName}** (${classificationLabel})\n\n`;
    defaultAnswer += `**Approved Uses:**\n${uses}\n\n`;
    defaultAnswer += `**Important Safety Precautions:**\n${warnings}\n\n`;
    defaultAnswer += `**Common Side Effects:**\n${commonEffects}\n\n`;

    if (med.boxedWarning) {
      defaultAnswer += `⚠️ **Boxed Warning:** ${med.boxedWarning}\n\n`;
    }

    if (isPrescriptionOnly) {
      defaultAnswer += `*Note: ${med.genericName} is a Prescription-Only Medicine (POM). It requires a formal clinical examination and valid prescription by a licensed physician before initiation.*\n\n`;
    }

    defaultAnswer += `*Source: ${med.referenceSource.name} (${med.referenceSource.jurisdiction}) — Last Reviewed: ${new Date(
      med.referenceSource.lastReviewedAt
    ).toLocaleDateString()}*`;

    return {
      answer: defaultAnswer + dosageRefusal,
      medicationIdentified: {
        id: med.id,
        genericName: med.genericName,
        classification: med.classification,
        formulation: med.availableForms?.[0]?.form,
      },
      safetyWarnings: med.administrationWarnings.slice(0, 3),
      limitations: [
        "Educational reference only. Does not replace individualized clinical prescription or pharmacist evaluation.",
      ],
      sourceCitations: sources,
      pharmacistQuestions,
      followUpQuestion: `Do you have questions about potential side effects or storage for ${med.genericName}?`,
      isEmergency: false,
    };
  }
}

export const defaultMedicationAiService = new MedicationAiService();
