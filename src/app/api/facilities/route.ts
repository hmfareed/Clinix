import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { defaultFacilityService } from "@/lib/maps/facility-service";
import { FacilityType } from "@/lib/maps/types";

const facilitiesQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  q: z.string().max(100).optional(),
  type: z.enum(["hospital", "clinic", "pharmacy", "emergency_department"]).optional(),
  radiusKm: z.coerce.number().min(1).max(500).default(30).optional(),
  limit: z.coerce.number().min(1).max(50).default(20).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const searchParams = Object.fromEntries(url.searchParams.entries());

    // Privacy Guardrail: Ensure no symptom or clinical text is ever sent in map queries
    const forbiddenKeys = ["symptoms", "transcript", "condition", "diagnosis", "history"];
    for (const key of Object.keys(searchParams)) {
      if (forbiddenKeys.includes(key.toLowerCase())) {
        return NextResponse.json(
          {
            error: {
              code: "FORBIDDEN_QUERY_PARAMETER",
              message: "Medical transcripts and symptom details are strictly forbidden in facility queries to protect patient privacy.",
            },
          },
          { status: 400 }
        );
      }
    }

    const parseResult = facilitiesQuerySchema.safeParse(searchParams);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid facility search parameters.",
            details: parseResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { lat, lng, q, type, radiusKm, limit } = parseResult.data;

    const facilities = await defaultFacilityService.searchFacilities({
      lat,
      lng,
      query: q,
      type: type as FacilityType,
      radiusKm,
      limit,
    });

    return NextResponse.json(
      {
        success: true,
        count: facilities.length,
        data: facilities,
        query: {
          q: q || null,
          type: type || "all",
          coordinatesProvided: Boolean(lat !== undefined && lng !== undefined),
        },
      },
      {
        headers: {
          "Cache-Control": "public, max-age=300, stale-while-revalidate=1800",
        },
      }
    );
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      (error as { digest?: string }).digest === "NEXT_PRERENDER_INTERRUPTED"
    ) {
      throw error;
    }

    console.error("[FACILITIES API ERROR]", error);

    // Degraded Mode Fallback per 25-error-states-and-fallbacks.md
    return NextResponse.json(
      {
        error: {
          code: "MAPS_UNAVAILABLE",
          message: "Facility directory search is temporarily degraded.",
          safeAction: "If you need immediate emergency care, call 112 now.",
          externalSearchUrl: "https://www.google.com/maps/search/hospital+near+me",
        },
      },
      { status: 503 }
    );
  }
}
