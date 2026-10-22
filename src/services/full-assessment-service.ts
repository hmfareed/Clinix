import mongoose from "mongoose";
import { connectToDatabase, tryConnectToDatabase, isDatabaseConnected } from "@/lib/db/mongodb";
import Assessment, { IAssessment, AssessmentStatus } from "@/models/Assessment";
import AssistantConversation from "@/models/AssistantConversation";
import AssistantMessage from "@/models/AssistantMessage";
import { AssistantAuthContext } from "@/services/clinix-assistant-service";
import {
  detectSymptomPathway,
  getNextAdaptiveQuestion,
  hasEnoughInfoForEvaluation,
  SymptomPathway,
} from "@/lib/assistant/symptom-adaptive-questions";
import { checkEmergencyRules } from "@/lib/safety/triage-engine";
import { assessSymptoms } from "@/services/assessment-service";
import { getEmergencyConfiguration } from "@/lib/emergency/emergency-config";

export interface AssessmentContextResult {
  hasActiveDraft: boolean;
  isOffline?: boolean;
  activeDraft?: {
    id: string;
    primarySymptom?: string;
    status: AssessmentStatus;
    currentStep: number;
    lastSavedAt?: string;
    createdAt: string;
  };
  hasRecentConversation: boolean;
  recentConversation?: {
    id: string;
    title: string;
    lastActiveAt: string;
    messageCount: number;
    previewSymptoms: string;
    extractedFacts: {
      known: Array<{ label: string; value: string; source: "patient" | "conversation" | "inferred" }>;
      unknown: Array<{ label: string; reason?: string }>;
    };
  };
}

export class FullAssessmentService {
  /**
   * Resilient in-memory assessment cache used when MongoDB is offline
   * or during local development/demo sessions.
   */
  private inMemoryAssessments = new Map<string, any>();

  /**
   * Helper to verify ownership by user ID or linked guest conversation
   */
  async verifyOwnership(
    assessment: any,
    authContext: AssistantAuthContext
  ): Promise<void> {
    const patientIdStr = assessment.patientId?.toString();
    if (authContext.userId && patientIdStr === authContext.userId) {
      return;
    }

    // Check if the assessment is tied to an authorized conversation (e.g. guest session)
    if (assessment.conversationId) {
      if (await tryConnectToDatabase()) {
        try {
          const conv = await AssistantConversation.findById(assessment.conversationId).lean();
          if (conv) {
            if (authContext.userId && conv.userId?.toString() === authContext.userId) {
              return;
            }
            if (authContext.guestTokenHash && conv.guestTokenHash === authContext.guestTokenHash) {
              return;
            }
          }
        } catch {
          // Ignore DB error during ownership check
        }
      }
    }

    // If user is guest and created during current session
    if (authContext.guestTokenHash || (!authContext.userId && assessment.isDraft)) {
      return;
    }

    throw new Error("You do not have permission to access this assessment record.");
  }

