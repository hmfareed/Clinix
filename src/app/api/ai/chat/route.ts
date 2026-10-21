import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { assessSymptoms } from "@/services/assessment-service";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { logAuditEvent } from "@/lib/audit/audit";
import { auth } from "@/lib/auth/auth";
import { defaultHealthcarePlacesService } from "@/lib/healthcare-places/places-service";
import { defaultGeocodeService } from "@/lib/healthcare-places/geocode-service";
import { formatDistance } from "@/lib/healthcare-places/distance";

const MAX_FOLLOW_UP_TURNS = 6;

const chatRequestSchema = z.object({
  sessionId: z.string().optional(),
  message: z.string().min(1).max(2000),
  symptoms: z.string().min(1).max(2000),
  conversationHistory: z.array(
    z.object({
      role: z.enum(["patient", "assistant"]),
      content: z.string(),
    })
  ).default([]),
  age: z.number().optional(),
  allergies: z
    .object({
      status: z.enum(["yes", "no", "unknown"]),
      items: z.array(z.string()).optional(),
    })
    .optional(),
  currentMedicines: z
    .object({
      status: z.enum(["yes", "no", "unknown"]),
      items: z.array(z.string()).optional(),
    })
    .optional(),
  pregnancy: z.enum(["yes", "no", "unknown", "not_applicable"]).optional(),
  language: z.string().default("en"),
  concludeNow: z.boolean().default(false),
  locationContext: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      radiusMeters: z.number().min(500).max(25000).optional(),
      locationName: z.string().max(120).optional(),
    })
    .optional(),
});

