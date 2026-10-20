import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";
import { createVerificationToken } from "@/lib/auth/tokens";
import { sendPasswordResetEmail } from "@/lib/auth/email";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { logAuditEvent } from "@/lib/audit/audit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Please enter a valid email address.",
          },
        },
        { status: 400 }
      );
    }

    const { email } = parsed.data;
    await connectToDatabase();

    const user = await User.findOne({ email });
    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");

    if (user && user.status === "active") {
      const resetToken = await createVerificationToken(user.email, "password_reset", 60);
      await sendPasswordResetEmail(user.email, resetToken);

      await logAuditEvent({
        actorId: String(user._id),
        actorRole: user.role,
        action: "auth_password_reset_requested",
        resourceType: "user",
        resourceId: String(user._id),
        outcome: "success",
        ip: clientIp,
      });
    } else {
      // Log for security auditing without leaking to client
      await logAuditEvent({
        action: "auth_password_reset_unknown_email",
        outcome: "denied",
        ip: clientIp,
      });
    }

    // Always return generic message to avoid email enumeration
    return NextResponse.json({
      success: true,
      message:
        "If an account exists with this email address, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("[FORGOT PASSWORD ERROR]", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Unable to process password reset request.",
        },
      },
      { status: 500 }
    );
  }
}