  /**
   * Discovers existing drafts and recent conversation context for initial choice
   */
  async getAssessmentContext(authContext: AssistantAuthContext): Promise<AssessmentContextResult> {
    const dbAvailable = await tryConnectToDatabase();

    const result: AssessmentContextResult = {
      hasActiveDraft: false,
      hasRecentConversation: false,
      isOffline: !dbAvailable,
    };

    if (!dbAvailable) {
      // Check in-memory store for active draft
      for (const draft of this.inMemoryAssessments.values()) {
        if (draft.isDraft && ["draft", "collecting_information", "screening", "ready_for_review"].includes(draft.status)) {
          if (!authContext.userId || draft.patientId?.toString() === authContext.userId) {
            result.hasActiveDraft = true;
            result.activeDraft = {
              id: String(draft._id),
              primarySymptom: draft.primaryComplaint?.symptom || draft.symptoms?.[0]?.description,
              status: draft.status as AssessmentStatus,
              currentStep: draft.interviewProgress?.currentStep || 1,
              lastSavedAt: draft.lastSavedAt instanceof Date ? draft.lastSavedAt.toISOString() : draft.lastSavedAt,
              createdAt: draft.createdAt instanceof Date ? draft.createdAt.toISOString() : draft.createdAt,
            };
            break;
          }
        }
      }
      return result;
    }

    try {
      await connectToDatabase();

      // 1. Check for active incomplete drafts
      const draftQuery: Record<string, unknown> = {
        status: { $in: ["draft", "collecting_information", "screening", "ready_for_review"] },
        isDraft: true,
      };

      if (authContext.userId) {
        draftQuery.patientId = new mongoose.Types.ObjectId(authContext.userId);
      }

      const draft = await Assessment.findOne(draftQuery).sort({ updatedAt: -1 }).lean();
      if (draft) {
        result.hasActiveDraft = true;
        result.activeDraft = {
          id: String(draft._id),
          primarySymptom: draft.primaryComplaint?.symptom || draft.symptoms?.[0]?.description,
          status: draft.status as AssessmentStatus,
          currentStep: draft.interviewProgress?.currentStep || 1,
          lastSavedAt: draft.lastSavedAt ? draft.lastSavedAt.toISOString() : draft.updatedAt?.toISOString(),
          createdAt: draft.createdAt.toISOString(),
        };
      }

      // 2. Check for recent conversation
      const convQuery: Record<string, unknown> = { status: "active" };
      if (authContext.userId) {
        convQuery.userId = new mongoose.Types.ObjectId(authContext.userId);
      } else if (authContext.guestTokenHash) {
        convQuery.guestTokenHash = authContext.guestTokenHash;
      } else {
        return result;
      }

      const recentConv = await AssistantConversation.findOne(convQuery).sort({ lastActiveAt: -1 }).lean();
      if (recentConv) {
        const messages = await AssistantMessage.find({ conversationId: recentConv._id })
          .sort({ createdAt: 1 })
          .lean();

        const patientMessages = messages.filter((m) => m.role === "patient");
        if (patientMessages.length > 0) {
          result.hasRecentConversation = true;

          const allPatientText = patientMessages.map((m) => m.content).join(" ");
          const firstMessage = patientMessages[0].content;

          // Extract known facts
          const known: Array<{ label: string; value: string; source: "patient" | "conversation" | "inferred" }> = [];
          const unknown: Array<{ label: string; reason?: string }> = [];

          known.push({
            label: "Reported Complaint",
            value: firstMessage,
            source: "patient",
          });

          // Infer onset if mentioned
          const lowerAll = allPatientText.toLowerCase();
          if (lowerAll.includes("sudden") || lowerAll.includes("all of a sudden")) {
            known.push({ label: "Onset", value: "Sudden onset", source: "conversation" });
          } else if (lowerAll.includes("gradual") || lowerAll.includes("slowly")) {
            known.push({ label: "Onset", value: "Gradual onset", source: "conversation" });
          } else {
            unknown.push({ label: "Onset Timing", reason: "Not specified in chat" });
          }

          // Infer duration if mentioned
          if (lowerAll.includes("today") || lowerAll.includes("hour")) {
            known.push({ label: "Duration", value: "Started today", source: "conversation" });
          } else if (lowerAll.includes("yesterday")) {
            known.push({ label: "Duration", value: "Since yesterday", source: "conversation" });
          } else if (lowerAll.includes("week") || lowerAll.includes("days")) {
            known.push({ label: "Duration", value: "Several days / weeks", source: "conversation" });
          } else {
            unknown.push({ label: "Duration", reason: "Not specified in chat" });
          }

          result.recentConversation = {
            id: String(recentConv._id),
            title: recentConv.title,
            lastActiveAt: recentConv.lastActiveAt.toISOString(),
            messageCount: messages.length,
            previewSymptoms: firstMessage.slice(0, 140),
            extractedFacts: { known, unknown },
          };
        }
      }
    } catch (err) {
      console.warn("[ASSESSMENT CONTEXT FALLBACK] Falling back to offline context:", err);
      result.isOffline = true;
    }

    return result;
  }

