import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import AssistantConversation, {
  IAssistantConversation,
  AssistantState,
} from "@/models/AssistantConversation";
import AssistantMessage, { IAssistantMessage } from "@/models/AssistantMessage";
import Assessment, { IAssessment } from "@/models/Assessment";
import {
  assertValidTransition,
  isValidTransition,
} from "@/lib/assistant/state-machine";
import {
  classifyIntent,
  AssistantIntent,
} from "@/lib/assistant/intent-classifier";
import {
  createAssessmentState,
  updateAssessmentWithAnswer,
  getNextFollowUpQuestion,
  FollowUpQuestionDefinition,
  StructuredAssessmentData,
} from "@/lib/assistant/symptom-tracker";
import {
  structuredAssistantResponseSchema,
  StructuredAssistantResponse,
} from "@/lib/assistant/schemas";
import { checkEmergencyRules } from "@/lib/safety/triage-engine";
import { enforceSafetyGate } from "@/lib/safety/post-generation-gate";
import { extractJson } from "@/lib/ai/extract-json";
import {
  getNvidiaClient,
  MODEL,
  FALLBACK_MODEL,
  isNvidiaConfigured,
} from "@/lib/ai/nvidia";
import {
  ASSISTANT_SYSTEM_PROMPT,
  ASSISTANT_PROMPT_VERSION,
} from "@/lib/ai/prompts/assistant-v2";
import { getEmergencyConfiguration } from "@/lib/emergency/emergency-config";
import { defaultMedicationService } from "@/services/medication-service";
import { defaultFacilityService } from "@/lib/maps/facility-service";
import { assessSymptoms } from "@/services/assessment-service";

export interface AssistantAuthContext {
  userId?: string;
  guestTokenHash?: string;
}

export interface SendMessageInput {
  conversationId: string;
  message: string;
  clientMessageId?: string;
  authContext: AssistantAuthContext;
}

export interface AssistantTurnResult {
  conversationId: string;
  currentState: AssistantState;
  intent: AssistantIntent;
  response: StructuredAssistantResponse;
  assessmentId?: string;
}

export class AssistantAuthorizationError extends Error {
  public readonly code = "UNAUTHORIZED_CONVERSATION_ACCESS";
  constructor(message = "You do not have permission to access this conversation.") {
    super(message);
    this.name = "AssistantAuthorizationError";
  }
}

export class AssistantNotFoundError extends Error {
  public readonly code = "CONVERSATION_NOT_FOUND";
  constructor(message = "Conversation not found.") {
    super(message);
    this.name = "AssistantNotFoundError";
  }
}

export class ClinixAssistantService {
  /**
   * Create a new conversation session
   */
  async createConversation(options: {
    title?: string;
    language?: string;
    authContext: AssistantAuthContext;
  }): Promise<IAssistantConversation> {
    await connectToDatabase();
    const { title, language = "en", authContext } = options;

    const expiresAt = authContext.userId
      ? undefined
      : new Date(Date.now() + 24 * 60 * 60 * 1000); // 24-hr TTL for guest sessions

    const conversation = await AssistantConversation.create({
      userId: authContext.userId ? new mongoose.Types.ObjectId(authContext.userId) : undefined,
      guestTokenHash: authContext.guestTokenHash,
      title: title || "New Health Consultation",
      status: "active",
      currentState: "idle",
      language,
      lastActiveAt: new Date(),
      expiresAt,
    });

    return conversation;
  }

  /**
   * Retrieves an authorized conversation
   */
  async getConversation(
    conversationId: string,
    authContext: AssistantAuthContext
  ): Promise<IAssistantConversation> {
    await connectToDatabase();

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      throw new AssistantNotFoundError("Invalid conversation ID format.");
    }

    const conversation = await AssistantConversation.findById(conversationId);
    if (!conversation) {
      throw new AssistantNotFoundError();
    }

