import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM || "Clinix Health <no-reply@clinixhealth.org>";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

const resend = resendApiKey ? new Resend(resendApiKey) : null;

export async function sendVerificationEmail(
  toEmail: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  const verifyUrl = `${appUrl}/verify-email?token=${encodeURIComponent(token)}`;

  if (!resend) {
    console.info(`\n======================================================`);
    console.info(`[DEV EMAIL SIMULATION] Verification Email to: ${toEmail}`);
    console.info(`Verification Link: ${verifyUrl}`);
    console.info(`======================================================\n`);
    return { success: true };
  }

  try {
    const { error } = await resend.emails.send({
      from: emailFrom,
      to: toEmail,
      subject: "Verify your email address - Clinix Health",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #0d9488;">Clinix Health Assistant</h2>
          <p>Hello,</p>
          <p>Thank you for registering with Clinix. Please verify your email address to activate your patient account and manage your assessments.</p>
          <p style="margin: 25px 0;">
            <a href="${verifyUrl}" style="background-color: #0d9488; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Verify Email Address
            </a>
          </p>
          <p style="color: #64748b; font-size: 14px;">This link will expire in 60 minutes. If you did not create an account, you can safely ignore this email.</p>
        </div>
      `,
    });

    if (error) {
      console.error("[EMAIL ERROR] Failed to send verification email via Resend:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("[EMAIL ERROR] Unexpected error in sendVerificationEmail:", err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendPasswordResetEmail(
  toEmail: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;

  if (!resend) {
    console.info(`\n======================================================`);
    console.info(`[DEV EMAIL SIMULATION] Password Reset Email to: ${toEmail}`);
    console.info(`Reset Link: ${resetUrl}`);
    console.info(`======================================================\n`);
    return { success: true };
  }

  try {
    const { error } = await resend.emails.send({
      from: emailFrom,
      to: toEmail,
      subject: "Reset your password - Clinix Health",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #0d9488;">Clinix Health Assistant</h2>
          <p>Hello,</p>
          <p>We received a request to reset your password. Click the button below to choose a new password:</p>
          <p style="margin: 25px 0;">
            <a href="${resetUrl}" style="background-color: #0d9488; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
              Reset Password
            </a>
          </p>
          <p style="color: #64748b; font-size: 14px;">This link will expire in 60 minutes. If you did not request this change, your password remains secure.</p>
        </div>
      `,
    });

    if (error) {
      console.error("[EMAIL ERROR] Failed to send password reset email via Resend:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error("[EMAIL ERROR] Unexpected error in sendPasswordResetEmail:", err);
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