  /**
   * Initializes a Full Assessment session
   */
  async initAssessment(options: {
    authContext: AssistantAuthContext;
    source: "new" | "conversation" | "resume";
    conversationId?: string;
    draftId?: string;
  }): Promise<IAssessment> {
    const { authContext, source, conversationId, draftId } = options;

    // A. Resume existing draft
    if (source === "resume" && draftId) {
      const existing = await this.getAssessment(draftId, authContext);
      if (!existing) {
        throw new Error("Draft assessment not found.");
      }
      return existing;
    }

    const patientObjectId = authContext.userId
      ? new mongoose.Types.ObjectId(authContext.userId)
      : new mongoose.Types.ObjectId();

    const dbAvailable = await tryConnectToDatabase();

    // If DB is offline, create in-memory record
    if (!dbAvailable) {
      return this.createInMemoryAssessment({
        patientId: patientObjectId,
        source,
        conversationId,
      });
    }

    try {
      await connectToDatabase();

      // B. Import from conversation
      if (source === "conversation" && conversationId) {
        const conv = await AssistantConversation.findById(conversationId);
        if (!conv) {
          throw new Error("Conversation not found.");
        }

        const messages = await AssistantMessage.find({ conversationId: conv._id })
          .sort({ createdAt: 1 })
          .lean();

        const patientMsgs = messages.filter((m) => m.role === "patient");
        const primarySymptom = patientMsgs[0]?.content || "General health concern";
        const fullText = patientMsgs.map((m) => m.content).join(" ");

        const lower = fullText.toLowerCase();
        let onset: "sudden" | "gradual" | "not_sure" = "not_sure";
        if (lower.includes("sudden")) onset = "sudden";
        else if (lower.includes("gradual")) onset = "gradual";

        let duration: "started_today" | "since_yesterday" | "several_days" | "several_weeks_or_longer" = "several_days";
        if (lower.includes("today") || lower.includes("hour")) duration = "started_today";
        else if (lower.includes("yesterday")) duration = "since_yesterday";
        else if (lower.includes("week") || lower.includes("month")) duration = "several_weeks_or_longer";

        const pathway = detectSymptomPathway(fullText);
        const firstQ = getNextAdaptiveQuestion(pathway, []);

        const knownFacts = [
          { label: "Primary Complaint", value: primarySymptom, source: "patient" as const },
          { label: "Onset Pattern", value: onset === "sudden" ? "Sudden onset" : onset === "gradual" ? "Gradual onset" : "Unspecified", source: "conversation" as const },
          { label: "Duration", value: duration.replace(/_/g, " "), source: "conversation" as const },
        ];

        const unknownFacts = [
          { label: "Medical History", reason: "Needs patient confirmation" },
          { label: "Allergies & Current Medications", reason: "Needs patient confirmation" },
          { label: "Emergency Red Flags", reason: "Pending safety screening" },
        ];

        const newAssessment = await Assessment.create({
          patientId: patientObjectId,
          conversationId: conv._id,
          status: "collecting_information",
          isDraft: true,
          lastSavedAt: new Date(),
          primaryComplaint: {
            symptom: primarySymptom,
            onset,
            duration,
            severity: "moderate",
          },
          reportedFacts: {
            known: knownFacts,
            unknown: unknownFacts,
          },
          interviewProgress: {
            currentStep: 2,
            pathway,
            answeredQuestions: [],
            currentQuestion: firstQ,
          },
          symptoms: patientMsgs.map((m) => ({ description: m.content })),
          urgency: "routine",
          summary: "Assessment initiated from conversation.",
          possibleConditions: [],
          recommendations: [],
          limitations: ["Initial interview in progress. Not a medical diagnosis."],
          triage: {
            level: "routine",
            ruleSetVersion: "1.0",
            checkedAt: new Date(),
          },
          aiMetadata: {
            provider: "NVIDIA",
            model: "meta/llama-3.1-70b-instruct",
            promptVersion: "assessment-v1",
          },
        });

        conv.assessmentId = newAssessment._id as mongoose.Types.ObjectId;
        await conv.save();

        return newAssessment;
      }

      // C. Start completely fresh
      const defaultPathway = "general";
      const firstQ = getNextAdaptiveQuestion(defaultPathway, []);

      const newAssessment = await Assessment.create({
        patientId: patientObjectId,
        status: "draft",
        isDraft: true,
        lastSavedAt: new Date(),
        primaryComplaint: {
          symptom: "",
        },
        reportedFacts: {
          known: [],
          unknown: [
            { label: "Primary Complaint", reason: "Not yet reported" },
            { label: "Medical History", reason: "Not yet reported" },
            { label: "Allergies", reason: "Not yet reported" },
          ],
        },
        interviewProgress: {
          currentStep: 1,
          pathway: defaultPathway,
          answeredQuestions: [],
          currentQuestion: firstQ,
        },
        symptoms: [],
        urgency: "routine",
        summary: "Draft assessment started.",
        possibleConditions: [],
        recommendations: [],
        limitations: ["Assessment in progress."],
        triage: {
          level: "routine",
          ruleSetVersion: "1.0",
          checkedAt: new Date(),
        },
        aiMetadata: {
          provider: "NVIDIA",
          model: "meta/llama-3.1-70b-instruct",
          promptVersion: "assessment-v1",
        },
      });

      return newAssessment;
    } catch (err) {
      console.warn("[INIT ASSESSMENT FALLBACK] DB connection failed, using in-memory assessment:", err);
      return this.createInMemoryAssessment({
        patientId: patientObjectId,
        source,
        conversationId,
      });
    }
  }

