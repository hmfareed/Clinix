import { PhoneCall, ShieldAlert, AlertTriangle, HeartPulse, CheckCircle2 } from "lucide-react";
import { EmergencyDialer } from "@/components/emergency/emergency-dialer";

export const metadata = {
  title: "Emergency Services (112) — Clinix",
  description: "Immediate emergency healthcare contact and critical symptom escalation.",
};

export default function EmergencyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Country-Aware Emergency Dialer Banner */}
      <EmergencyDialer />

      {/* When to call emergency */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
          Immediate Warning Signs Requiring Emergency Evaluation
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="rounded-xl border border-red-100 bg-white p-5 shadow-sm dark:border-red-950/60 dark:bg-slate-900">
            <h3 className="font-bold text-red-600 dark:text-red-400 flex items-center gap-2 text-base">
              <ShieldAlert className="h-5 w-5" /> Severe Breathing Distress
            </h3>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Inability to complete full sentences without gasping, blue lips/face, severe stridor, or
              sudden choking.
            </p>
          </div>

          <div className="rounded-xl border border-red-100 bg-white p-5 shadow-sm dark:border-red-950/60 dark:bg-slate-900">
            <h3 className="font-bold text-red-600 dark:text-red-400 flex items-center gap-2 text-base">
              <HeartPulse className="h-5 w-5" /> Acute Chest Pain / Pressure
            </h3>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Heavy crushing or squeezing pain in center of chest radiating to left arm, neck, jaw, or
              back, especially accompanied by sweating.
            </p>
          </div>

          <div className="rounded-xl border border-red-100 bg-white p-5 shadow-sm dark:border-red-950/60 dark:bg-slate-900">
            <h3 className="font-bold text-red-600 dark:text-red-400 flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5" /> Suspected Stroke (FAST)
            </h3>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Sudden facial drooping, arm weakness or numbness on one side, slurred speech, or sudden loss
              of balance.
            </p>
          </div>

          <div className="rounded-xl border border-red-100 bg-white p-5 shadow-sm dark:border-red-950/60 dark:bg-slate-900">
            <h3 className="font-bold text-red-600 dark:text-red-400 flex items-center gap-2 text-base">
              <CheckCircle2 className="h-5 w-5" /> Altered Consciousness or Seizures
            </h3>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Unresponsiveness, confusion, prolonged seizure, sudden inability to wake someone, or severe
              head injury.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
