"use client";

import Link from "next/link";
import { ShieldCheck, AlertTriangle } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950 text-slate-600 dark:text-slate-400">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Medical Safety Disclaimer Callout */}
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-300">
                Important Medical Safety Disclaimer:
              </p>
              <p className="mt-1 leading-relaxed">
                Clinix is an AI-assisted triage and care navigation tool. It provides structured symptom
                explanations and urgency evaluations, but does not provide a definitive medical diagnosis,
                issue prescriptions, or replace professional evaluation by a qualified physician. In case of
                an emergency or acute distress, call <strong>112</strong> or visit the nearest emergency facility immediately.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <span>
              Compliant with Ghana Data Protection Act, 2012 (Act 843) & WHO AI for Health Principles.
            </span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/about" className="hover:text-teal-600 dark:hover:text-teal-400">
              Safety Guidelines
            </Link>
            <Link href="/privacy" className="hover:text-teal-600 dark:hover:text-teal-400">
              Privacy Notice & Data Retention
            </Link>
            <Link href="/emergency" className="hover:text-red-600 dark:hover:text-red-400 font-semibold">
              Emergency Procedures (112)
            </Link>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
          © 2026 Clinix Health Assistant. Built for patient safety, clinical governance, and emergency response.
        </div>
      </div>
    </footer>
  );
}