  /**
   * Helper to create an in-memory assessment record
   */
  private createInMemoryAssessment(options: {
    patientId: mongoose.Types.ObjectId;
    source: "new" | "conversation" | "resume";
    conversationId?: string;
  }): IAssessment {
    const id = new mongoose.Types.ObjectId();
    const defaultPathway = "general";
    const firstQ = getNextAdaptiveQuestion(defaultPathway, []);

    const now = new Date();
    const doc: any = {
      _id: id,
      id: String(id),
      patientId: options.patientId,
      conversationId: options.conversationId ? new mongoose.Types.ObjectId(options.conversationId) : undefined,
      status: "draft",
      isDraft: true,
      lastSavedAt: now,
      createdAt: now,
      updatedAt: now,
      primaryComplaint: {
        symptom: "",
      },
      reportedFacts: {
        known: [],
        unknown: [
          { label: "Primary Complaint", reason: "Not yet reported" },
          { label: "Medical History", reason: "Not yet reported" },
          { label: "Allergies", reason: "Not yet reported" },
        ],
      },
      interviewProgress: {
        currentStep: 1,
        pathway: defaultPathway,
        answeredQuestions: [],
        currentQuestion: firstQ,
      },
      symptoms: [],
      urgency: "routine",
      summary: "Draft assessment started (session mode).",
      possibleConditions: [],
      recommendations: [],
      limitations: ["Assessment in progress."],
      triage: {
        level: "routine",
        ruleSetVersion: "1.0",
        checkedAt: now,
      },
      aiMetadata: {
        provider: "NVIDIA",
        model: "meta/llama-3.1-70b-instruct",
        promptVersion: "assessment-v1",
      },
      save: async function () {
        this.updatedAt = new Date();
        this.lastSavedAt = new Date();
        return this;
      },
      toObject: function () {
        return { ...this };
      },
    };

    this.inMemoryAssessments.set(String(id), doc);
    return doc as unknown as IAssessment;
  }

  /**
   * Retrieves an assessment record by ID (from in-memory or DB)
   */
  async getAssessment(
    id: string,
    authContext: AssistantAuthContext
  ): Promise<IAssessment | null> {
    const mem = this.inMemoryAssessments.get(id);
    if (mem) {
      await this.verifyOwnership(mem, authContext);
      return mem as IAssessment;
    }

    if (await tryConnectToDatabase()) {
      try {
        await connectToDatabase();
        if (mongoose.Types.ObjectId.isValid(id)) {
          const doc = await Assessment.findById(id);
          if (doc) {
            await this.verifyOwnership(doc, authContext);
            return doc;
          }
        }
      } catch (err) {
        console.warn("[GET ASSESSMENT ERROR]", err);
      }
    }

    return null;
  }

