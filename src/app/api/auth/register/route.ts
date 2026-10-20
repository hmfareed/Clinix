import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/mongodb";
import User from "@/models/User";
import Consent from "@/models/Consent";
import { hashPassword } from "@/lib/auth/password";
import { createVerificationToken } from "@/lib/auth/tokens";
import { sendVerificationEmail } from "@/lib/auth/email";
import { registerSchema } from "@/lib/validation/auth";
import { logAuditEvent } from "@/lib/audit/audit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

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

    const { email, password, name } = parsed.data;
    await connectToDatabase();

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // Return 409 Conflict
      return NextResponse.json(
        {
          error: {
            code: "USER_EXISTS",
            message: "An account with this email address already exists.",
          },
        },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({
      email,
      name,
      passwordHash,
      role: "patient",
      status: "active",
      emailVerified: null,
    });

    // Record required privacy policy consent
    const consent = await Consent.create({
      userId: user._id,
      type: "privacy",
      policyVersion: "1.0",
      status: "granted",
      grantedAt: new Date(),
    });

    // Generate email verification token and send email
    const verificationToken = await createVerificationToken(user.email, "email_verification", 60);
    await sendVerificationEmail(user.email, verificationToken);

    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
    await logAuditEvent({
      actorId: String(user._id),
      actorRole: user.role,
      action: "auth_register_success",
      resourceType: "user",
      resourceId: String(user._id),
      outcome: "success",
      ip: clientIp,
      metadata: { consentId: String(consent._id) },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Registration successful. Please check your email to verify your account.",
        user: {
          id: String(user._id),
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[REGISTER API ERROR]", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred during registration. Please try again.",
        },
      },
      { status: 500 }
    );
  }
}
