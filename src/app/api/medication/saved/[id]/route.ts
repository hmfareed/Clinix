import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import { SavedMedication } from "@/models/SavedMedication";
import mongoose from "mongoose";

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Please sign in to manage your saved medicines.",
        },
      },
      { status: 401 }
    );
  }

  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json(
        { error: { code: "VALIDATION_FAILED", message: "Saved item ID is required." } },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Support deleting by MongoDB _id OR medicationId
    const query: Record<string, unknown> = { userId: session.user.id };
    if (mongoose.Types.ObjectId.isValid(id)) {
      query._id = id;
    } else {
      query.medicationId = id;
    }

    const deleted = await SavedMedication.findOneAndDelete(query);
    if (!deleted) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Saved medication reference not found or already removed.",
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Medication successfully removed from your saved references.",
      data: { id: deleted._id.toString(), medicationId: deleted.medicationId },
    });
  } catch (error: unknown) {
    console.error("[SavedMedicationsAPI] DELETE Error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to remove medication from saved list.",
        },
      },
      { status: 500 }
    );
  }
}
