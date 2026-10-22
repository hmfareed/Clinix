import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { defaultMedicationService } from "@/services/medication-service";
import { MedicationClassification } from "@/lib/medication/types";

const searchQuerySchema = z.object({
  q: z.string().max(100).optional().default(""),
  category: z.string().max(50).optional(),
  form: z.string().max(50).optional(),
  classification: z.enum(["over_the_counter", "prescription_only", "pharmacist_only"]).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const qParam = url.searchParams.get("q") || "";
    const categoryParam = url.searchParams.get("category") || undefined;
    const formParam = url.searchParams.get("form") || undefined;
    const classificationParam = (url.searchParams.get("classification") as MedicationClassification) || undefined;

    const parseResult = searchQuerySchema.safeParse({
      q: qParam,
      category: categoryParam,
      form: formParam,
      classification: classificationParam,
    });

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

    const { q, category, form, classification } = parseResult.data;
    const medications = await defaultMedicationService.searchMedicationsWithFilters(q, {
      category,
      form,
      classification,
    });

    return NextResponse.json({
      data: medications.map((med) => ({
        id: med.id,
        genericName: med.genericName,
        brandNames: med.brandNames,
        therapeuticClass: med.therapeuticClass,
        classification: med.classification,
        approvedIndications: med.approvedIndications,
        activeIngredients: med.activeIngredients,
        availableForms: med.availableForms,
        dosageForms: med.dosageForms,
        routes: med.routes,
        boxedWarning: med.boxedWarning,
        registrationNumber: med.registrationNumber,
        referenceSource: med.referenceSource,
      })),
      meta: {
        total: medications.length,
        query: q,
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
