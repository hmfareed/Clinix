import {
  ApprovedMedication,
  IMedicationKnowledgeProvider,
  MedicationEvaluationResult,
  PatientMedicationContext,
} from "@/lib/medication/types";
import { defaultMedicationProvider } from "@/lib/medication/ghana-provider";
import { evaluateMedicationSafety } from "@/lib/medication/safety-evaluator";
import { logAuditEvent } from "@/lib/audit/audit";

export interface MedicationQueryInput {
  query: string;
  context: PatientMedicationContext;
  actorId?: string;
  ip?: string | null;
}

export class MedicationService {
  private provider: IMedicationKnowledgeProvider;

  constructor(provider: IMedicationKnowledgeProvider = defaultMedicationProvider) {
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

  async getAllApproved(): Promise<ApprovedMedication[]> {
    return this.provider.getAll();
  }
}

export const defaultMedicationService = new MedicationService();
