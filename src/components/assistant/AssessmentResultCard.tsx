"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  Pill,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Info,
  ListChecks,
  Stethoscope,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Condition {
  name: string;
  explanation: string;
  supportingSymptoms?: string[];
  missingInformation?: string[];
}

interface OTCDrug {
  name: string;
  purpose: string;
  warning: string;
}

interface AssessmentResultCardProps {
  summary: string;
  urgency: "emergency" | "urgent" | "routine" | "self_care_eligible" | "insufficient_information";
  possibleConditions?: Condition[];
  recommendedNextSteps?: string[];
  suggestedOTCDrugs?: OTCDrug[];
  limitations?: string[];
  /** Pre-fetched nearby clinic names (from the actions array) */
  nearbyClinicLinks?: Array<{ label: string; href: string }>;
}

const URGENCY_CONFIG = {
  emergency: {
    icon: ShieldAlert,
    label: "Emergency",
    badge: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200 border-red-300",
    border: "border-red-500",
    header: "bg-red-50 dark:bg-red-950/40",
    iconColor: "text-red-600 dark:text-red-400",
  },
  urgent: {
    icon: AlertTriangle,
    label: "Urgent — See a Doctor Soon",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border-amber-300",
    border: "border-amber-400",
    header: "bg-amber-50 dark:bg-amber-950/30",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  routine: {
    icon: Clock,
    label: "Routine — Professional Review Recommended",
    badge: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200 border-teal-300",
    border: "border-teal-400",
    header: "bg-teal-50 dark:bg-teal-950/30",
    iconColor: "text-teal-600 dark:text-teal-400",
  },
  self_care_eligible: {
    icon: CheckCircle2,
    label: "Self-Care Eligible (Monitor Symptoms)",
    badge: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200 border-green-300",
    border: "border-green-400",
    header: "bg-green-50 dark:bg-green-950/30",
    iconColor: "text-green-600 dark:text-green-400",
  },
  insufficient_information: {
    icon: Info,
    label: "More Information Needed",
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300",
    border: "border-slate-300",
    header: "bg-slate-50 dark:bg-slate-900",
    iconColor: "text-slate-500",
  },
};

export function AssessmentResultCard({
  summary,
  urgency,
  possibleConditions = [],
  recommendedNextSteps = [],
  suggestedOTCDrugs = [],
  limitations = [],
  nearbyClinicLinks = [],
}: AssessmentResultCardProps) {
  const [expandedCondition, setExpandedCondition] = React.useState<number | null>(0);
  const config = URGENCY_CONFIG[urgency] ?? URGENCY_CONFIG.routine;
  const UrgencyIcon = config.icon;

  return (
    <div className={`rounded-2xl border-2 ${config.border} bg-white dark:bg-slate-900 shadow-sm overflow-hidden`}>
      {/* ── Header: Urgency Level ─────────────────────────────── */}
      <div className={`px-4 py-3 ${config.header} flex items-center gap-2.5`}>
        <UrgencyIcon className={`h-5 w-5 shrink-0 ${config.iconColor}`} />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Assessment Result
          </p>
          <Badge className={`text-xs font-semibold border ${config.badge} mt-0.5`}>
            {config.label}
          </Badge>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* ── Summary ───────────────────────────────────────────── */}
        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1">
            <Stethoscope className="h-4 w-4 text-teal-600" />
            Clinical Summary
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{summary}</p>
        </div>

        {/* ── Possible Conditions ───────────────────────────────── */}
        {possibleConditions.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-2">
              <Info className="h-4 w-4 text-blue-500" />
              Possible Conditions to Discuss with Your Doctor
            </p>
            <div className="space-y-2">
              {possibleConditions.map((cond, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedCondition(expandedCondition === idx ? null : idx)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-left bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    aria-expanded={expandedCondition === idx}
                  >
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {cond.name}
                    </span>
                    {expandedCondition === idx ? (
                      <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                    )}
                  </button>
                  {expandedCondition === idx && (
                    <div className="px-3 py-2.5 text-xs text-slate-600 dark:text-slate-400 space-y-2 bg-white dark:bg-slate-900">
                      <p>{cond.explanation}</p>
                      {cond.supportingSymptoms && cond.supportingSymptoms.length > 0 && (
                        <p className="text-slate-500">
                          <span className="font-medium text-slate-700 dark:text-slate-300">Supporting signs: </span>
                          {cond.supportingSymptoms.join(", ")}
                        </p>
                      )}
                      {cond.missingInformation && cond.missingInformation.length > 0 && (
                        <p className="text-slate-500">
                          <span className="font-medium text-slate-700 dark:text-slate-300">Further info needed: </span>
                          {cond.missingInformation.join(", ")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 italic">
              These are possible explanations, not a confirmed diagnosis.
            </p>
          </div>
        )}

        {/* ── Recommended Next Steps ────────────────────────────── */}
        {recommendedNextSteps.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-2">
              <ListChecks className="h-4 w-4 text-teal-600" />
              Recommended Next Steps
            </p>
            <ol className="space-y-1.5 list-none">
              {recommendedNextSteps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 text-xs font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* ── OTC Drug Suggestions ──────────────────────────────── */}
        {suggestedOTCDrugs.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-2">
              <Pill className="h-4 w-4 text-purple-500" />
              Over-the-Counter Relief Options
            </p>
            <div className="space-y-2">
              {suggestedOTCDrugs.map((drug, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-purple-100 dark:border-purple-900/40 bg-purple-50 dark:bg-purple-950/20 p-3"
                >
                  <p className="text-sm font-semibold text-purple-800 dark:text-purple-300">{drug.name}</p>
                  <p className="text-xs text-purple-700 dark:text-purple-400 mt-0.5">{drug.purpose}</p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                    {drug.warning}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5 italic">
              Always consult a registered pharmacist or physician before taking any medicine.
            </p>
          </div>
        )}

        {/* ── Nearby Clinic Links ───────────────────────────────── */}
        {nearbyClinicLinks.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-2">
              <MapPin className="h-4 w-4 text-teal-600" />
              Nearby Verified Clinics
            </p>
            <div className="flex flex-col gap-1.5">
              {nearbyClinicLinks.map((clinic, idx) => (
                <Link
                  key={idx}
                  href={clinic.href}
                  className="text-sm text-teal-700 dark:text-teal-300 underline underline-offset-2 hover:text-teal-900 dark:hover:text-teal-100 transition"
                >
                  {clinic.label}
                </Link>
              ))}
              <Link
                href="/clinics"
                className="text-xs text-slate-500 hover:text-teal-600 transition mt-1"
              >
                View all clinics →
              </Link>
            </div>
          </div>
        )}

        {/* ── Limitations / Disclaimer ──────────────────────────── */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
            ⚕️ <strong>Disclaimer:</strong> This assessment is informational guidance only and does not constitute a medical diagnosis. Always consult a qualified healthcare professional for personal medical advice.
            {limitations.length > 1 && ` ${limitations[1]}`}
          </p>
        </div>
      </div>
    </div>
  );
}
