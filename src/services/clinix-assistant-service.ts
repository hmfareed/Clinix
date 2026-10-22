import mongoose from "mongoose";
import { connectToDatabase, tryConnectToDatabase } from "@/lib/db/mongodb";
import { defaultFullAssessmentService } from "@/services/full-assessment-service";
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
  detectSymptomPathway,
  getNextAdaptiveQuestion,
  hasEnoughInfoForEvaluation,
  SymptomPathway,
  SYMPTOM_PATHWAYS,
} from "@/lib/assistant/symptom-adaptive-questions";
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
import { defaultHealthcarePlacesService } from "@/lib/healthcare-places/places-service";
import { defaultGeocodeService } from "@/lib/healthcare-places/geocode-service";
import { formatDistance } from "@/lib/healthcare-places/distance";
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
  locationContext?: {
    latitude: number;
    longitude: number;
    radiusMeters?: number;
    locationName?: string;
  };
}

export interface AssistantTurnResult {
  conversationId: string;
  currentState: AssistantState;
  intent: AssistantIntent;
  response: StructuredAssistantResponse;
  assessmentId?: string;
  /** Rich structured assessment data — populated when state is presenting_result */
  assessmentDetails?: {
    summary: string;
    urgency: string;
    possibleConditions: Array<{ name: string; explanation: string; supportingSymptoms?: string[]; missingInformation?: string[] }>;
    recommendedNextSteps: string[];
    suggestedOTCDrugs: Array<{ name: string; purpose: string; warning: string }>;
    limitations: string[];
  };
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
  private inMemoryConversations = new Map<string, any>();
  private inMemoryMessages = new Map<string, any[]>();

  /**
   * Create a new conversation session
   */
  async createConversation(options: {
    title?: string;
    language?: string;
    authContext: AssistantAuthContext;
  }): Promise<IAssistantConversation> {
    const { title, language = "en", authContext } = options;

    const expiresAt = authContext.userId
      ? undefined
      : new Date(Date.now() + 24 * 60 * 60 * 1000); // 24-hr TTL for guest sessions

    const dbAvailable = await tryConnectToDatabase();
    if (!dbAvailable) {
      const id = new mongoose.Types.ObjectId();
      const conv: any = {
        _id: id,
        id: String(id),
        userId: authContext.userId ? new mongoose.Types.ObjectId(authContext.userId) : undefined,
        guestTokenHash: authContext.guestTokenHash,
        title: title || "New Health Consultation",
        status: "active",
        currentState: "idle",
        language,
        lastActiveAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt,
        save: async function () {
          this.lastActiveAt = new Date();
          this.updatedAt = new Date();
          return this;
        },
        toObject: function () {
          return { ...this };
        },
      };

      this.inMemoryConversations.set(String(id), conv);
      this.inMemoryMessages.set(String(id), []);
      return conv as IAssistantConversation;
    }

    try {
      await connectToDatabase();
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
    } catch (err) {
      console.warn("[CREATE CONVERSATION FALLBACK] DB connection failed, using in-memory conversation:", err);
      const id = new mongoose.Types.ObjectId();
      const conv: any = {
        _id: id,
        id: String(id),
        userId: authContext.userId ? new mongoose.Types.ObjectId(authContext.userId) : undefined,
        guestTokenHash: authContext.guestTokenHash,
        title: title || "New Health Consultation",
        status: "active",
        currentState: "idle",
        language,
        lastActiveAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt,
        save: async function () {
          this.lastActiveAt = new Date();
          this.updatedAt = new Date();
          return this;
        },
        toObject: function () {
          return { ...this };
        },
      };

      this.inMemoryConversations.set(String(id), conv);
      this.inMemoryMessages.set(String(id), []);
      return conv as IAssistantConversation;
    }
  }

  /**
   * Retrieves an authorized conversation
   */
  async getConversation(
    conversationId: string,
    authContext: AssistantAuthContext
  ): Promise<IAssistantConversation> {
    const mem = this.inMemoryConversations.get(conversationId);
    if (mem) {
      this.verifyOwnership(mem, authContext);
      return mem as IAssistantConversation;
    }

    if (await tryConnectToDatabase()) {
      await connectToDatabase();

      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        throw new AssistantNotFoundError("Invalid conversation ID format.");
      }

      const conversation = await AssistantConversation.findById(conversationId);
      if (conversation) {
        this.verifyOwnership(conversation, authContext);
        return conversation;
      }
    }

