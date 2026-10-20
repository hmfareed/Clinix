import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { defaultMedicationService } from "@/services/medication-service";

const searchQuerySchema = z.object({
  q: z.string().max(100).optional().default(""),
});

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const qParam = url.searchParams.get("q") || "";

    const parseResult = searchQuerySchema.safeParse({ q: qParam });
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid query parameter",
          },
        },
        { status: 400 }
      );
    }

    const { q } = parseResult.data;
    const medications = q.trim()
      ? await defaultMedicationService.searchMedications(q)
      : await defaultMedicationService.getAllApproved();

    return NextResponse.json({
      data: medications.map((med) => ({
        id: med.id,
        genericName: med.genericName,
        brandNames: med.brandNames,
        therapeuticClass: med.therapeuticClass,
        classification: med.classification,
        approvedIndications: med.approvedIndications,
      })),
      meta: {
        total: medications.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      (error as { digest?: string }).digest === "NEXT_PRERENDER_INTERRUPTED"
    ) {
      throw error;
    }

    console.error("[MedicationSearchAPI] Search error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Unable to search medication reference catalog.",
        },
      },
      { status: 500 }
    );
  }
}