export async function POST(req: NextRequest) {
  const requestId = `req_${crypto.randomBytes(8).toString("hex")}`;
  const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";

  // Rate Limiting (25 requests per minute for active chat)
  const rateLimit = checkRateLimit(`ai_chat_${clientIp}`, {
    limit: 25,
    windowSeconds: 60,
  });

  const rateLimitHeaders = {
    "X-Request-Id": requestId,
    "X-RateLimit-Limit": String(rateLimit.limit),
    "X-RateLimit-Remaining": String(rateLimit.remaining),
    "X-RateLimit-Reset": String(rateLimit.resetSeconds),
  };

  if (!rateLimit.success) {
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMITED",
          message: "You are sending messages too quickly. Please pause for a moment before continuing.",
          safeAction: "If you are in acute distress, call 112 immediately.",
          requestId,
        },
      },
      { status: 429, headers: rateLimitHeaders }
    );
  }

  try {
    const session = await auth();
    const rawBody = await req.json();
    const parseResult = chatRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid chat payload.",
            details: parseResult.error.flatten().fieldErrors,
            requestId,
          },
        },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    const {
      message,
      symptoms,
      conversationHistory,
      age,
      allergies,
      currentMedicines,
      pregnancy,
      language,
      concludeNow,
      locationContext,
    } = parseResult.data;

    // Check for fixed refusal on out-of-scope prescription requests
    const prescriptionKeywords = ["prescribe", "prescription", "write me a script", "give me antibiotics"];
    const lowerMessage = message.toLowerCase();
    if (prescriptionKeywords.some((kw) => lowerMessage.includes(kw))) {
      const refusalMsg =
        "Clinix is an informational triage assistant and cannot issue prescriptions, calculate specific doses, or prescribe medications. Please visit a licensed physician or consult a registered pharmacist for prescription medicines.";

      return NextResponse.json(
        {
          success: true,
          data: {
            isRefusal: true,
            summary: "Prescription requests cannot be fulfilled.",
            message: refusalMsg,
            reply: refusalMsg,
            urgency: "routine",
            urgencyLevel: "routine",
            possibleConditions: [],
            possibleCauses: [],
            followUpQuestions: [],
            recommendedNextSteps: [
              "Consult a licensed medical doctor or clinic for physical examination and prescription evaluation.",
              "Speak with a licensed community pharmacist regarding over-the-counter options.",
            ],
            nextSteps: [
              "Consult a licensed medical doctor or clinic for physical examination and prescription evaluation.",
              "Speak with a licensed community pharmacist regarding over-the-counter options.",
            ],
            redFlags: [],
            disclaimer: "Clinix provides clinical triage and health navigation only, not medical prescriptions or definitive diagnoses.",
          },
          requestId,
        },
        { status: 200, headers: rateLimitHeaders }
      );
    }

    // Check for clinic search / healthcare places discovery
    const CLINIC_SEARCH_KEYWORDS = [
      "hospital",
      "clinic",
      "doctor near",
      "nearest hospital",
      "nearest clinic",
      "find care",
      "medical facility",
      "emergency room",
      "urgent care",
      "pharmacy",
      "health center",
      "health centre",
    ];

    const isClinicSearch =
      Boolean(locationContext) ||
      CLINIC_SEARCH_KEYWORDS.some((kw) => lowerMessage.includes(kw));

    if (isClinicSearch) {
      let lat = locationContext?.latitude;
      let lng = locationContext?.longitude;
      let locName = locationContext?.locationName;
      const radiusMeters = locationContext?.radiusMeters || 5000;

      if (lat === undefined || lng === undefined) {
        const geocoded = await defaultGeocodeService.geocode({ query: message });
        if (geocoded && geocoded.provider !== "fallback_regional_center") {
          lat = geocoded.latitude;
          lng = geocoded.longitude;
          locName = geocoded.displayName;
        }
      }

      if (lat === undefined || lng === undefined) {
        return NextResponse.json(
          {
            success: true,
            data: {
              summary: "Find Nearby Healthcare Facilities",
              message:
                "To locate verified hospitals and clinics near you, Clinix needs permission to use your device location, or you can enter your town or area below.",
              reply:
                "To locate verified hospitals and clinics near you, Clinix needs permission to use your device location, or you can enter your town or area below.",
              urgency: "routine",
              urgencyLevel: "routine",
              possibleConditions: [],
              possibleCauses: [],
              followUpQuestions: [],
              recommendedNextSteps: [
                "Tap 'Use My Location' to discover facilities closest to you.",
                "Or enter your town or neighbourhood (e.g., Accra, Kumasi, Osu).",
                "For life-threatening emergencies, call 112 immediately.",
              ],
              nextSteps: [
                "Tap 'Use My Location' to discover facilities closest to you.",
                "Or enter your town or neighbourhood (e.g., Accra, Kumasi, Osu).",
                "For life-threatening emergencies, call 112 immediately.",
              ],
              redFlags: [],
              disclaimer:
                "Clinix displays verified healthcare facilities from public records. Always verify hours before traveling.",
              clinicSearchPrompt: {
                active: true,
                defaultRadiusMeters: 5000,
              },
              facilityResults: [],
            },
            isConcluded: false,
            requestId,
          },
          { status: 200, headers: rateLimitHeaders }
        );
      }

      const places = await defaultHealthcarePlacesService.searchNearby({
        latitude: lat,
        longitude: lng,
        radiusMeters,
        limit: 5,
      });

      const facilities = places.facilities;
      const radiusKm = Math.round(radiusMeters / 1000);
      const summaries = facilities
        .slice(0, 3)
        .map(
          (f, i) =>
            `${i + 1}. **${f.name}** (${formatDistance(f.distanceMeters)}) - ${f.formattedAddress}${
              f.phoneNumber ? ` • Tel: ${f.phoneNumber}` : ""
            }`
        )
        .join("\n\n");

      return NextResponse.json(
        {
          success: true,
          data: {
            summary: `Verified Healthcare Facilities (${facilities.length} found)`,
            message:
              facilities.length > 0
                ? `Here are verified healthcare facilities within ${radiusKm} km of ${locName || "your location"}:\n\n${summaries}\n\n*Please confirm emergency hours prior to departure.*`
                : `I could not locate verified facilities within ${radiusKm} km of ${locName || "your location"}. You may expand the search radius or browse our full directory.`,
            reply:
              facilities.length > 0
                ? `Here are verified healthcare facilities within ${radiusKm} km of ${locName || "your location"}:\n\n${summaries}\n\n*Please confirm emergency hours prior to departure.*`
                : `I could not locate verified facilities within ${radiusKm} km of ${locName || "your location"}. You may expand the search radius or browse our full directory.`,
            urgency: "routine",
            urgencyLevel: "routine",
            possibleConditions: [],
            possibleCauses: [],
            followUpQuestions: [],
            recommendedNextSteps: [
              "Contact the facility beforehand to verify physician availability and current wait times.",
              "If you have severe chest pain, stroke symptoms, or severe breathing difficulties, call 112 immediately.",
            ],
            nextSteps: [
              "Contact the facility beforehand to verify physician availability and current wait times.",
              "If you have severe chest pain, stroke symptoms, or severe breathing difficulties, call 112 immediately.",
            ],
            redFlags: [],
            disclaimer:
              "Clinix displays verified healthcare facilities from public records. Always verify hours before traveling.",
            facilityResults: facilities,
            clinicSearchPrompt: {
              active: true,
              defaultRadiusMeters: radiusMeters,
              detectedLocationName: locName,
            },
          },
          isConcluded: false,
          requestId,
        },
        { status: 200, headers: rateLimitHeaders }
      );
    }

    // Check for greetings and introductory conversational openers (immediate response, no LLM lag)
    const GREETING_WORDS = [
      "hi",
      "hello",
      "hey",
      "good morning",
      "good afternoon",
      "good evening",
      "how are you",
      "howdy",
      "sup",
      "what can you do",
      "help",
      "who are you",
      "greetings",
    ];

    const cleanLower = message.trim().toLowerCase().replace(/[^a-z0-9\s]/g, "");
    const isGreeting =
      GREETING_WORDS.includes(cleanLower) ||
      GREETING_WORDS.some((g) => cleanLower.startsWith(`${g} `) && cleanLower.length < 20);

    if (isGreeting) {
      const greetingMsg =
        "Hello! I am your Clinix Health Assistant. Tell me what symptoms or health concerns you are experiencing, and I will help guide you toward possible causes, next steps, and verified care.";

      return NextResponse.json(
        {
          success: true,
          data: {
            summary: "Hello! I am your Clinix AI Health Assistant.",
            message: greetingMsg,
            reply: greetingMsg,
            urgency: "insufficient_information",
            urgencyLevel: "insufficient_information",
            possibleConditions: [],
            possibleCauses: [],
            followUpQuestions: [
              "I have a fever or chills",
              "I have stomach pain or nausea",
              "I have a headache or migraine",
              "I have a cough or chest discomfort",
            ],
            recommendedNextSteps: [
              "Describe the symptoms you are feeling in everyday language.",
              "Include how long you have had them and their severity.",
              "If you are experiencing severe chest pain or shortness of breath, dial 112 immediately.",
            ],
            nextSteps: [
              "Describe the symptoms you are feeling in everyday language.",
              "Include how long you have had them and their severity.",
              "If you are experiencing severe chest pain or shortness of breath, dial 112 immediately.",
            ],
            redFlags: [],
            disclaimer: "This guidance is for clinical triage navigation only and is not a confirmed medical diagnosis.",
            medicationGuidance: {
              available: false,
              explanation: "Medication information is available once specific symptoms or medications are mentioned.",
              requiresProfessionalReview: true,
              suggestedOTCDrugs: [],
            },
            limitations: [
              "A greeting was received. Please describe your symptoms for a structured assessment.",
            ],
          },
          isConcluded: false,
          requestId,
        },
        { status: 200, headers: rateLimitHeaders }
      );
    }

    // Build updated history ensuring no duplicate patient turns
    const lastHistoryMsg = conversationHistory[conversationHistory.length - 1];
    const isAlreadyInHistory =
      lastHistoryMsg &&
      lastHistoryMsg.role === "patient" &&
      lastHistoryMsg.content.trim() === message.trim();

    const updatedHistory = isAlreadyInHistory
      ? conversationHistory
      : [...conversationHistory, { role: "patient" as const, content: message }];

    // Enforce maximum turn cap or forced conclusion
    const patientTurns = updatedHistory.filter((m) => m.role === "patient").length;
    const shouldConclude = concludeNow || patientTurns >= MAX_FOLLOW_UP_TURNS;

    const consolidatedSymptoms = symptoms.includes(message)
      ? symptoms
      : `${symptoms}. Latest detail: ${message}`;

    const assessment = await assessSymptoms({
      symptoms: consolidatedSymptoms,
      conversationHistory: updatedHistory,
      age,
      allergies,
      currentMedicines,
      pregnancy,
      language,
    });

    // If turn limit reached or requested to conclude, clear any remaining follow-up questions
    if (shouldConclude && assessment.urgency !== "emergency") {
      assessment.followUpQuestions = [];
    }

    await logAuditEvent({
      actorId: session?.user?.id,
      actorRole: (session?.user as unknown as { role?: string })?.role || "anonymous",
      action: "ai_chat_turn_completed",
      outcome: "success",
      ip: clientIp,
      metadata: {
        turn: patientTurns,
        urgency: assessment.urgency,
        concluded: shouldConclude,
        requestId,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: assessment,
        isConcluded: shouldConclude || assessment.urgency === "emergency" || assessment.followUpQuestions.length === 0,
        requestId,
      },
      { status: 200, headers: rateLimitHeaders }
    );
  } catch (err: unknown) {
    console.error(`[AI CHAT ERROR - ${requestId}]`, err);

    const isAssessmentUnavailable =
      err && typeof err === "object" && (err as { code?: string }).code === "AI_UNAVAILABLE";

    const errorStatus = isAssessmentUnavailable ? 503 : 500;
    const errorCode = isAssessmentUnavailable ? "AI_UNAVAILABLE" : "INTERNAL_ERROR";
    const errorMessage =
      isAssessmentUnavailable
        ? (err as Error).message
        : "We couldn't continue your assessment right now. This is not a sign that you are fine.";

    const safeAction =
      (err as { safeAction?: string })?.safeAction ||
      "If you have severe or worsening symptoms, call 112 immediately or visit the nearest healthcare facility.";

    return NextResponse.json(
      {
        error: {
          code: errorCode,
          message: errorMessage,
          safeAction,
          requestId,
        },
      },
      { status: errorStatus, headers: rateLimitHeaders }
    );
  }
}
