import { NextRequest, NextResponse } from "next/server";
import { defaultMedicationService } from "@/services/medication-service";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: { code: "VALIDATION_FAILED", message: "Medication ID is required." } },
        { status: 400 }
      );
    }

    const decodedId = decodeURIComponent(id).trim();

    // Try lookup by ID first (e.g. GH-MED-001)
    let med = await defaultMedicationService.getMedicationById(decodedId);
    if (!med) {
      // Fallback to name or brand lookup
      med = await defaultMedicationService.getByNameOrBrand(decodedId);
    }

    if (!med) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `Medication "${decodedId}" not found in verified registry.`,
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: med,
      meta: {
        timestamp: new Date().toISOString(),
        verified: true,
      },
    });
  } catch (error: unknown) {
    console.error("[MedicationDetailAPI] Error retrieving medication details:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Unable to retrieve medication details at this time.",
        },
      },
      { status: 500 }
    );
  }
}
