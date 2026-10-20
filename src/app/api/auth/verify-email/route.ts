import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";
import { verifyAndConsumeToken } from "@/lib/auth/tokens";
import { logAuditEvent } from "@/lib/audit/audit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body.token;

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Verification token is required.",
          },
        },
        { status: 400 }
      );
    }

    const verification = await verifyAndConsumeToken(token, "email_verification");
    if (!verification.valid || !verification.identifier) {
      return NextResponse.json(
        {
          error: {
            code: "TOKEN_INVALID_OR_EXPIRED",
            message: verification.message || "This verification link is invalid or has expired.",
          },
        },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const user = await User.findOneAndUpdate(
      { email: verification.identifier },
      { $set: { emailVerified: new Date() } },
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
      action: "auth_email_verified",
      resourceType: "user",
      resourceId: String(user._id),
      outcome: "success",
      ip: clientIp,
    });

    return NextResponse.json({
      success: true,
      message: "Your email address has been successfully verified.",
    });
  } catch (error) {
    console.error("[VERIFY EMAIL ERROR]", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to verify email address.",
        },
      },
      { status: 500 }
    );
  }
}
