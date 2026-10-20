import Link from "next/link";
import { ShieldAlert, HeartPulse, Stethoscope, AlertTriangle, FileText, CheckCircle2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="border-b border-slate-200 pb-8 dark:border-slate-800">
        <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-300">
          <Stethoscope className="h-4 w-4" />
          <span>Clinical Safety Architecture</span>
        </div>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          About Clinix & Medical Safety Principles
        </h1>
        <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
          How our architecture ensures medical safety, algorithmic accountability, and clinical oversight.
        </p>
      </div>

      {/* Primary Mandate */}
      <div className="mt-8 rounded-xl border border-teal-200 bg-teal-50/50 p-6 dark:border-teal-900/60 dark:bg-teal-950/20">
        <h2 className="text-lg font-bold text-teal-950 dark:text-teal-200 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-teal-600" />
          Primary Objective & Medical Stance
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-teal-900 dark:text-teal-300">
          Clinix is designed to help patients understand symptom patterns, evaluate situational urgency,
          and connect with healthcare facilities. <strong>Clinix is not a diagnostic device and does not produce definitive diagnoses or autonomous prescriptions.</strong>
        </p>
      </div>

      {/* Safety Invariants */}
      <div className="mt-10">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
          Non-Negotiable Safety Invariants
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-red-600" />
              Emergency Floor Invariant
            </h3>
            <p className="mt-1 text-slate-600 dark:text-slate-400">
              An AI output can never downgrade an emergency urgency floor determined by deterministic
              safety rules.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Safe Failure Invariant
            </h3>
            <p className="mt-1 text-slate-600 dark:text-slate-400">
              A failed, malformed, or timed-out AI call never defaults to a reassuring message such as "you
              are fine".
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-teal-600" />
              Emergency Reachability Invariant
            </h3>
            <p className="mt-1 text-slate-600 dark:text-slate-400">
              The emergency calling action (112) is reachable even if the database, maps service, or AI
              infrastructure is completely down.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              Tri-State Clinical Accuracy
            </h3>
            <p className="mt-1 text-slate-600 dark:text-slate-400">
              Every clinical field is tri-state (yes / no / unknown). An unanswered question is never
              treated as a negative answer.
            </p>
          </div>
        </div>
      </div>

      {/* Emergency Notice */}
      <div className="mt-12 rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-950 dark:bg-red-950/40">
        <h3 className="text-base font-bold text-red-900 dark:text-red-200">
          Immediate Emergency Services in Ghana
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-red-800 dark:text-red-300">
          For any acute chest pain, severe bleeding, difficulty breathing, loss of consciousness, or
          suspected stroke, do not use online tools. Call the Ghana National Ambulance Service at{" "}
          <strong>112</strong> immediately.
        </p>
        <div className="mt-4">
          <a
            href="tel:112"
            className="inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-red-700"
          >
            Call 112 Now
          </a>
        </div>
      </div>
    </div>
  );
}
