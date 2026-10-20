import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import PatientProfile from "@/models/PatientProfile";
import { logAuditEvent } from "@/lib/audit/audit";

const updateProfileSchema = z.object({
  ageYears: z.number().min(0).max(125).nullable().optional(),
  allergies: z
    .object({
      status: z.enum(["yes", "no", "unknown"]),
      items: z.array(z.string()).default([]),
    })
    .optional(),
  currentMedicines: z
    .object({
      status: z.enum(["yes", "no", "unknown"]),
      items: z.array(z.string()).default([]),
    })
    .optional(),
  pregnancy: z.enum(["yes", "no", "unknown", "not_applicable"]).optional(),
  emergencyContact: z
    .object({
      name: z.string().max(100).optional(),
      phone: z.string().max(30).optional(),
      relationship: z.string().max(50).optional(),
    })
    .optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "Authentication required to view health profile.",
          },
        },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const profile = await PatientProfile.findOne({ userId: session.user.id }).lean();

    if (!profile) {
      // Return safe tri-state default profile if not yet created
      return NextResponse.json({
        success: true,
        data: {
          userId: session.user.id,
          ageYears: null,
          allergies: { status: "unknown", items: [] },
          currentMedicines: { status: "unknown", items: [] },
          pregnancy: "unknown",
          emergencyContact: null,
          isNew: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: String(profile._id),
        userId: String(profile.userId),
        ageYears: profile.ageYears ?? null,
        allergies: profile.allergies || { status: "unknown", items: [] },
        currentMedicines: profile.currentMedicines || { status: "unknown", items: [] },
        pregnancy: profile.pregnancy || "unknown",
        emergencyContact: profile.emergencyContact || null,
        updatedAt: profile.updatedAt,
      },
    });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      (String((error as { digest?: unknown }).digest).includes("PRERENDER") ||
       String((error as { digest?: unknown }).digest).includes("HANGING") ||
       String((error as { digest?: unknown }).digest).includes("DYNAMIC"))
    ) {
      throw error;
    }

    console.error("[PatientProfileGET] Error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to retrieve health profile.",
        },
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "Authentication required to update health profile.",
          },
        },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parseResult = updateProfileSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid health profile fields.",
            details: parseResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const updateData: Record<string, unknown> = {};
    const { ageYears, allergies, currentMedicines, pregnancy, emergencyContact } = parseResult.data;

    if (ageYears !== undefined) updateData.ageYears = ageYears;
    if (allergies !== undefined) updateData.allergies = allergies;
    if (currentMedicines !== undefined) updateData.currentMedicines = currentMedicines;
    if (pregnancy !== undefined) updateData.pregnancy = pregnancy;
    if (emergencyContact !== undefined) updateData.emergencyContact = emergencyContact;

    const profile = await PatientProfile.findOneAndUpdate(
      { userId: session.user.id },
      { $set: updateData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Audit log: actor, action, timestamp, outcome - NO clinical allergy/medicine values
    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
    await logAuditEvent({
      actorId: session.user.id,
      actorRole: "patient",
      action: "patient_profile_updated",
      resourceType: "PatientProfile",
      resourceId: String(profile._id),
      outcome: "success",
      ip: clientIp,
    });

    return NextResponse.json({
      success: true,
      data: {
        id: String(profile._id),
        userId: String(profile.userId),
        ageYears: profile.ageYears ?? null,
        allergies: profile.allergies,
        currentMedicines: profile.currentMedicines,
        pregnancy: profile.pregnancy,
        emergencyContact: profile.emergencyContact,
        updatedAt: profile.updatedAt,
      },
    });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      (String((error as { digest?: unknown }).digest).includes("PRERENDER") ||
       String((error as { digest?: unknown }).digest).includes("HANGING") ||
       String((error as { digest?: unknown }).digest).includes("DYNAMIC"))
    ) {
      throw error;
    }

    console.error("[PatientProfilePATCH] Error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to update health profile.",
        },
      },
      { status: 500 }
    );
  }
}
