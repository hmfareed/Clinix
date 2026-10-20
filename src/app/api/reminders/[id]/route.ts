import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Reminder from "@/models/Reminder";

const updateReminderSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(["pending", "completed", "dismissed"]).optional(),
  dueDate: z.string().datetime().optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "Authentication required to update reminder.",
          },
        },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Reminder not found or inaccessible.",
          },
        },
        { status: 404 }
      );
    }

    const body = await req.json();
    const parseResult = updateReminderSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid update fields.",
            details: parseResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const updateFields: Record<string, unknown> = {};
    if (parseResult.data.title !== undefined) updateFields.title = parseResult.data.title;
    if (parseResult.data.description !== undefined) updateFields.description = parseResult.data.description;
    if (parseResult.data.status !== undefined) updateFields.status = parseResult.data.status;
    if (parseResult.data.dueDate !== undefined) updateFields.dueDate = new Date(parseResult.data.dueDate);

    // STRICT PATIENT SCOPING
    const updated = await Reminder.findOneAndUpdate(
      { _id: id, patientId: session.user.id },
      { $set: updateFields },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Reminder not found or inaccessible.",
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: String(updated._id),
        title: updated.title,
        description: updated.description,
        status: updated.status,
        dueDate: updated.dueDate,
        reminderType: updated.reminderType,
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

    console.error("[ReminderPATCH] Error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to update reminder.",
        },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "Authentication required to delete reminder.",
          },
        },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Reminder not found or inaccessible.",
          },
        },
        { status: 404 }
      );
    }

    await connectToDatabase();

    // STRICT PATIENT SCOPING
    const deleted = await Reminder.findOneAndDelete({
      _id: id,
      patientId: session.user.id,
    });

    if (!deleted) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Reminder not found or inaccessible.",
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Reminder successfully deleted.",
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

    console.error("[ReminderDELETE] Error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to delete reminder.",
        },
      },
      { status: 500 }
    );
  }
}
