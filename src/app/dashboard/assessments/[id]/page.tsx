"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Clock,
  Printer,
  Trash2,
  Bell,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Info,
  Loader2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const URGENCY_COLORS: Record<string, string> = {
  emergency: "bg-red-600 text-white",
  urgent: "bg-amber-600 text-white",
  routine: "bg-blue-600 text-white",
  self_care_eligible: "bg-teal-600 text-white",
  insufficient_information: "bg-slate-600 text-white",
};

function AssessmentDetailInner({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);
  const router = useRouter();

  const [assessment, setAssessment] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    fetch(`/api/assessments/${id}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          setErrorMsg(json.error?.message || "Assessment not found or inaccessible.");
        } else {
          setAssessment(json.data);
        }
      })
      .catch(() => setErrorMsg("Network error loading assessment."))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to permanently delete this assessment record?")) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/assessments/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/dashboard/assessments");
      } else {
        alert("Failed to delete assessment.");
      }
    } catch {
      alert("Network error.");
    } finally {
      setDeleting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (errorMsg || !assessment) {
    return (
      <Card className="p-8 text-center border-slate-200">
        <AlertTriangle className="h-10 w-10 text-red-600 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900 mt-3 dark:text-white">Record Inaccessible</h2>
        <p className="text-sm text-slate-600 mt-1">{errorMsg || "Assessment record could not be loaded."}</p>
        <div className="mt-6">
          <Link href="/dashboard/assessments">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Assessments
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      {/* Back and Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href="/dashboard/assessments"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-teal-600 dark:text-slate-400 dark:hover:text-teal-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Assessments
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} className="text-xs">
            <Printer className="mr-1.5 h-3.5 w-3.5" />
            Print Summary
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            {deleting ? "Deleting..." : "Delete Record"}
          </Button>
        </div>
      </div>

      {/* Prominent Disclaimer Banner */}
      <div className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4 shadow-sm dark:border-amber-700 dark:bg-amber-950/40">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-amber-950 dark:text-amber-100">
              AI-GENERATED AND CLINICALLY UNVERIFIED RECORD
            </h3>
            <p className="text-xs text-amber-800 dark:text-amber-300">
              {assessment.disclaimerNotice}
            </p>
          </div>
        </div>
      </div>

      {/* Header Card */}
      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader className="border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge className={`${URGENCY_COLORS[assessment.urgency] || "bg-slate-600 text-white"} text-xs uppercase font-bold tracking-wider`}>
                  Urgency: {assessment.urgency.replace(/_/g, " ")}
                </Badge>
                <Badge variant="outline" className="text-[10px] text-amber-800 border-amber-300">
                  Unverified
                </Badge>
              </div>
              <CardTitle className="text-xl font-bold text-slate-900 dark:text-white pt-1">
                Triage Assessment Summary
              </CardTitle>
            </div>
            <div className="text-right text-xs text-slate-500">
              <p className="flex items-center gap-1 justify-end">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(assessment.createdAt).toLocaleDateString()}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Rule Set: {assessment.triage?.ruleSetVersion || "v1"}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-5">
          {/* Summary Box */}
          <div className="rounded-lg bg-slate-50 p-4 border border-slate-200 dark:bg-slate-900 dark:border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Assessment Summary
            </h4>
            <p className="text-sm text-slate-900 dark:text-white font-medium leading-relaxed">
              {assessment.summary}
            </p>
          </div>

          {/* Reported Symptoms */}
          {assessment.symptoms?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Patient-Reported Symptoms
              </h4>
              <ul className="list-disc pl-5 space-y-1 text-xs text-slate-700 dark:text-slate-300">
                {assessment.symptoms.map((s: any, idx: number) => (
                  <li key={idx}>
                    <span className="font-semibold">{s.description}</span>
                    {s.onset && <span> (Onset: {s.onset})</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Possible Conditions */}
          {assessment.possibleConditions?.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Possible Conditions Considered (Not Confirmed Diagnoses)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {assessment.possibleConditions.map((cond: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-lg border border-slate-200 bg-white text-xs dark:border-slate-800 dark:bg-slate-900 space-y-1.5"
                  >
                    <p className="font-bold text-slate-900 dark:text-white text-sm">{cond.name}</p>
                    <p className="text-slate-600 dark:text-slate-400">{cond.explanation}</p>
                    {cond.supportingSymptoms?.length > 0 && (
                      <p className="text-[11px] text-slate-500">
                        <strong>Supporting:</strong> {cond.supportingSymptoms.join(", ")}
                      </p>
                    )}
                    {cond.missingInformation?.length > 0 && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-400">
                        <strong>Missing Info:</strong> {cond.missingInformation.join(", ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Next Steps */}
          {assessment.recommendations?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Recommended Clinical Next Steps
              </h4>
              <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-800 dark:text-slate-200">
                {assessment.recommendations.map((step: string, idx: number) => (
                  <li key={idx} className="font-medium">{step}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Medication Guidance */}
          {assessment.medicationGuidance && (
            <div className="space-y-2 rounded-lg bg-teal-50/40 border border-teal-200 p-4 dark:bg-teal-950/20 dark:border-teal-900">
              <h4 className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
                <Info className="h-4 w-4" />
                Medication Guidance & Precautions
              </h4>
              <p className="text-xs text-slate-700 dark:text-slate-300">
                {assessment.medicationGuidance.explanation}
              </p>
              {assessment.medicationGuidance.requiresProfessionalReview && (
                <p className="text-[11px] font-semibold text-teal-800 dark:text-teal-300">
                  Note: A licensed pharmacist or doctor must confirm medication suitability before initiation.
                </p>
              )}
            </div>
          )}

          {/* Limitations */}
          {assessment.limitations?.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
              <h4 className="font-bold uppercase tracking-wider text-slate-400">
                Algorithmic Limitations
              </h4>
              <ul className="list-disc pl-5 space-y-1">
                {assessment.limitations.map((lim: string, idx: number) => (
                  <li key={idx}>{lim}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>

        <CardFooter className="border-t border-slate-100 bg-slate-50/50 p-4 flex flex-wrap justify-between items-center gap-3 dark:border-slate-800 dark:bg-slate-900/50 print:hidden">
          <Link href="/clinics">
            <Button variant="outline" size="sm" className="text-xs text-teal-700 border-teal-300 hover:bg-teal-50">
              <MapPin className="mr-1.5 h-3.5 w-3.5" />
              Find Recommended Facilities
            </Button>
          </Link>
          <Link href="/dashboard/reminders">
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white text-xs">
              <Bell className="mr-1.5 h-3.5 w-3.5" />
              Set Follow-Up Reminder
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function AssessmentDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <React.Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      }
    >
      <AssessmentDetailInner {...props} />
    </React.Suspense>
  );
}
