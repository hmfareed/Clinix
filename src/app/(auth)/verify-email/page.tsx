"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [loading, setLoading] = React.useState(true);
  const [success, setSuccess] = React.useState(false);
  const [message, setMessage] = React.useState<string>("");

  React.useEffect(() => {
    if (!token) {
      setLoading(false);
      setMessage("No verification token was provided.");
      return;
    }

    async function verify() {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setSuccess(true);
          setMessage("Your email address has been successfully verified!");
        } else {
          setSuccess(false);
          setMessage(data.error?.message || "Verification failed or token expired.");
        }
      } catch (err) {
        setSuccess(false);
        setMessage("A network error occurred while verifying your email.");
      } finally {
        setLoading(false);
      }
    }

    verify();
  }, [token]);

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md shadow-lg border-slate-200 text-center dark:border-slate-800">
        <CardHeader className="space-y-2">
          {loading ? (
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : success ? (
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>
          ) : (
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400">
              <XCircle className="h-8 w-8" />
            </div>
          )}

          <CardTitle className="text-2xl font-bold">
            {loading ? "Verifying Email..." : success ? "Email Verified" : "Verification Failed"}
          </CardTitle>
          <CardDescription className="text-xs">
            {message}
          </CardDescription>
        </CardHeader>

        <CardFooter className="flex justify-center pt-4">
          {success ? (
            <Link href="/login">
              <Button variant="default" size="sm">
                Sign In to Your Account
              </Button>
            </Link>
          ) : !loading ? (
            <Link href="/login">
              <Button variant="outline" size="sm">
                Return to Sign In
              </Button>
            </Link>
          ) : null}
        </CardFooter>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[80vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      }
    >
      <VerifyEmailContent />
    </React.Suspense>
  );
}
