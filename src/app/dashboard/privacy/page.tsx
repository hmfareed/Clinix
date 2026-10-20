"use client";

import * as React from "react";
import { signOut } from "next-auth/react";
import {
  ShieldCheck,
  ShieldAlert,
  Download,
  Trash2,
  CheckCircle2,
  XCircle,
  FileText,
  AlertTriangle,
  Loader2,
  Lock,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const CONSENT_DESCRIPTIONS: Record<string, { label: string; desc: string }> = {
  privacy: {
    label: "Privacy Notice & Data Processing",
    desc: "Governs general processing of your personal data under the Ghana Data Protection Act, 2012 (Act 843).",
  },
  ai_processing: {
    label: "External AI Health Inference",
    desc: "Permits sending sanitized symptom descriptions to NVIDIA inference models for triage generation.",
  },
  data_retention: {
    label: "Assessment & Health Profile Storage",
    desc: "Allows Clinix to store past triage assessments and your optional health profile for future reference.",
  },
  location: {
    label: "Location Access for Healthcare Directory",
    desc: "Authorizes browser geolocation to compute distances to nearby Ghanaian hospitals and clinics.",
  },
  trusted_contact: {
    label: "Emergency Trusted Contact Access",
    desc: "Enables viewing and using your designated contact during emergency escalation.",
  },
};

export default function PrivacyAndConsentsPage() {
  const [consents, setConsents] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [exporting, setExporting] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);

  const fetchConsents = React.useCallback(async () => {
    try {
      const res = await fetch("/api/consents");
      const json = await res.json();
      if (json.consents) {
        setConsents(json.consents);
      }
    } catch (err) {
      console.error("Error loading consents:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchConsents();
  }, [fetchConsents]);

  const handleToggleConsent = async (type: string, currentStatus: string) => {
    const newStatus = currentStatus === "granted" ? "withdrawn" : "granted";
    try {
      const res = await fetch("/api/consents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          policyVersion: "1.0",
          status: newStatus,
        }),
      });
      if (res.ok) {
        fetchConsents();
      }
    } catch (err) {
      console.error("Error toggling consent:", err);
    }
  };

  const handleDownloadExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/privacy/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clinix-patient-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      alert("Failed to download data export. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/privacy/delete-account", {
        method: "POST",
      });
      if (res.ok) {
        alert("Your account and all associated health data have been permanently purged.");
        signOut({ callbackUrl: "/" });
      } else {
        alert("Failed to process account deletion.");
        setDeleting(false);
      }
    } catch {
      alert("Network error during deletion.");
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl animate-in fade-in-50 duration-200">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
          Privacy, Consent & Data Rights
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          In strict compliance with Ghana Data Protection Act, 2012 (Act 843), you control every consent, data export, and deletion right.
        </p>
      </div>

      {/* Granular Consents Section */}
      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader className="border-b border-slate-100 pb-3 dark:border-slate-800">
          <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Lock className="h-4 w-4 text-teal-600" />
            Granular Processing Consents
          </CardTitle>
          <CardDescription className="text-xs">
            Review and adjust permission granted for specific processing activities. Withdrawing consent stops future processing immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y divide-slate-100 p-0 dark:divide-slate-800">
          {loading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
            </div>
          ) : (
            Object.entries(CONSENT_DESCRIPTIONS).map(([typeKey, info]) => {
              const record = consents.find((c) => c.type === typeKey);
              const isGranted = record?.status === "granted";
              return (
                <div
                  key={typeKey}
                  className="p-4 flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="space-y-1 max-w-lg">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {info.label}
                      </p>
                      <Badge
                        variant="outline"
                        className={`text-[10px] capitalize ${
                          isGranted
                            ? "border-teal-300 text-teal-700 bg-teal-50 dark:bg-teal-950/40 dark:text-teal-300"
                            : "border-slate-300 text-slate-500"
                        }`}
                      >
                        {isGranted ? "Granted" : "Withdrawn"}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {info.desc}
                    </p>
                    {record && (
                      <p className="text-[10px] text-slate-400">
                        Version {record.policyVersion} • Last updated:{" "}
                        {new Date(record.grantedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant={isGranted ? "outline" : "default"}
                    onClick={() => handleToggleConsent(typeKey, isGranted ? "granted" : "withdrawn")}
                    className={`text-xs ${
                      !isGranted ? "bg-teal-600 text-white hover:bg-teal-700" : ""
                    }`}
                  >
                    {isGranted ? "Withdraw Consent" : "Grant Consent"}
                  </Button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Data Export Section */}
      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader>
          <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Download className="h-4 w-4 text-teal-600" />
            Personal Data Portability & Export
          </CardTitle>
          <CardDescription className="text-xs">
            Download an authenticated JSON package containing your account profile, health profile, assessment records, reminders, and timestamped consent logs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleDownloadExport}
            disabled={exporting}
            className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs"
          >
            {exporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Preparing Export...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Download Personal Data Package (JSON)
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Account Deletion Section */}
      <Card className="border-red-200 bg-red-50/20 shadow-sm dark:border-red-900/50 dark:bg-red-950/10">
        <CardHeader>
          <CardTitle className="text-base font-bold text-red-900 dark:text-red-200 flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-red-600" />
            Delete Account & Permanent Health Record Purge
          </CardTitle>
          <CardDescription className="text-xs text-red-800/80 dark:text-red-300/80">
            Permanently purges your clinical profile, all past assessments, triage histories, and reminders in compliance with Act 843 data retention principles.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-red-700 dark:text-red-300">
            This action cannot be undone. Once deleted, your triage history cannot be recovered.
          </p>
          {!deleteConfirmOpen ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmOpen(true)}
              className="border-red-300 text-red-700 hover:bg-red-50 text-xs"
            >
              Request Account Deletion
            </Button>
          ) : (
            <div className="rounded-lg border border-red-300 bg-white p-4 space-y-3 dark:bg-slate-900">
              <p className="text-xs font-bold text-red-700">
                Are you absolutely sure? All assessments and profile data will be permanently purged immediately.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
                >
                  {deleting ? "Purging Records..." : "Yes, Purge All My Data"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDeleteConfirmOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
