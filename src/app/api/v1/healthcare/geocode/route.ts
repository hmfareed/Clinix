import { NextRequest, NextResponse } from "next/server";
import { geocodeRequestSchema } from "@/lib/healthcare-places/types";
import { defaultGeocodeService } from "@/lib/healthcare-places/geocode-service";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "anonymous";

    // Rate limiting: 40 requests per minute
    const rateLimit = checkRateLimit(`healthcare_geocode_${clientIp}`, { limit: 40, windowSeconds: 60 });
    if (!rateLimit.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many geocoding requests. Please wait a moment.",
          },
        },
        { status: 429 }
      );
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_JSON",
            message: "Request body must be valid JSON.",
          },
        },
        { status: 400 }
      );
    }

    const parseResult = geocodeRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_FAILED",
            message: "Please enter a valid city, town, or landmark name.",
            details: parseResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const result = await defaultGeocodeService.geocode(parseResult.data);
    if (!result) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "LOCATION_NOT_FOUND",
            message: "Could not locate that area. Try entering a major Ghanaian city or town (e.g. Accra, Kumasi, Tamale).",
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          latitude: result.latitude,
          longitude: result.longitude,
          displayName: result.displayName,
          provider: result.provider,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (err: unknown) {
    console.error("[GEOCODE API ERROR]", err);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "GEOCODE_ERROR",
          message: "Geocoding service unavailable.",
        },
      },
      { status: 500 }
    );
  }
}
