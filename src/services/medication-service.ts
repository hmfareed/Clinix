import {
  ApprovedMedication,
  IMedicationKnowledgeProvider,
  MedicationEvaluationResult,
  PatientMedicationContext,
  MedicationSearchOptions,
  MultiDrugSafetyCheckResult,
  MedicationAiQueryResult,
} from "@/lib/medication/types";
import { defaultCompositeMedicationProvider } from "@/lib/medication/composite-provider";
import { evaluateMedicationSafety } from "@/lib/medication/safety-evaluator";
import { evaluateMultiDrugSafety } from "@/lib/medication/interaction-checker";
import { defaultMedicationAiService, AskMedicationAiInput } from "@/services/medication-ai-service";
import { logAuditEvent } from "@/lib/audit/audit";

export interface MedicationQueryInput {
  query: string;
  context: PatientMedicationContext;
  actorId?: string;
  ip?: string | null;
}

export class MedicationService {
  private provider: IMedicationKnowledgeProvider;

  constructor(provider: IMedicationKnowledgeProvider = defaultCompositeMedicationProvider) {
    this.provider = provider;
  }

  async getMedicationGuidance(
    input: MedicationQueryInput
  ): Promise<MedicationEvaluationResult> {
    const { query, context, actorId, ip } = input;

    // 1. Resolve medication from approved reference knowledge provider
    const medication = await this.provider.getByNameOrBrand(query);

    // 2. Perform independent clinical safety evaluation
    const evaluation = evaluateMedicationSafety(medication, context);

    // 3. Log security and clinical audit event (privacy preserving)
    try {
      await logAuditEvent({
        actorId,
        actorRole: actorId ? "patient" : "guest",
        action: "MEDICATION_GUIDANCE_QUERY",
        resourceType: "MedicalReference",
        resourceId: medication ? medication.id : undefined,
        outcome: evaluation.status === "emergency_blocked" ? "error" : "success",
        ip,
        metadata: {
          queryNormalized: query.toLowerCase().slice(0, 50),
          status: evaluation.status,
          referralRequired: evaluation.referral.required,
          specialist: evaluation.referral.recommendedSpecialist,
          missingFieldsCount: evaluation.missingCriticalFields.length,
          hasDosageRefusal: Boolean(evaluation.dosageRefusalNotice),
          alertsCount: evaluation.contraindicationAlerts.length,
        },
      });
    } catch {
      // Audit failure must never prevent clinical guidance or fail unsafe
    }

    return evaluation;
  }

  async searchMedications(searchTerm: string): Promise<ApprovedMedication[]> {
    return this.provider.search(searchTerm);
  }

  async searchMedicationsWithFilters(
    searchTerm: string,
    options?: MedicationSearchOptions
  ): Promise<ApprovedMedication[]> {
    return this.provider.search(searchTerm, options);
  }

  async getMedicationById(id: string): Promise<ApprovedMedication | null> {
    return this.provider.getById(id);
  }

  async getByNameOrBrand(name: string): Promise<ApprovedMedication | null> {
    return this.provider.getByNameOrBrand(name);
  }

  async getAllApproved(): Promise<ApprovedMedication[]> {
    return this.provider.getAll();
  }

  async checkMultiDrugSafety(input: {
    medicationNamesOrIds: string[];
    context: PatientMedicationContext;
    actorId?: string;
    ip?: string | null;
  }): Promise<MultiDrugSafetyCheckResult> {
    const { medicationNamesOrIds, context, actorId, ip } = input;
    const result = await evaluateMultiDrugSafety(medicationNamesOrIds, context);

    try {
      await logAuditEvent({
        actorId,
        actorRole: actorId ? "patient" : "guest",
        action: "MEDICATION_MULTI_SAFETY_CHECK",
        resourceType: "MedicalReference",
        outcome: result.emergencyDetected ? "error" : "success",
        ip,
        metadata: {
          medCount: medicationNamesOrIds.length,
          status: result.status,
          duplicateCount: result.duplicateIngredients.length,
          interactionsCount: result.interactions.length,
          alertsCount: result.contraindicationAlerts.length,
        },
      });
    } catch {
      // Audit failure must never prevent safety guidance
    }

    return result;
  }

  async askMedicationAi(
    input: AskMedicationAiInput & { actorId?: string; ip?: string | null }
  ): Promise<MedicationAiQueryResult> {
    const { actorId, ip, ...queryInput } = input;
    const result = await defaultMedicationAiService.askQuestion(queryInput);

    try {
      await logAuditEvent({
        actorId,
        actorRole: actorId ? "patient" : "guest",
        action: "MEDICATION_AI_QUESTION",
        resourceType: "MedicalReference",
        outcome: result.isEmergency ? "error" : "success",
        ip,
        metadata: {
          medicationIdentified: result.medicationIdentified?.genericName,
          isEmergency: result.isEmergency,
        },
      });
    } catch {
      // Audit non-blocking
    }

    return result;
  }
}

export const defaultMedicationService = new MedicationService();
