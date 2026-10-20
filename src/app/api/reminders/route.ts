import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Reminder from "@/models/Reminder";

const createReminderSchema = z.object({
  title: z.string().min(1, "Title is required").max(120),
  description: z.string().max(500).optional(),
  reminderType: z.enum(["follow_up", "appointment", "medication_review", "custom"]).default("follow_up"),
  dueDate: z.string().datetime({ message: "Invalid ISO date string" }),
  assessmentId: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "Authentication required to view reminders.",
          },
        },
        { status: 401 }
      );
    }

    await connectToDatabase();

    // STRICT PATIENT SCOPING
    const reminders = await Reminder.find({ patientId: session.user.id })
      .sort({ dueDate: 1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: reminders.map((r) => ({
        id: String(r._id),
        title: r.title,
        description: r.description,
        reminderType: r.reminderType,
        dueDate: r.dueDate,
        status: r.status,
        assessmentId: r.assessmentId ? String(r.assessmentId) : undefined,
        createdAt: r.createdAt,
      })),
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

    console.error("[RemindersGET] Error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to retrieve reminders.",
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHENTICATED",
            message: "Authentication required to create a reminder.",
          },
        },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parseResult = createReminderSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Invalid reminder fields.",
            details: parseResult.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const { title, description, reminderType, dueDate, assessmentId } = parseResult.data;

    const reminder = await Reminder.create({
      patientId: session.user.id,
      title,
      description,
      reminderType,
      dueDate: new Date(dueDate),
      status: "pending",
      assessmentId: assessmentId || undefined,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: String(reminder._id),
          title: reminder.title,
          description: reminder.description,
          reminderType: reminder.reminderType,
          dueDate: reminder.dueDate,
          status: reminder.status,
          assessmentId: reminder.assessmentId ? String(reminder.assessmentId) : undefined,
        },
      },
      { status: 201 }
    );
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

    console.error("[RemindersPOST] Error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to create reminder.",
        },
      },
      { status: 500 }
    );
  }
}