  /**
   * Updates assessment draft fields and performs independent emergency check
   */
  async updateDraft(
    assessmentId: string,
    authContext: AssistantAuthContext,
    updates: {
      patientInfo?: { age?: number; gender?: string; pregnancy?: "yes" | "no" | "unknown" | "not_applicable" };
      primaryComplaint?: {
        symptom: string;
        affectedArea?: string;
        onset?: "sudden" | "gradual" | "not_sure";
        duration?: "started_today" | "since_yesterday" | "several_days" | "several_weeks_or_longer";
        severity?: "mild" | "moderate" | "severe";
      };
      medicalHistory?: {
        conditions?: string[];
        allergies?: { status: "yes" | "no" | "unknown"; items?: string[] };
        currentMedications?: { status: "yes" | "no" | "unknown"; items?: string[] };
      };
      warningSignsReported?: boolean;
      currentStep?: number;
    }
  ): Promise<IAssessment> {
    const mem = this.inMemoryAssessments.get(assessmentId);
    let assessment: any = mem;

    if (!assessment) {
      if (await tryConnectToDatabase()) {
        await connectToDatabase();
        assessment = await Assessment.findById(assessmentId);
      }
    }

    if (!assessment) {
      throw new Error("Assessment not found.");
    }
    await this.verifyOwnership(assessment, authContext);

    // 1. Independent clinical safety check
    const symptomText = updates.primaryComplaint?.symptom || assessment.primaryComplaint?.symptom || "";
    const emergencyCheck = checkEmergencyRules({
      text: symptomText,
      symptoms: symptomText,
      age: updates.patientInfo?.age ?? assessment.patientInfo?.age,
      allergies: updates.medicalHistory?.allergies ?? assessment.medicalHistory?.allergies,
      currentMedicines: updates.medicalHistory?.currentMedications ?? assessment.medicalHistory?.currentMedications,
      pregnancy: updates.patientInfo?.pregnancy ?? assessment.patientInfo?.pregnancy,
    });

    if (updates.warningSignsReported || emergencyCheck.emergencyDetected) {
      const emergencyConfig = await getEmergencyConfiguration("GH");
      assessment.status = "escalated";
      assessment.urgency = "emergency";
      assessment.isDraft = false;
      assessment.summary =
        emergencyCheck.patientMessage ||
        "POTENTIAL MEDICAL EMERGENCY DETECTED: Critical warning signs require immediate in-person emergency care.";
      assessment.recommendations = [
        `Call ${emergencyConfig.emergencyNumber} (${emergencyConfig.serviceName}) immediately.`,
        "Do not drive yourself. Have an ambulance or someone else take you to the nearest emergency facility.",
      ];
      assessment.limitations = [
        "Assessment halted for patient safety due to emergency warning signs.",
      ];
      assessment.lastSavedAt = new Date();
      await assessment.save();
      return assessment;
    }

    // 2. Apply updates
    if (updates.patientInfo) {
      assessment.patientInfo = {
        ...assessment.patientInfo,
        ...updates.patientInfo,
      };
    }

    if (updates.primaryComplaint) {
      assessment.primaryComplaint = {
        ...assessment.primaryComplaint,
        ...updates.primaryComplaint,
      };

      // Detect pathway & pick first adaptive question
      const pathway = detectSymptomPathway(updates.primaryComplaint.symptom);
      if (!assessment.interviewProgress) {
        assessment.interviewProgress = {
          currentStep: updates.currentStep || 2,
          pathway,
          answeredQuestions: [],
          currentQuestion: getNextAdaptiveQuestion(pathway, []),
        };
      } else {
        assessment.interviewProgress.pathway = pathway;
        if (!assessment.interviewProgress.currentQuestion) {
          assessment.interviewProgress.currentQuestion = getNextAdaptiveQuestion(pathway, []);
        }
      }

      // Update symptoms array
      assessment.symptoms = [
        {
          description: updates.primaryComplaint.symptom,
          onset: updates.primaryComplaint.onset,
          severity: updates.primaryComplaint.severity,
        },
      ];
    }

    if (updates.medicalHistory) {
      assessment.medicalHistory = {
        ...assessment.medicalHistory,
        ...updates.medicalHistory,
      };
    }

    if (updates.currentStep && assessment.interviewProgress) {
      assessment.interviewProgress.currentStep = updates.currentStep;
    }

    // Rebuild reported facts
    const known: Array<{ label: string; value: string; source: "patient" | "conversation" | "inferred" }> = [];
    const unknown: Array<{ label: string; reason?: string }> = [];

    if (assessment.primaryComplaint?.symptom) {
      known.push({ label: "Primary Complaint", value: assessment.primaryComplaint.symptom, source: "patient" });
    }
    if (assessment.primaryComplaint?.onset) {
      known.push({ label: "Onset", value: assessment.primaryComplaint.onset.replace(/_/g, " "), source: "patient" });
    }
    if (assessment.primaryComplaint?.duration) {
      known.push({ label: "Duration", value: assessment.primaryComplaint.duration.replace(/_/g, " "), source: "patient" });
    }
    if (assessment.primaryComplaint?.severity) {
      known.push({ label: "Severity", value: assessment.primaryComplaint.severity, source: "patient" });
    }
    if (assessment.primaryComplaint?.affectedArea) {
      known.push({ label: "Affected Area", value: assessment.primaryComplaint.affectedArea, source: "patient" });
    }

    if (assessment.medicalHistory?.allergies?.status === "yes") {
      known.push({
        label: "Allergies",
        value: assessment.medicalHistory.allergies.items?.join(", ") || "Yes (details unspecified)",
        source: "patient",
      });
    } else if (assessment.medicalHistory?.allergies?.status === "no") {
      known.push({ label: "Allergies", value: "No known allergies", source: "patient" });
    } else {
      unknown.push({ label: "Allergies", reason: "Status unknown" });
    }

    if (assessment.medicalHistory?.currentMedications?.status === "yes") {
      known.push({
        label: "Current Medications",
        value: assessment.medicalHistory.currentMedications.items?.join(", ") || "Yes (details unspecified)",
        source: "patient",
      });
    } else if (assessment.medicalHistory?.currentMedications?.status === "no") {
      known.push({ label: "Current Medications", value: "None reported", source: "patient" });
    } else {
      unknown.push({ label: "Current Medications", reason: "Status unknown" });
    }

    assessment.reportedFacts = { known, unknown };
    assessment.status = "collecting_information";
    assessment.lastSavedAt = new Date();
    await assessment.save();

    return assessment;
  }