    throw new AssistantNotFoundError();
  }

  /**
   * Lists conversations for the authorized user/guest
   */
  async listConversations(
    authContext: AssistantAuthContext,
    limit = 20
  ): Promise<IAssistantConversation[]> {
    const dbAvailable = await tryConnectToDatabase();
    if (!dbAvailable) {
      const list: any[] = [];
      for (const conv of this.inMemoryConversations.values()) {
        if (authContext.userId && conv.userId?.toString() === authContext.userId) {
          list.push(conv);
        } else if (authContext.guestTokenHash && conv.guestTokenHash === authContext.guestTokenHash) {
          list.push(conv);
        }
      }
      return list.slice(0, limit);
    }

    try {
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
    } catch {
      return [];
    }
  }

  /**
   * Retrieves messages for an authorized conversation
   */
  async getMessages(
    conversationId: string,
    authContext: AssistantAuthContext
  ): Promise<IAssistantMessage[]> {
    await this.getConversation(conversationId, authContext);
    const mem = this.inMemoryMessages.get(conversationId);
    if (mem) {
      return [...mem];
    }

    if (await tryConnectToDatabase()) {
      return AssistantMessage.find({
        conversationId: new mongoose.Types.ObjectId(conversationId),
      })
        .sort({ createdAt: 1 })
        .lean();
    }

    return [];
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
    const { conversationId, message, clientMessageId, authContext, locationContext } = input;

    const cleanMessage = message.trim();
    if (!cleanMessage) {
      throw new Error("Message cannot be empty.");
    }

    const conversation = await this.getConversation(conversationId, authContext);
    const isMem = this.inMemoryConversations.has(conversationId);

    const persistMessage = async (msgData: any) => {
      if (isMem) {
        const memList = this.inMemoryMessages.get(conversationId) || [];
        const enriched = {
          _id: new mongoose.Types.ObjectId(),
          createdAt: new Date(),
          ...msgData,
        };
        memList.push(enriched);
        this.inMemoryMessages.set(conversationId, memList);
        return enriched;
      }
      return AssistantMessage.create(msgData);
    };

    // =========================================================================
    // 1. IDEMPOTENCY CHECK
    // =========================================================================
    if (clientMessageId) {
      let existingUserMsg: any = null;
      let subsequentMsg: any = null;

      if (isMem) {
        const memList = this.inMemoryMessages.get(conversationId) || [];
        existingUserMsg = memList.find((m) => m.clientMessageId === clientMessageId);
        if (existingUserMsg) {
          subsequentMsg = memList.find(
            (m) => m.role === "assistant" && new Date(m.createdAt) > new Date(existingUserMsg.createdAt)
          );
        }
      } else {
        existingUserMsg = await AssistantMessage.findOne({
          conversationId: conversation._id,
          clientMessageId,
        });

        if (existingUserMsg) {
          subsequentMsg = await AssistantMessage.findOne({
            conversationId: conversation._id,
            role: "assistant",
            createdAt: { $gt: existingUserMsg.createdAt },
          }).sort({ createdAt: 1 });
        }
      }

      if (existingUserMsg && subsequentMsg && subsequentMsg.structuredPayload) {
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

    // =========================================================================
    // 2. STORE PATIENT MESSAGE
    // =========================================================================
    await persistMessage({
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
        conversationStage: "escalated",
        awaitingPatientResponse: false,
        nextQuestion: null,
        urgencyLevel: "emergency",
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
      await persistMessage({
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
        structuredResponse = await this.handleClinicSearch(cleanMessage, locationContext);
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
          conversationStage: "collecting_symptoms",
          awaitingPatientResponse: true,
          nextQuestion: "Are you experiencing specific symptoms, looking for information on a medication, or trying to find a nearby clinic?",
          message:
            "Hello! I am your Clinix health care navigation assistant. To help you best, could you please tell me: are you experiencing specific symptoms, looking for information on a medication, or trying to find a nearby clinic?",
          followUpQuestion: null,
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

    await persistMessage({
      conversationId: conversation._id,
      userId: authContext.userId ? new mongoose.Types.ObjectId(authContext.userId) : undefined,
      guestTokenHash: authContext.guestTokenHash,
      role: "assistant",
      content: structuredResponse.message,
      responseType: structuredResponse.awaitingPatientResponse || structuredResponse.followUpQuestion
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
      // Populate assessmentDetails for the presenting_result state so the UI can render the rich card
      assessmentDetails:
        structuredResponse.state === "presenting_result" && conversation.assessmentId
          ? await defaultFullAssessmentService
              .getAssessment(String(conversation.assessmentId), authContext)
              .then((doc) =>
                doc
                  ? {
                      summary: doc.summary,
                      urgency: doc.urgency,
                      possibleConditions: doc.possibleConditions ?? [],
                      recommendedNextSteps: doc.recommendations ?? [],
                      suggestedOTCDrugs:
                        (doc.medicationGuidance as any)?.suggestedOTCDrugs ?? [],
                      limitations: doc.limitations ?? [],
                    }
                  : undefined
              )
          : undefined,
    };
  }

  /**
   * Handles verified clinic/facility discovery workflow using real places provider
   */
  private async handleClinicSearch(
    query: string,
    locationContext?: {
      latitude: number;
      longitude: number;
      radiusMeters?: number;
      locationName?: string;
    }
  ): Promise<StructuredAssistantResponse> {
    try {
      let searchLat: number | undefined = locationContext?.latitude;
      let searchLng: number | undefined = locationContext?.longitude;
      let locationLabel: string | undefined = locationContext?.locationName;
      const radiusMeters = locationContext?.radiusMeters || 5000;

      // If locationContext is not provided, check if the patient mentioned a location in their query text
      if (searchLat === undefined || searchLng === undefined) {
        const geocodeResult = await defaultGeocodeService.geocode({ query });
        if (geocodeResult && geocodeResult.provider !== "fallback_regional_center") {
          searchLat = geocodeResult.latitude;
          searchLng = geocodeResult.longitude;
          locationLabel = geocodeResult.displayName;
        }
      }

      // If no coordinates are known yet, request location permission from the patient
      if (searchLat === undefined || searchLng === undefined) {
        return {
          intent: "clinic_search",
          state: "idle",
          message:
            "To find nearby hospitals and clinics, Clinix needs access to your device location or the name of your town or neighbourhood. Please tap **Use My Location** below or enter your area.",
          followUpQuestion: null,
          safety: { urgentPathwayTriggered: false, ruleIds: [] },
          clinicSearchPrompt: {
            active: true,
            defaultRadiusMeters: 5000,
          },
          actions: [
            { id: "use_location", label: "Use My Location", type: "action", target: "request_location" },
            { id: "browse_all_clinics", label: "Open Clinic Directory", type: "link", target: "/clinics" },
          ],
          sources: [{ id: "ghana_health_service", title: "Ghana Health Service Verified Facilities" }],
        };
      }

      // Query healthcare places provider
      const placesResponse = await defaultHealthcarePlacesService.searchNearby({
        latitude: searchLat,
        longitude: searchLng,
        radiusMeters,
        limit: 5,
      });

      const facilities = placesResponse.facilities;
      const radiusKm = Math.round(radiusMeters / 1000);

      if (facilities.length === 0) {
        return {
          intent: "clinic_search",
          state: "idle",
          message: `I could not locate verified healthcare facilities within ${radiusKm} km of ${locationLabel || "your location"}. You can try expanding your search radius or browsing our complete directory.`,
          followUpQuestion: null,
          safety: { urgentPathwayTriggered: false, ruleIds: [] },
          clinicSearchPrompt: {
            active: true,
            defaultRadiusMeters: radiusMeters,
            detectedLocationName: locationLabel,
          },
          facilityResults: [],
          actions: [
            { id: "browse_all_clinics", label: "Open Clinic Directory", type: "link", target: "/clinics" },
          ],
          sources: [{ id: "ghana_health_service", title: "Ghana Health Service Verified Facilities" }],
        };
      }

      // Format facility summaries strictly from verified data
      const facilitySummaries = facilities
        .slice(0, 3)
        .map((f, idx) => {
          const distStr = f.distanceMeters !== undefined ? ` (${formatDistance(f.distanceMeters)})` : "";
          const openStr =
            f.openNow !== undefined && f.openNow !== null
              ? f.openNow
                ? " • Open now"
                : " • Currently closed"
              : "";
          const phoneStr = f.phoneNumber ? ` • Tel: ${f.phoneNumber}` : "";
          return `${idx + 1}. **${f.name}**${distStr}\n   ${f.formattedAddress}${openStr}${phoneStr}`;
        })
        .join("\n\n");

      const areaDesc = locationLabel ? ` near **${locationLabel}**` : " near your location";

      return {
        intent: "clinic_search",
        state: "idle",
        message: `Here are verified healthcare facilities${areaDesc} within ${radiusKm} km:\n\n${facilitySummaries}\n\n*Please verify operating hours before traveling for routine care. In life-threatening emergencies, call 112 immediately.*`,
        followUpQuestion: null,
        safety: { urgentPathwayTriggered: false, ruleIds: [] },
        facilityResults: facilities,
        clinicSearchPrompt: {
          active: true,
          defaultRadiusMeters: radiusMeters,
          detectedLocationName: locationLabel,
        },
        actions: [
          { id: "view_on_map", label: "View Detailed Map", type: "link", target: "/clinics" },
          ...(facilities[0]?.phoneNumber
            ? [
                {
                  id: "call_facility",
                  label: `Call ${facilities[0].name}`,
                  type: "call" as const,
                  target: `tel:${facilities[0].phoneNumber}`,
                },
              ]
            : []),
        ],
        sources: [
          placesResponse.provider === "google_places_new"
            ? { id: "google_places", title: "Google Places Healthcare Directory" }
            : { id: "ghana_health_service", title: "Ghana Health Service Verified Facilities" },
        ],
      };
    } catch (err) {
      console.error("[CLINIC SEARCH ERROR]", err);
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
   * Handles structured symptom collection, adaptive follow-up questions, and final assessment.
   * Uses symptom-pathway-aware question selection for a tailored clinical interview.
   */
  private async handleSymptomWorkflow(
    message: string,
    conversation: IAssistantConversation,
    authContext: AssistantAuthContext
  ): Promise<StructuredAssistantResponse> {
    const currentState = conversation.currentState;
    const isMem = this.inMemoryConversations.has(String(conversation._id));

    // Check if there is an active assessment linked
    let assessmentDoc: any = null;
    if (conversation.assessmentId) {
      assessmentDoc = await defaultFullAssessmentService.getAssessment(
        String(conversation.assessmentId),
        authContext
      );
    }

    // =========================================================================
    // BRANCH A: Starting fresh — no assessment exists yet
    // =========================================================================
    if (!assessmentDoc || currentState === "idle") {
      assertValidTransition(currentState, "collecting_symptoms");
      conversation.currentState = "collecting_symptoms";

      // Detect the symptom pathway from the initial message
      const detectedPathway = detectSymptomPathway(message);
      const pathwayDef = SYMPTOM_PATHWAYS[detectedPathway];

      // Initialize structured assessment in database or in-memory
      if (isMem || !(await tryConnectToDatabase())) {
        assessmentDoc = (await defaultFullAssessmentService.initAssessment({
          authContext,
          source: "conversation",
          conversationId: String(conversation._id),
        })) as any;
      } else {
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
      }

      // Store pathway on assessment for later retrieval
      (assessmentDoc as any).aiMetadata = {
        ...(assessmentDoc as any).aiMetadata,
        detectedPathway,
      };

      conversation.assessmentId = assessmentDoc._id as mongoose.Types.ObjectId;
      conversation.currentState = "asking_questions";
      await conversation.save();
      await assessmentDoc.save();

      // Ask the very first adaptive question for the detected pathway
      const firstQ = pathwayDef.questions[0];

      return {
        intent: "symptom_assessment",
        state: "asking_questions",
        conversationStage: "asking_follow_up",
        awaitingPatientResponse: true,
        nextQuestion: firstQ.text,
        message: `I'm sorry you're experiencing that. I'd like to ask a few questions to better understand your symptoms.\n\n${firstQ.text}`,
        followUpQuestion: {
          id: firstQ.id,
          text: firstQ.text,
          type: firstQ.type,
        },
        safety: { urgentPathwayTriggered: false, ruleIds: [] },
        actions: [],
        sources: [],
      };
    }

    // =========================================================================
    // BRANCH B: Ongoing assessment — collecting follow-up answers
    // =========================================================================

    // Build consolidated symptom text from all collected info
    const existingSymptoms = assessmentDoc.symptoms.map((s: any) => s.description).join("; ");
    const consolidatedText = `${existingSymptoms}. Additional update: ${message}`;

    // Append the latest answer to symptoms for richer context
    assessmentDoc.symptoms.push({ description: message });
    await assessmentDoc.save();

    // Re-check safety with full consolidated context after every answer
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
        conversationStage: "escalated",
        awaitingPatientResponse: false,
        nextQuestion: null,
        urgencyLevel: "emergency",
        message:
          reevaluatedSafety.patientMessage ||
          "⚠️ **EMERGENCY WARNING:** Your updated symptoms indicate potential critical warning signs. Please call emergency services immediately.",
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

    // Retrieve conversation history for turn counting
    const history = isMem
      ? this.inMemoryMessages.get(String(conversation._id)) || []
      : await AssistantMessage.find({ conversationId: conversation._id }).sort({ createdAt: 1 });
    const userTurnCount = history.filter((m: any) => m.role === "patient").length;

    // Determine which adaptive pathway to use
    // We re-detect from the full consolidated symptom text for best coverage
    const fullSymptomText = assessmentDoc.symptoms.map((s: any) => s.description).join(" ");
    const currentPathway = detectSymptomPathway(fullSymptomText);
    const pathwayDef = SYMPTOM_PATHWAYS[currentPathway];

    // Build the set of already-answered question IDs from prior assistant messages
    const answeredQIds = history
      .filter((m) => m.role === "assistant" && (m.structuredPayload as any)?.followUpQuestion?.id)
      .map((m) => (m.structuredPayload as any).followUpQuestion.id as string);

    // Check for user-requested early conclusion
    const userWantsConclusion = /enough|conclude|tell me|what is it|summary|done|result|diagnos/i.test(message);

    // =========================================================================
    // DECISION: Evaluate now, or ask the next adaptive question?
    // =========================================================================
    const readyToEvaluate =
      userWantsConclusion ||
      hasEnoughInfoForEvaluation(currentPathway, answeredQIds, userTurnCount);

    if (readyToEvaluate) {
      // -----------------------------------------------------------------------
      // EVALUATE — run the AI assessment
      // -----------------------------------------------------------------------
      assertValidTransition(conversation.currentState, "evaluating");
      conversation.currentState = "evaluating";
      await conversation.save();

      const clinicalResult = await assessSymptoms({
        symptoms: consolidatedText,
        conversationHistory: history.map((h) => ({
          role: h.role === "patient" ? "patient" : "assistant",
          content: h.content,
        })),
      });

      // Update assessment document with AI results
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

      // Build possible conditions text
      const possibleCausesText =
        clinicalResult.possibleConditions.length > 0
          ? "\n\n**Possible Explanations to Discuss with a Clinician:**\n" +
            clinicalResult.possibleConditions
              .map((c) => `• **${c.name}**: ${c.explanation}`)
              .join("\n")
          : "";

      // Build recommended steps text
      const stepsText =
        clinicalResult.recommendedNextSteps.length > 0
          ? "\n\n**Recommended Next Steps:**\n" +
            clinicalResult.recommendedNextSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")
          : "";

      // Build OTC drug suggestions text (only for routine/self-care)
      const otcDrugs = (clinicalResult.medicationGuidance as any)?.suggestedOTCDrugs;
      const medicationText =
        otcDrugs && otcDrugs.length > 0 &&
        (clinicalResult.urgency === "routine" || clinicalResult.urgency === "self_care_eligible")
          ? "\n\n**Over-the-Counter Relief Options** *(ask your pharmacist before use)*:\n" +
            otcDrugs
              .map((d: { name: string; purpose: string; warning: string }) =>
                `• **${d.name}** — ${d.purpose}\n  ⚠️ *${d.warning}*`
              )
              .join("\n")
          : "";

      // Auto-fetch nearby clinics to include in actions via shared healthcare places service
      let clinicActions: StructuredAssistantResponse["actions"] = [];
      try {
        const placesRes = await defaultHealthcarePlacesService.searchNearby({
          latitude: 5.556,
          longitude: -0.1969,
          radiusMeters: 10000,
          facilityTypes: ["hospital", "clinic"],
          limit: 2,
        });
        clinicActions = placesRes.facilities.map((f, i) => ({
          id: `nearby_clinic_${i}`,
          label: f.name,
          type: "link" as const,
          target: `/clinics`,
        }));
      } catch {
        // Clinic fetch failure is non-critical; user can still navigate
      }

      // Urgency label for display
      const urgencyLabels: Record<string, string> = {
        emergency: "🚨 Emergency",
        urgent: "⚠️ Urgent — see a doctor soon",
        routine: "🟢 Routine — professional review recommended",
        self_care_eligible: "🟡 Self-care eligible with monitoring",
        insufficient_information: "ℹ️ More information needed",
      };
      const urgencyLabel = urgencyLabels[clinicalResult.urgency] || clinicalResult.urgency;

      return {
        intent: "symptom_assessment",
        state: "presenting_result",
        conversationStage: "presenting_guidance",
        awaitingPatientResponse: false,
        nextQuestion: null,
        assessmentSummary: clinicalResult.summary,
        nextSteps: clinicalResult.recommendedNextSteps,
        urgencyLevel: clinicalResult.urgency,
        message: `**Assessment Complete**\n\n**Urgency Level:** ${urgencyLabel}\n\n**Summary:** ${clinicalResult.summary}${possibleCausesText}${stepsText}${medicationText}\n\n---\n*⚕️ This is health navigation guidance — not a medical diagnosis. Always consult a qualified healthcare professional. If symptoms worsen, seek care immediately.*`,
        followUpQuestion: null,
        safety: {
          urgentPathwayTriggered: clinicalResult.urgency === "emergency" || clinicalResult.urgency === "urgent",
          ruleIds: [],
        },
        actions: [
          { id: "find_clinic", label: "Find Nearby Clinic", type: "link", target: "/clinics" },
          ...clinicActions,
          { id: "save_assessment", label: "Save to My Records", type: "action", target: "save_assessment" },
          { id: "new_consultation", label: "New Consultation", type: "action", target: "new_conversation" },
        ],
        sources: [{ id: "clinix_triage", title: "Clinix Clinical Guidance Engine" }],
        assessmentDetails: {
          summary: clinicalResult.summary,
          urgency: clinicalResult.urgency,
          possibleConditions: clinicalResult.possibleConditions,
          recommendedNextSteps: clinicalResult.recommendedNextSteps,
          suggestedOTCDrugs: otcDrugs || [],
          limitations: clinicalResult.limitations,
        },
      };
    }

    // -----------------------------------------------------------------------
    // Ask the next adaptive question for this symptom pathway
    // -----------------------------------------------------------------------
    const nextQ = getNextAdaptiveQuestion(currentPathway, answeredQIds);

    if (!nextQ) {
      // All questions answered but evaluator said not enough — force evaluate
      return this.handleSymptomWorkflow(message + " [enough info]", conversation, authContext);
    }

    // Compute progress for the patient
    const totalRequired = pathwayDef.questions.filter((q) => q.required).length;
    const answeredRequired = pathwayDef.questions
      .filter((q) => q.required)
      .filter((q) => answeredQIds.includes(q.id)).length;
    const progressLabel =
      answeredRequired < totalRequired
        ? ` *(Question ${answeredRequired + 1} of ${totalRequired})*`
        : "";

    return {
      intent: "assessment_follow_up",
      state: "asking_questions",
      conversationStage: "asking_follow_up",
      awaitingPatientResponse: true,
      nextQuestion: nextQ.text,
      message: `Thank you for explaining.${progressLabel ? " " + progressLabel : ""}\n\n${nextQ.text}`,
      followUpQuestion: {
        id: nextQ.id,
        text: nextQ.text,
        type: nextQ.type,
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
