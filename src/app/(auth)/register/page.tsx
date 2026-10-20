"use client";

import * as React from "react";
import Link from "next/link";
import { HeartPulse, ShieldCheck, MailCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";

export default function RegisterPage() {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [consentPrivacy, setConsentPrivacy] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [registeredSuccess, setRegisteredSuccess] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (!consentPrivacy) {
      setError("You must review and accept the Privacy Policy to create a patient account.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          consentPrivacy,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error?.details) {
          setFieldErrors(data.error.details);
        } else {
          setError(data.error?.message || "Registration failed. Please check your details.");
        }
      } else {
        setRegisteredSuccess(true);
      }
    } catch (err) {
      setError("An unexpected network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (registeredSuccess) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md shadow-lg border-teal-200 text-center dark:border-teal-900">
          <CardHeader className="space-y-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-100 text-teal-600 shadow-sm dark:bg-teal-950/60 dark:text-teal-400">
              <MailCheck className="h-8 w-8" />
            </div>
            <CardTitle className="text-2xl font-bold">Verify Your Email</CardTitle>
            <CardDescription className="text-xs text-slate-600 dark:text-slate-300">
              We have sent an activation link to <strong>{email}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-slate-500 space-y-2">
            <p>
              Please open the link in your email to verify your address and activate your patient
              account.
            </p>
            <p className="text-[11px] text-slate-400">
              In development mode without Resend API key configured, the activation link was printed to the server terminal.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Link href="/login">
              <Button variant="default" size="sm">
                Return to Sign In
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md shadow-lg border-slate-200 dark:border-slate-800">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm mb-2">
            <HeartPulse className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold">Register Patient Account</CardTitle>
          <CardDescription className="text-xs">
            Save assessments and securely manage your triage history
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Full Name (Optional)
              </label>
              <Input
                type="text"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                error={fieldErrors.name?.[0]}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Email Address
              </label>
              <Input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                error={fieldErrors.email?.[0]}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Password
              </label>
              <Input
                type="password"
                placeholder="At least 8 characters with letters & numbers"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                error={fieldErrors.password?.[0]}
              />
            </div>

            {/* Consent Checkbox */}
            <div className="pt-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentPrivacy}
                  onChange={(e) => setConsentPrivacy(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  required
                />
                <span className="text-xs text-slate-600 dark:text-slate-400 leading-tight">
                  I agree to the{" "}
                  <Link href="/privacy" className="text-teal-600 underline hover:text-teal-700">
                    Privacy Notice
                  </Link>{" "}
                  and acknowledge that Clinix provides clinical triage and educational explanations, not
                  definitive medical diagnoses.
                </span>
              </label>
              {fieldErrors.consentPrivacy?.[0] && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.consentPrivacy[0]}</p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" variant="default" className="w-full font-semibold" disabled={loading}>
              {loading ? "Creating Account..." : "Create Account"}
            </Button>

            <div className="text-center text-xs text-slate-500">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-teal-600 hover:underline dark:text-teal-400">
                Sign In
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
