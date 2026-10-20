import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";
import { hashPassword } from "@/lib/auth/password";
import { verifyAndConsumeToken } from "@/lib/auth/tokens";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { logAuditEvent } from "@/lib/audit/audit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Validation failed",
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const { token, password } = parsed.data;
    const verification = await verifyAndConsumeToken(token, "password_reset");

    if (!verification.valid || !verification.identifier) {
      return NextResponse.json(
        {
          error: {
            code: "TOKEN_INVALID_OR_EXPIRED",
            message: verification.message || "This password reset link is invalid or has expired.",
          },
        },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const passwordHash = await hashPassword(password);
    const user = await User.findOneAndUpdate(
      { email: verification.identifier },
      { $set: { passwordHash } },
      { new: true }
    );

    if (!user) {
      return NextResponse.json(
        {
          error: {
            code: "USER_NOT_FOUND",
            message: "User account could not be found.",
          },
        },
        { status: 404 }
      );
    }

    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
    await logAuditEvent({
      actorId: String(user._id),
      actorRole: user.role,
      action: "auth_password_reset_success",
      resourceType: "user",
      resourceId: String(user._id),
      outcome: "success",
      ip: clientIp,
    });

    return NextResponse.json({
      success: true,
      message: "Your password has been successfully updated. You may now sign in with your new password.",
    });
  } catch (error) {
    console.error("[RESET PASSWORD ERROR]", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to reset password. Please try again.",
        },
      },
      { status: 500 }
    );
  }
}