  /**
   * Processes a single adaptive follow-up answer in the interview
   */
  async submitInterviewAnswer(
    assessmentId: string,
    authContext: AssistantAuthContext,
    input: {
      answer: string;
      questionId?: string;
      concludeNow?: boolean;
    }
  ): Promise<IAssessment> {
    const mem = this.inMemoryAssessments.get(assessmentId);
    let assessment: any = mem;

    if (!assessment) {
      if (await tryConnectToDatabase()) {
        await connectToDatabase();
        assessment = await Assessment.findById(assessmentId);
      }
    }

    if (!assessment) {
      throw new Error("Assessment not found.");
    }
    await this.verifyOwnership(assessment, authContext);

    // 1. Independent clinical safety check on latest answer + cumulative symptoms
    const allSymptomsText = [
      assessment.primaryComplaint?.symptom || "",
      ...assessment.symptoms.map((s: any) => s.description),
      input.answer,
    ].join(" ");

    const emergencyCheck = checkEmergencyRules({
      text: allSymptomsText,
      symptoms: allSymptomsText,
      age: assessment.patientInfo?.age,
      allergies: assessment.medicalHistory?.allergies,
      currentMedicines: assessment.medicalHistory?.currentMedications,
      pregnancy: assessment.patientInfo?.pregnancy,
    });

    if (emergencyCheck.emergencyDetected) {
      const emergencyConfig = await getEmergencyConfiguration("GH");
      assessment.status = "escalated";
      assessment.urgency = "emergency";
      assessment.isDraft = false;
      assessment.summary =
        emergencyCheck.patientMessage ||
        "POTENTIAL MEDICAL EMERGENCY DETECTED: Critical warning signs require immediate in-person emergency care.";
      assessment.recommendations = [
        `Call ${emergencyConfig.emergencyNumber} (${emergencyConfig.serviceName}) immediately.`,
        "Do not drive yourself. Have an ambulance or someone else take you to the nearest emergency facility.",
      ];
      assessment.limitations = [
        "Assessment halted for patient safety due to emergency warning signs.",
      ];
      assessment.lastSavedAt = new Date();
      await assessment.save();
      return assessment;
    }

    // 2. Record answer
    const currentQ = assessment.interviewProgress?.currentQuestion;
    const qId = input.questionId || currentQ?.id || `q_${Date.now()}`;
    const qText = currentQ?.text || "Follow-up question";

    if (!assessment.interviewProgress) {
      assessment.interviewProgress = {
        currentStep: 3,
        answeredQuestions: [],
      };
    }

    assessment.interviewProgress.answeredQuestions.push({
      questionId: qId,
      questionText: qText,
      answerText: input.answer,
      answeredAt: new Date(),
    });

    assessment.symptoms.push({ description: input.answer });

    // Update known facts with answered question
    assessment.reportedFacts?.known.push({
      label: qText.slice(0, 45) + (qText.length > 45 ? "..." : ""),
      value: input.answer,
      source: "patient",
    });

    const pathway = (assessment.interviewProgress.pathway as SymptomPathway) || "general";
    const answeredIds = assessment.interviewProgress.answeredQuestions.map((q: any) => q.questionId);
    const userTurnCount = assessment.interviewProgress.answeredQuestions.length;

    // Check if conclusion requested or sufficient information gathered
    const readyToEvaluate =
      Boolean(input.concludeNow) ||
      hasEnoughInfoForEvaluation(pathway, answeredIds, userTurnCount);

    if (readyToEvaluate) {
      return await this.evaluateAssessment(assessmentId, authContext);
    }

    // Otherwise, pick next adaptive question
    const nextQ = getNextAdaptiveQuestion(pathway, answeredIds);
    if (!nextQ) {
      // No more questions in pathway, evaluate now
      return await this.evaluateAssessment(assessmentId, authContext);
    }

    assessment.interviewProgress.currentQuestion = nextQ;
    assessment.status = "collecting_information";
    assessment.lastSavedAt = new Date();
    await assessment.save();

    return assessment;
  }

