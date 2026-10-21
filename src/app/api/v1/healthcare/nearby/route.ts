import { NextRequest, NextResponse } from "next/server";
import { nearbySearchRequestSchema } from "@/lib/healthcare-places/types";
import { defaultHealthcarePlacesService } from "@/lib/healthcare-places/places-service";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";

    // 1. Rate limiting (e.g. 30 requests per minute per IP)
    const rateLimit = checkRateLimit(`healthcare_nearby_${clientIp}`, { limit: 30, windowSeconds: 60 });
    if (!rateLimit.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many nearby facility requests. Please wait a moment before trying again.",
          },
        },
        { status: 429 }
      );
    }

    // 2. Parse and validate JSON payload
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_JSON",
            message: "Request body must be a valid JSON object.",
          },
        },
        { status: 400 }
      );
    }

    const parseResult = nearbySearchRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid location or radius search parameters.",
            details: parseResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { latitude, longitude, radiusMeters, facilityTypes, limit } = parseResult.data;

    // Privacy safeguard: Reject requests containing forbidden diagnostic keywords
    const bodyStr = JSON.stringify(rawBody).toLowerCase();
    const sensitiveMedicalWords = ["symptoms", "diagnosis", "hiv", "abortion", "mental_illness"];
    if (sensitiveMedicalWords.some((w) => bodyStr.includes(`"${w}"`))) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PRIVACY_GUARDRAIL_TRIGGERED",
            message: "Symptom details and diagnostic transcripts must never be sent in geolocation requests.",
          },
        },
        { status: 400 }
      );
    }

    // 3. Execute healthcare places search
    const results = await defaultHealthcarePlacesService.searchNearby({
      latitude,
      longitude,
      radiusMeters,
      facilityTypes,
      limit,
    });

    return NextResponse.json(
      {
        success: true,
        data: results.facilities,
        metadata: {
          totalCount: results.totalCount,
          provider: results.provider,
          radiusMeters: results.radiusMeters,
          searchTimeMs: results.searchTimeMs,
          center: results.center,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (err: unknown) {
    console.error("[HEALTHCARE NEARBY API ERROR]", err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "SEARCH_FAILED",
          message: "Unable to find nearby healthcare facilities right now. If in distress, dial 112 immediately.",
        },
      },
      { status: 500 }
    );
  }
}