    this.verifyOwnership(conversation, authContext);
    return conversation;
  }

  /**
   * Lists conversations for the authorized user/guest
   */
  async listConversations(
    authContext: AssistantAuthContext,
    limit = 20
  ): Promise<IAssistantConversation[]> {
    await connectToDatabase();

    const query: Record<string, unknown> = {};
    if (authContext.userId) {
      query.userId = new mongoose.Types.ObjectId(authContext.userId);
    } else if (authContext.guestTokenHash) {
      query.guestTokenHash = authContext.guestTokenHash;
    } else {
      return [];
    }

    return AssistantConversation.find(query)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();
  }

  /**
   * Retrieves messages for an authorized conversation
   */
  async getMessages(
    conversationId: string,
    authContext: AssistantAuthContext
  ): Promise<IAssistantMessage[]> {
    await this.getConversation(conversationId, authContext);
    return AssistantMessage.find({
      conversationId: new mongoose.Types.ObjectId(conversationId),
    })
      .sort({ createdAt: 1 })
      .lean();
  }

  /**
   * Finishes or marks a conversation as completed
   */
  async finishConversation(
    conversationId: string,
    authContext: AssistantAuthContext
  ): Promise<IAssistantConversation> {
    const conversation = await this.getConversation(conversationId, authContext);
    
    if (conversation.currentState !== "escalated") {
      assertValidTransition(conversation.currentState, "completed");
      conversation.currentState = "completed";
    }
    conversation.status = "completed";
    conversation.lastActiveAt = new Date();
    await conversation.save();

    return conversation;
  }

  /**
   * Main turn execution: Process patient message and return structured response
   */
  async processPatientMessage(input: SendMessageInput): Promise<AssistantTurnResult> {
    await connectToDatabase();
    const { conversationId, message, clientMessageId, authContext } = input;

    const cleanMessage = message.trim();
    if (!cleanMessage) {
      throw new Error("Message cannot be empty.");
    }

    const conversation = await this.getConversation(conversationId, authContext);

    // =========================================================================
    // 1. IDEMPOTENCY CHECK
    // =========================================================================
    if (clientMessageId) {
      const existingUserMsg = await AssistantMessage.findOne({
        conversationId: conversation._id,
        clientMessageId,
      });

      if (existingUserMsg) {
        // Return existing subsequent assistant response if available
        const subsequentMsg = await AssistantMessage.findOne({
          conversationId: conversation._id,
          role: "assistant",
          createdAt: { $gt: existingUserMsg.createdAt },
        }).sort({ createdAt: 1 });

        if (subsequentMsg && subsequentMsg.structuredPayload) {
          const parsed = structuredAssistantResponseSchema.safeParse(subsequentMsg.structuredPayload);
          if (parsed.success) {
            return {
              conversationId: String(conversation._id),
              currentState: conversation.currentState,
              intent: (subsequentMsg.intent as AssistantIntent) || "symptom_assessment",
              response: parsed.data,
              assessmentId: conversation.assessmentId ? String(conversation.assessmentId) : undefined,
            };
          }
        }
      }
    }

    // =========================================================================
    // 2. STORE PATIENT MESSAGE
    // =========================================================================
    await AssistantMessage.create({
      conversationId: conversation._id,
      userId: authContext.userId ? new mongoose.Types.ObjectId(authContext.userId) : undefined,
      guestTokenHash: authContext.guestTokenHash,
      role: "patient",
      content: cleanMessage,
      responseType: "message",
      clientMessageId,
      schemaVersion: "1.0",
    });

    // =========================================================================
    // 3. INDEPENDENT CLINICAL SAFETY SCREENING (Runs BEFORE any AI model call)
    // =========================================================================
    const emergencySafety = checkEmergencyRules({
      text: cleanMessage,
      symptoms: cleanMessage,
    });

    if (emergencySafety.emergencyDetected) {
      // INVARIANT: Stop ordinary workflow immediately!
      const emergencyConfig = await getEmergencyConfiguration("GH");

      const emergencyResponse: StructuredAssistantResponse = {
        intent: "emergency_assistance",
        state: "escalated",
        message:
          emergencySafety.patientMessage ||
          "POTENTIAL MEDICAL EMERGENCY DETECTED: Your described symptoms indicate a potential life-threatening emergency. Please seek immediate professional medical attention without delay.",
        followUpQuestion: null,
        safety: {
          urgentPathwayTriggered: true,
          ruleIds: emergencySafety.matchedRuleIds,
        },
        actions: [
          {
            id: "call_emergency",
            label: `Call ${emergencyConfig.emergencyNumber} (${emergencyConfig.serviceName})`,
            type: "call",
            target: `tel:${emergencyConfig.emergencyNumber}`,
          },
          {
            id: "find_emergency_room",
            label: "Nearest Emergency Hospital",
            type: "link",
            target: "/clinics?type=emergency_department",
          },
        ],
        sources: [
          {
            id: "clinix_reviewed_triage",
            title: `Clinix Emergency Safety Ruleset v${emergencySafety.ruleSetVersion}`,
          },
        ],
      };

      // Transition to escalated
      if (isValidTransition(conversation.currentState, "escalated")) {
        conversation.currentState = "escalated";
      }
      conversation.status = "emergency";
      conversation.lastActiveAt = new Date();
      await conversation.save();

      // Persist assistant message
      await AssistantMessage.create({
        conversationId: conversation._id,
        userId: authContext.userId ? new mongoose.Types.ObjectId(authContext.userId) : undefined,
        guestTokenHash: authContext.guestTokenHash,
        role: "assistant",
        content: emergencyResponse.message,
        responseType: "emergency_alert",
        intent: "emergency_assistance",
        schemaVersion: "1.0",
        structuredPayload: emergencyResponse,
      });

      return {
        conversationId: String(conversation._id),
        currentState: "escalated",
        intent: "emergency_assistance",
        response: emergencyResponse,
        assessmentId: conversation.assessmentId ? String(conversation.assessmentId) : undefined,
      };
    }

    // =========================================================================
    // 4. INTENT CLASSIFICATION
    // =========================================================================
    const hasActiveAssessment = Boolean(conversation.assessmentId);
    const classification = classifyIntent(cleanMessage, conversation.currentState, hasActiveAssessment);
    const intent = classification.intent;
    conversation.currentIntent = intent;

    // =========================================================================
    // 5. INTENT-SPECIFIC WORKFLOW ROUTING
    // =========================================================================
    let structuredResponse: StructuredAssistantResponse;

    switch (intent) {
      case "clinic_search": {
        structuredResponse = await this.handleClinicSearch(cleanMessage);
        break;
      }

      case "medication_information": {
        structuredResponse = await this.handleMedicationInformation(cleanMessage);
        break;
      }

      case "general_health_information": {
        structuredResponse = await this.handleGeneralHealthInformation(cleanMessage, conversation);
        break;
      }

      case "unsupported_request": {
        structuredResponse = {
          intent: "unsupported_request",
          state: conversation.currentState,
          message:
            "Clinix is focused on health education, symptom understanding, care navigation, and medication safety. I cannot assist with non-health topics, coding, legal advice, or issuing prescription medications. How can I help with your health questions today?",
          followUpQuestion: null,
          safety: { urgentPathwayTriggered: false, ruleIds: [] },
          actions: [
            { id: "check_symptoms", label: "Check Symptoms", type: "action", target: "symptom_assessment" },
            { id: "search_meds", label: "Search Medications", type: "link", target: "/medications" },
          ],
          sources: [],
        };
        break;
      }

      case "clarification_required": {
        structuredResponse = {
          intent: "clarification_required",
          state: conversation.currentState === "idle" ? "idle" : conversation.currentState,
          message:
            "Hello! I am your Clinix health care navigation assistant. To help you best, could you please tell me: are you experiencing specific symptoms, looking for information on a medication, or trying to find a nearby clinic?",
          followUpQuestion: {
            id: "clarify_primary_need",
            text: "What would you like to do?",
            type: "single_choice",
            options: ["Check my symptoms", "Look up a medication", "Find a nearby clinic", "Ask a general health question"],
          },
          safety: { urgentPathwayTriggered: false, ruleIds: [] },
          actions: [
            { id: "action_symptoms", label: "Describe Symptoms", type: "action", target: "symptom_assessment" },
            { id: "action_meds", label: "Medication Info", type: "link", target: "/medications" },
            { id: "action_clinics", label: "Find Care", type: "link", target: "/clinics" },
          ],
          sources: [],
        };
        break;
      }

      case "symptom_assessment":
      case "assessment_follow_up":
      default: {
        structuredResponse = await this.handleSymptomWorkflow(cleanMessage, conversation, authContext);
        break;
      }
    }

    // =========================================================================
    // 6. UPDATE CONVERSATION STATE & PERSIST ASSISTANT RESPONSE
    // =========================================================================
    if (structuredResponse.state !== conversation.currentState) {
      if (isValidTransition(conversation.currentState, structuredResponse.state)) {
        conversation.currentState = structuredResponse.state;
      }
    }

    conversation.lastActiveAt = new Date();
    await conversation.save();

    await AssistantMessage.create({
      conversationId: conversation._id,
      userId: authContext.userId ? new mongoose.Types.ObjectId(authContext.userId) : undefined,
      guestTokenHash: authContext.guestTokenHash,
      role: "assistant",
      content: structuredResponse.message,
      responseType: structuredResponse.followUpQuestion
        ? "follow_up_question"
        : structuredResponse.intent === "clinic_search"
        ? "clinic_info"
        : structuredResponse.intent === "medication_information"
        ? "medication_info"
        : "assessment_result",
      intent: structuredResponse.intent,
      schemaVersion: "1.0",
      structuredPayload: structuredResponse,
    });

    return {
      conversationId: String(conversation._id),
      currentState: conversation.currentState,
      intent,
      response: structuredResponse,
      assessmentId: conversation.assessmentId ? String(conversation.assessmentId) : undefined,
    };
  }

  /**
   * Handles verified clinic/facility discovery workflow
   */
  private async handleClinicSearch(query: string): Promise<StructuredAssistantResponse> {
    try {
      const facilities = await defaultFacilityService.searchFacilities({
        query: query.slice(0, 100),
        limit: 3,
      });

      if (facilities.length === 0) {
        return {
          intent: "clinic_search",
          state: "idle",
          message:
            "I could not locate specific facilities matching that query in the verified directory. You can browse all verified healthcare clinics and hospitals in our full care directory.",
          followUpQuestion: null,
          safety: { urgentPathwayTriggered: false, ruleIds: [] },
          actions: [
            { id: "browse_all_clinics", label: "Open Clinic Directory", type: "link", target: "/clinics" },
          ],
          sources: [{ id: "ghana_health_service", title: "Ghana Health Service Verified Facilities" }],
        };
      }

      const facilitySummaries = facilities
        .map(
          (f, idx) =>
            `${idx + 1}. **${f.name}** (${f.type.replace("_", " ")}): ${f.address}${
              f.phone ? ` • Phone: ${f.phone}` : ""
            }`
        )
        .join("\n\n");

      return {
        intent: "clinic_search",
        state: "idle",
        message: `Here are verified healthcare facilities near that area:\n\n${facilitySummaries}\n\n*Please verify operating hours before traveling for routine care.*`,
        followUpQuestion: null,
        safety: { urgentPathwayTriggered: false, ruleIds: [] },
        actions: [
          { id: "view_on_map", label: "View Detailed Map", type: "link", target: "/clinics" },
          ...(facilities[0]?.phone
            ? [
                {
                  id: "call_facility",
                  label: `Call ${facilities[0].name}`,
                  type: "call" as const,
                  target: `tel:${facilities[0].phone}`,
                },
              ]
            : []),
        ],
        sources: [{ id: "facility_directory", title: "Clinix Verified Healthcare Directory" }],
      };
    } catch {
      return {
        intent: "clinic_search",
        state: "idle",
        message:
          "The clinic directory is currently taking longer than expected. You can visit our dedicated clinic locator page to search by town or use your device location.",
        followUpQuestion: null,
        safety: { urgentPathwayTriggered: false, ruleIds: [] },
        actions: [{ id: "open_clinics", label: "Explore Clinics", type: "link", target: "/clinics" }],
        sources: [],
      };
    }
  }

  /**
   * Handles verified medication information workflow
   */
  private async handleMedicationInformation(query: string): Promise<StructuredAssistantResponse> {
    try {
      const guidance = await defaultMedicationService.getMedicationGuidance({
        query: query.slice(0, 100),
        context: {
          pregnancy: "unknown",
          allergies: { status: "unknown" },
          currentMedicines: { status: "unknown" },
        },
      });

      if (guidance.status === "emergency_blocked") {
        return {
          intent: "emergency_assistance",
          state: "escalated",
          message:
            "EMERGENCY WARNING: Your medication inquiry involves critical safety warnings or symptoms requiring immediate in-person medical evaluation.",
          followUpQuestion: null,
          safety: { urgentPathwayTriggered: true, ruleIds: ["MED_EMERGENCY"] },
          actions: [{ id: "call_112", label: "Call Emergency (112)", type: "call", target: "tel:112" }],
          sources: [{ id: "med_safety_rules", title: "National Medication Safety Guidelines" }],
        };
      }

      if (!guidance.medication) {
        return {
          intent: "medication_information",
          state: "idle",
          message:
            "I could not verify that specific medication name in the approved national formulary. To ensure patient safety, Clinix does not speculate on unverified medicines. Please consult a registered pharmacist or qualified physician for accurate drug information.",
          followUpQuestion: null,
          safety: { urgentPathwayTriggered: false, ruleIds: [] },
          actions: [{ id: "browse_medications", label: "Browse Approved Medicines", type: "link", target: "/medications" }],
          sources: [{ id: "national_formulary", title: "Approved Essential Medicines List" }],
        };
      }

      const med = guidance.medication;
      const indications = med?.approvedIndications?.join(", ") || "General therapeutic use";
      const classification = med?.classification === "prescription_only" ? "Prescription Only (POM)" : "Over-The-Counter (OTC)";

      const message = `**${med?.genericName}** (${classification})\n\n**Approved Uses:** ${indications}\n\n**Safety & Warnings:** ${
        guidance.dosageRefusalNotice || "Always follow official packaging instructions."
      }\n\n*Important: Clinix does not calculate personalized dosages or prescribe medications. Please speak with a licensed pharmacist or physician for specific guidance.*`;

      return {
        intent: "medication_information",
        state: "idle",
        message,
        followUpQuestion: null,
        safety: { urgentPathwayTriggered: false, ruleIds: [] },
        actions: [
          { id: "view_full_med_info", label: "View Safety Details", type: "link", target: "/medications" },
          { id: "find_pharmacy", label: "Find Nearby Pharmacy", type: "link", target: "/clinics?type=pharmacy" },
        ],
        sources: [{ id: "ghana_national_formulary", title: "National Standard Treatment Guidelines & Formulary" }],
      };
    } catch {
      return {
        intent: "medication_information",
        state: "idle",
        message:
          "Medication verification is temporarily unavailable. For your safety, do not take unprescribed medicines without consulting a licensed pharmacist.",
        followUpQuestion: null,
        safety: { urgentPathwayTriggered: false, ruleIds: [] },
        actions: [{ id: "open_meds_page", label: "Search Approved Medications", type: "link", target: "/medications" }],
        sources: [],
      };
    }
  }

  /**
   * Handles general educational health information queries
   */
  private async handleGeneralHealthInformation(
    query: string,
    conversation: IAssistantConversation
  ): Promise<StructuredAssistantResponse> {
    if (isNvidiaConfigured()) {
      try {
        const client = getNvidiaClient();
        const completion = await client.chat.completions.create({
          model: MODEL,
          temperature: 0.1,
          max_tokens: 600,
          messages: [
            { role: "system", content: ASSISTANT_SYSTEM_PROMPT },
            {
              role: "user",
              content: JSON.stringify({
                task: "general_health_information",
                userQuery: query,
                contextNote: "Provide a neutral, educational explanation without making a personal diagnosis.",
              }),
            },
          ],
        });

        const rawContent = completion.choices[0]?.message?.content;
        if (rawContent) {
          const parsed = extractJson(rawContent);
          const validated = structuredAssistantResponseSchema.safeParse(parsed);
          if (validated.success) {
            return {
              ...validated.data,
              intent: "general_health_information",
              state: conversation.currentState === "idle" ? "idle" : conversation.currentState,
            };
          }
        }
      } catch (err) {
        console.warn("[ASSISTANT SERVICE] General health info model call failed:", err);
      }
    }

    // Deterministic educational fallback
    return {
      intent: "general_health_information",
      state: "idle",
      message: `Thank you for your question regarding "${query}". In general, healthcare knowledge helps patients recognize signs early, but health information is educational and should not replace an evaluation by a qualified medical professional.\n\nIf you or someone else is experiencing personal symptoms, please let me know what you are feeling so I can guide you through a structured assessment.`,
      followUpQuestion: {
        id: "check_personal_symptoms",
        text: "Are you asking because you are currently experiencing symptoms?",
        type: "single_choice",
        options: ["Yes, I have symptoms", "No, just general learning"],
      },
      safety: { urgentPathwayTriggered: false, ruleIds: [] },
      actions: [
        { id: "start_symptom_check", label: "Check Symptoms", type: "action", target: "symptom_assessment" },
        { id: "find_care", label: "Find a Clinic", type: "link", target: "/clinics" },
      ],
      sources: [{ id: "clinix_health_education", title: "Clinix Reviewed Patient Education" }],
    };
  }

  /**
   * Handles structured symptom collection, follow-up questions, and final assessment
   */
  private async handleSymptomWorkflow(
    message: string,
    conversation: IAssistantConversation,
    authContext: AssistantAuthContext
  ): Promise<StructuredAssistantResponse> {
    const currentState = conversation.currentState;

    // Check if there is an active assessment linked
    let assessmentDoc: IAssessment | null = null;
    if (conversation.assessmentId) {
      assessmentDoc = await Assessment.findById(conversation.assessmentId);
    }

    // If starting fresh or no assessment exists
    if (!assessmentDoc || currentState === "idle") {
      assertValidTransition(currentState, "collecting_symptoms");
      conversation.currentState = "collecting_symptoms";

      // Initialize structured assessment in database
      assessmentDoc = await Assessment.create({
        patientId: authContext.userId
          ? new mongoose.Types.ObjectId(authContext.userId)
          : new mongoose.Types.ObjectId(), // Safe placeholder for guests
        conversationId: conversation._id,
        symptoms: [{ description: message }],
        urgency: "routine",
        summary: "Symptom collection started.",
        possibleConditions: [],
        recommendations: [],
        limitations: ["Assessment in progress. Not a final diagnosis."],
        triage: {
          level: "routine",
          ruleSetVersion: "1.0",
          checkedAt: new Date(),
        },
        aiMetadata: {
          provider: "NVIDIA",
          model: MODEL,
          promptVersion: ASSISTANT_PROMPT_VERSION,
        },
      });

      conversation.assessmentId = assessmentDoc._id as mongoose.Types.ObjectId;
      await conversation.save();

      // Ask first standard follow-up question
      const firstQ: FollowUpQuestionDefinition = {
        id: "symptom_duration",
        text: "How long have you been experiencing these symptoms?",
        type: "single_choice",
        options: ["Less than 24 hours", "1 to 3 days", "4 to 7 days", "More than a week", "Not sure"],
        category: "duration",
      };

      conversation.currentState = "asking_questions";
      await conversation.save();

      return {
        intent: "symptom_assessment",
        state: "asking_questions",
        message: `I understand you are experiencing: "${message}". To help me provide relevant information, could you share a few more details?`,
        followUpQuestion: {
          id: firstQ.id,
          text: firstQ.text,
          type: firstQ.type,
          options: firstQ.options,
        },
        safety: { urgentPathwayTriggered: false, ruleIds: [] },
        actions: [],
        sources: [],
      };
    }

    // In asking_questions state: Record answer, update symptoms, and ask next question or evaluate
    const existingSymptoms = assessmentDoc.symptoms.map((s) => s.description).join("; ");
    const consolidatedText = `${existingSymptoms}. Additional update: ${message}`;

    // Re-check safety with full consolidated context
    const reevaluatedSafety = checkEmergencyRules({
      text: consolidatedText,
      symptoms: consolidatedText,
    });

    if (reevaluatedSafety.emergencyDetected) {
      assertValidTransition(conversation.currentState, "escalated");
      conversation.currentState = "escalated";
      conversation.status = "emergency";
      await conversation.save();

      const emergencyConfig = await getEmergencyConfiguration("GH");

      return {
        intent: "emergency_assistance",
        state: "escalated",
        message:
          reevaluatedSafety.patientMessage ||
          "EMERGENCY WARNING: Your updated symptoms indicate potential critical warning signs. Please call emergency services immediately.",
        followUpQuestion: null,
        safety: { urgentPathwayTriggered: true, ruleIds: reevaluatedSafety.matchedRuleIds },
        actions: [
          {
            id: "call_112",
            label: `Call ${emergencyConfig.emergencyNumber}`,
            type: "call",
            target: `tel:${emergencyConfig.emergencyNumber}`,
          },
          { id: "nearest_er", label: "Find Emergency Facility", type: "link", target: "/clinics?type=emergency_department" },
        ],
        sources: [],
      };
    }

    // Retrieve previous messages to count turns
    const history = await AssistantMessage.find({ conversationId: conversation._id }).sort({ createdAt: 1 });
    const userTurnCount = history.filter((m) => m.role === "patient").length;

    // After 2-3 questions or if user asks for conclusion, evaluate symptoms!
    if (userTurnCount >= 3 || /enough|conclude|what is it|summary|done/i.test(message)) {
      assertValidTransition(conversation.currentState, "evaluating");
      conversation.currentState = "evaluating";

      const clinicalResult = await assessSymptoms({
        symptoms: consolidatedText,
        conversationHistory: history.map((h) => ({
          role: h.role === "patient" ? "patient" : "assistant",
          content: h.content,
        })),
      });

      // Update assessment in database
      assessmentDoc.urgency = clinicalResult.urgency;
      assessmentDoc.summary = clinicalResult.summary;
      assessmentDoc.possibleConditions = clinicalResult.possibleConditions;
      assessmentDoc.recommendations = clinicalResult.recommendedNextSteps;
      assessmentDoc.limitations = clinicalResult.limitations;
      assessmentDoc.medicationGuidance = clinicalResult.medicationGuidance;
      await assessmentDoc.save();

      assertValidTransition(conversation.currentState, "presenting_result");
      conversation.currentState = "presenting_result";
      await conversation.save();

      const possibleCausesText = clinicalResult.possibleConditions.length > 0
        ? "\n\n**Possible Explanations to Discuss with a Clinician:**\n" +
          clinicalResult.possibleConditions
            .map((c) => `• **${c.name}**: ${c.explanation}`)
            .join("\n")
        : "";

      const stepsText = clinicalResult.recommendedNextSteps.length > 0
        ? "\n\n**Recommended Next Steps:**\n" +
          clinicalResult.recommendedNextSteps.map((s) => `• ${s}`).join("\n")
        : "";

      return {
        intent: "symptom_assessment",
        state: "presenting_result",
        message: `${clinicalResult.summary}${possibleCausesText}${stepsText}\n\n*Reminder: This is health navigation guidance, not a medical diagnosis. If symptoms worsen, seek professional care.*`,
        followUpQuestion: null,
        safety: {
          urgentPathwayTriggered: clinicalResult.urgency === "emergency",
          ruleIds: [],
        },
        actions: [
          { id: "find_clinic", label: "Find Nearby Clinic", type: "link", target: "/clinics" },
          { id: "save_assessment", label: "Save to My Records", type: "action", target: "save_assessment" },
          { id: "new_consultation", label: "New Consultation", type: "action", target: "new_conversation" },
        ],
        sources: [{ id: "clinix_triage", title: "Clinix Clinical Guidance Engine" }],
      };
    }

    // Ask second follow-up question (severity / associated symptoms)
    const severityQ: FollowUpQuestionDefinition = {
      id: "symptom_severity",
      text: "How severe would you say the symptoms are right now?",
      type: "single_choice",
      options: ["Mild (manageable)", "Moderate (interfering with activities)", "Severe (intense distress)", "Not sure"],
      category: "severity",
    };

    return {
      intent: "assessment_follow_up",
      state: "asking_questions",
      message: "Thank you for providing that detail. One more question to help gauge the situation:",
      followUpQuestion: {
        id: severityQ.id,
        text: severityQ.text,
        type: severityQ.type,
        options: severityQ.options,
      },
      safety: { urgentPathwayTriggered: false, ruleIds: [] },
      actions: [],
      sources: [],
    };
  }

  /**
   * Ownership verification
   */
  private verifyOwnership(
    conversation: IAssistantConversation,
    authContext: AssistantAuthContext
  ): void {
    if (authContext.userId) {
      if (!conversation.userId || conversation.userId.toString() !== authContext.userId) {
        throw new AssistantAuthorizationError();
      }
      return;
    }

    if (authContext.guestTokenHash) {
      if (
        !conversation.guestTokenHash ||
        conversation.guestTokenHash !== authContext.guestTokenHash
      ) {
        throw new AssistantAuthorizationError();
      }
      return;
    }

    throw new AssistantAuthorizationError("Unauthenticated request cannot access conversation.");
  }
}

export const defaultAssistantService = new ClinixAssistantService();