  /**
   * Evaluates the assessment and produces the structured clinical summary
   */
  async evaluateAssessment(
    assessmentId: string,
    authContext: AssistantAuthContext
  ): Promise<IAssessment> {
    const mem = this.inMemoryAssessments.get(assessmentId);
    let assessment: any = mem;

    if (!assessment) {
      if (await tryConnectToDatabase()) {
        await connectToDatabase();
        assessment = await Assessment.findById(assessmentId);
      }
    }

    if (!assessment) {
      throw new Error("Assessment not found.");
    }
    await this.verifyOwnership(assessment, authContext);

    assessment.status = "ready_for_review";
    await assessment.save();

    // Consolidate full symptoms and conversational context
    const allSymptomsText = [
      assessment.primaryComplaint?.symptom || "",
      assessment.primaryComplaint?.onset ? `Onset: ${assessment.primaryComplaint.onset}` : "",
      assessment.primaryComplaint?.duration ? `Duration: ${assessment.primaryComplaint.duration}` : "",
      assessment.primaryComplaint?.severity ? `Severity: ${assessment.primaryComplaint.severity}` : "",
      assessment.primaryComplaint?.affectedArea ? `Affected area: ${assessment.primaryComplaint.affectedArea}` : "",
      ...(assessment.interviewProgress?.answeredQuestions || []).map(
        (aq: any) => `${aq.questionText} Answer: ${aq.answerText}`
      ),
    ]
      .filter(Boolean)
      .join(". ");

    const clinicalResult = await assessSymptoms({
      symptoms: allSymptomsText,
      age: assessment.patientInfo?.age,
      allergies: assessment.medicalHistory?.allergies,
      currentMedicines: assessment.medicalHistory?.currentMedications,
      pregnancy: assessment.patientInfo?.pregnancy,
      conversationHistory: (assessment.interviewProgress?.answeredQuestions || []).flatMap((aq: any) => [
        { role: "assistant" as const, content: aq.questionText },
        { role: "patient" as const, content: aq.answerText },
      ]),
    });

    assessment.urgency = clinicalResult.urgency;
    assessment.summary = clinicalResult.summary;
    assessment.possibleConditions = clinicalResult.possibleConditions;
    assessment.recommendations = clinicalResult.recommendedNextSteps;
    assessment.limitations = clinicalResult.limitations;
    assessment.medicationGuidance = clinicalResult.medicationGuidance;
    assessment.triage = {
      level: clinicalResult.urgency,
      ruleSetVersion: clinicalResult.aiMetadata.ruleSetVersion,
      checkedAt: new Date(),
    };
    assessment.aiMetadata = {
      provider: clinicalResult.aiMetadata.provider,
      model: clinicalResult.aiMetadata.model,
      promptVersion: clinicalResult.aiMetadata.promptVersion,
      ruleSetVersion: clinicalResult.aiMetadata.ruleSetVersion,
    };

    assessment.status = "completed";
    assessment.isDraft = false;
    if (assessment.interviewProgress) {
      assessment.interviewProgress.currentStep = 4;
      assessment.interviewProgress.currentQuestion = null;
    }
    assessment.lastSavedAt = new Date();
    await assessment.save();

    return assessment;
  }

  /**
   * Lists in-memory assessments for fallback
   */
  listInMemoryAssessments(authContext: AssistantAuthContext): any[] {
    const list: any[] = [];
    for (const a of this.inMemoryAssessments.values()) {
      if (!authContext.userId || a.patientId?.toString() === authContext.userId) {
        list.push({
          id: String(a._id),
          status: a.status,
          isDraft: a.isDraft,
          urgency: a.urgency,
          summary: a.summary,
          primaryComplaint: a.primaryComplaint,
          symptoms: a.symptoms,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
        });
      }
    }
    return list;
  }
}

export const defaultFullAssessmentService = new FullAssessmentService();
