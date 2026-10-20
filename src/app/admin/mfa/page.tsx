"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ShieldCheck,
  Lock,
  KeyRound,
  AlertTriangle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminMfaVerificationPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [code, setCode] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const json = await res.json();

      if (!res.ok) {
        setErrorMsg(json.error?.message || "Invalid MFA passcode.");
      } else {
        router.push("/admin");
      }
    } catch {
      setErrorMsg("Network error verifying MFA passcode.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900 shadow-xl text-slate-100">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/30">
            <Lock className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl font-bold text-white">
            Admin MFA Verification
          </CardTitle>
          <CardDescription className="text-xs text-slate-400">
            In compliance with security standards, all non-patient administrative roles require multi-factor authentication.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errorMsg && (
            <div className="mb-4 rounded-lg bg-red-950/60 border border-red-500 p-3 text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-1.5 text-center">
              <label className="text-xs font-semibold text-slate-300">
                Enter 6-Digit Authenticator Passcode
              </label>
              <Input
                type="text"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                className="text-center text-2xl tracking-widest font-mono bg-slate-950 border-slate-700 text-teal-400 h-12"
              />
              <p className="text-[11px] text-slate-500 pt-1">
                Demo passcode: <span className="font-mono text-teal-300">123456</span> or <span className="font-mono text-teal-300">654321</span>
              </p>
            </div>

            <Button
              type="submit"
              disabled={submitting || code.length < 6}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs h-10"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-1.5 h-4 w-4" />
                  Verify & Access Admin Portal
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
