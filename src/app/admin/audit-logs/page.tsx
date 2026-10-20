"use client";

import * as React from "react";
import {
  KeyRound,
  ShieldAlert,
  AlertTriangle,
  Lock,
  Unlock,
  Clock,
  Loader2,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function AdminAuditLogsPage() {
  const [resourceType, setResourceType] = React.useState<"Assessment" | "AssessmentSession">("Assessment");
  const [resourceId, setResourceId] = React.useState("");
  const [justificationReason, setJustificationReason] = React.useState("");
  const [durationMinutes, setDurationMinutes] = React.useState<number>(30);
  const [submitting, setSubmitting] = React.useState(false);

  const [unlockedResult, setUnlockedResult] = React.useState<any | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const handleBreakGlass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (justificationReason.trim().length < 15) {
      setErrorMsg("Justification reason must be at least 15 characters explaining clinical or legal necessity.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setUnlockedResult(null);

    try {
      const res = await fetch("/api/admin/break-glass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceType,
          resourceId: resourceId.trim(),
          justificationReason: justificationReason.trim(),
          durationMinutes: Number(durationMinutes),
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        setErrorMsg(json.error?.message || "Break-glass request denied.");
      } else {
        setUnlockedResult(json);
      }
    } catch {
      setErrorMsg("Network error during break-glass authorization.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in-50 duration-200">
      <div>
        <h1 className="text-2xl font-extrabold text-white">
          Audited Break-Glass & Transcript Access
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          In compliance with Ghana Act 843, administrators do not have access to identifiable patient records by default. Any emergency access requires a stated clinical justification, duration, and permanent audit entry.
        </p>
      </div>

      {/* Break Glass Form Card */}
      <Card className="border-red-600/60 bg-slate-950/70 shadow-md">
        <CardHeader className="pb-3 border-b border-slate-800">
          <CardTitle className="text-base font-bold text-white flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-red-500" />
            Request Emergency Break-Glass Access
          </CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Authorized roles: Clinical Reviewers, Support Admins, System Admins, Auditors
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {errorMsg && (
            <div className="mb-4 rounded-lg bg-red-950/60 border border-red-500 p-3 text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleBreakGlass} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Resource Type</label>
                <select
                  value={resourceType}
                  onChange={(e: any) => setResourceType(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                >
                  <option value="Assessment">Assessment Record</option>
                  <option value="AssessmentSession">Assessment Conversation Session</option>
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-slate-300">
                  Target Resource ID (ObjectId)
                </label>
                <Input
                  type="text"
                  placeholder="e.g. 660f882a..."
                  value={resourceId}
                  onChange={(e) => setResourceId(e.target.value)}
                  required
                  className="bg-slate-900 border-slate-700 text-white text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex justify-between">
                <span>Clinical / Regulatory Justification</span>
                <span className="text-[11px] text-slate-500 font-normal">Min. 15 characters</span>
              </label>
              <textarea
                rows={3}
                placeholder="Explicitly state the safety incident reference or regulatory necessity for reviewing this identifiable transcript..."
                value={justificationReason}
                onChange={(e) => setJustificationReason(e.target.value)}
                required
                className="w-full rounded-md border border-slate-700 bg-slate-900 p-2.5 text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Duration (Minutes)</label>
                <select
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                >
                  <option value={15}>15 Minutes</option>
                  <option value={30}>30 Minutes</option>
                  <option value={60}>60 Minutes</option>
                  <option value={120}>120 Minutes (Max)</option>
                </select>
              </div>

              <div className="flex justify-end sm:pt-4">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Auditing Access...
                    </>
                  ) : (
                    <>
                      <Unlock className="mr-1.5 h-3.5 w-3.5" />
                      Authorize & Break Glass
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Unlocked Record View */}
      {unlockedResult && (
        <Card className="border-teal-500 bg-slate-950 p-6 space-y-4 shadow-xl animate-in zoom-in-95 duration-200">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Badge className="bg-teal-600 text-white text-[10px] uppercase font-bold">
                AUDITED ACCESS ACTIVE
              </Badge>
              <span className="text-xs text-slate-300 font-mono">
                Expires: {new Date(unlockedResult.accessGrant.expiresAt).toLocaleTimeString()}
              </span>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setUnlockedResult(null)} className="text-xs text-slate-400">
              Close Record
            </Button>
          </div>

          <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-600/40 text-xs text-amber-200">
            <strong>Audit Warning:</strong> Viewing identifiable patient record{" "}
            <span className="font-mono">{unlockedResult.accessGrant.resourceId}</span>. All actions are logged under audit action <code>break_glass_access_granted</code>.
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Decrypted Record Data
            </h4>
            <pre className="max-h-96 overflow-auto rounded-lg bg-slate-900 p-4 text-[11px] font-mono text-teal-300">
              {JSON.stringify(unlockedResult.unlockedRecord, null, 2)}
            </pre>
          </div>
        </Card>
      )}
    </div>
  );
}
