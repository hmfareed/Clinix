import { NextRequest, NextResponse } from "next/server";
import { getEmergencyConfiguration } from "@/lib/emergency/emergency-config";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const country = url.searchParams.get("country");

    const config = await getEmergencyConfiguration(country);

    return NextResponse.json(
      {
        success: true,
        data: config,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
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

    console.error("[EMERGENCY CONFIG API ERROR]", error);
    return NextResponse.json({
      success: true,
      data: {
        countryCode: "GH",
        countryName: "Ghana",
        emergencyNumber: "112",
        serviceName: "Ghana National Ambulance Service",
        isVerified: true,
        source: "bundled_fallback",
      },
    });
  }
}
