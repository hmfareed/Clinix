import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import { SavedMedication } from "@/models/SavedMedication";
import { logAuditEvent } from "@/lib/audit/audit";

const saveMedicationSchema = z.object({
  medicationId: z.string().min(1).max(100),
  genericName: z.string().min(1).max(150),
  brandName: z.string().max(150).optional(),
  dosageForm: z.string().max(100).optional(),
  strength: z.string().max(100).optional(),
  therapeuticClass: z.string().max(150).optional(),
  classification: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Please sign in to access your private saved reference medicines.",
        },
      },
      { status: 401 }
    );
  }

  try {
    await connectToDatabase();
    const saved = await SavedMedication.find({ userId: session.user.id })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      data: saved.map((s) => ({
        id: s._id.toString(),
        medicationId: s.medicationId,
        genericName: s.genericName,
        brandName: s.brandName,
        dosageForm: s.dosageForm,
        strength: s.strength,
        therapeuticClass: s.therapeuticClass,
        classification: s.classification,
        notes: s.notes,
        disclaimer: s.disclaimer,
        createdAt: s.createdAt,
      })),
      meta: {
        total: saved.length,
        isPrivateReferenceList: true,
      },
    });
  } catch (error: unknown) {
    console.error("[SavedMedicationsAPI] GET Error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to retrieve your saved reference medicines.",
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Please sign in to save reference medicines to your private list.",
        },
      },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const parseResult = saveMedicationSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid saved medication payload.",
            details: parseResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const data = parseResult.data;
    await connectToDatabase();

    // Check saved limit (max 50)
    const count = await SavedMedication.countDocuments({ userId: session.user.id });
    if (count >= 50) {
      return NextResponse.json(
        {
          error: {
            code: "LIMIT_EXCEEDED",
            message: "You have reached the maximum limit of 50 saved medicines in your reference list.",
          },
        },
        { status: 400 }
      );
    }

    const savedDoc = await SavedMedication.findOneAndUpdate(
      {
        userId: session.user.id,
        medicationId: data.medicationId,
      },
      {
        $set: {
          genericName: data.genericName,
          brandName: data.brandName,
          dosageForm: data.dosageForm,
          strength: data.strength,
          therapeuticClass: data.therapeuticClass,
          classification: data.classification,
          notes: data.notes,
        },
      },
      { upsert: true, new: true }
    );

    try {
      await logAuditEvent({
        actorId: session.user.id,
        actorRole: "patient",
        action: "MEDICATION_SAVED",
        resourceType: "MedicalReference",
        resourceId: data.medicationId,
        outcome: "success",
      });
    } catch {
      // Non-blocking
    }

    return NextResponse.json(
      {
        data: {
          id: savedDoc._id.toString(),
          medicationId: savedDoc.medicationId,
          genericName: savedDoc.genericName,
          brandName: savedDoc.brandName,
          notes: savedDoc.notes,
          disclaimer: savedDoc.disclaimer,
          createdAt: savedDoc.createdAt,
        },
        message: "Medication successfully saved to your private reference list.",
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("[SavedMedicationsAPI] POST Error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to save medication to your reference list.",
        },
      },
      { status: 500 }
    );
  }
}
