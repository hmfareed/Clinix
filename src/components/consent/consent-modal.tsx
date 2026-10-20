"use client";

import * as React from "react";
import { ShieldCheck, AlertCircle, Sparkles, Clock, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConsentModalProps {
  isOpen: boolean;
  onConsentComplete: (granted: boolean) => void;
  isGuest?: boolean;
}

export function ConsentModal({ isOpen, onConsentComplete, isGuest = true }: ConsentModalProps) {
  const [submitting, setSubmitting] = React.useState(false);
  const [agreedAi, setAgreedAi] = React.useState(true);
  const [agreedRetention, setAgreedRetention] = React.useState(true);

  if (!isOpen) return null;

  async function handleAccept() {
    setSubmitting(true);
    try {
      // Record consent on server
      await fetch("/api/consents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "privacy",
          policyVersion: "1.0",
          status: "granted",
        }),
      });

      if (agreedAi) {
        await fetch("/api/consents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "ai_processing",
            policyVersion: "1.0",
            status: "granted",
          }),
        });
      }

      if (agreedRetention) {
        await fetch("/api/consents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "data_retention",
            policyVersion: "1.0",
            status: "granted",
          }),
        });
      }

      onConsentComplete(true);
    } catch (e) {
      console.error("Failed to record consent:", e);
      onConsentComplete(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-400">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Patient Consent & Privacy Notice
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Please review before beginning your symptom assessment
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-4 max-h-[60vh] overflow-y-auto pr-1 text-xs text-slate-600 dark:text-slate-300">
          {/* Key point 1: AI Processing */}
          <div className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
            <Sparkles className="h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">External AI Processing</p>
              <p className="mt-0.5 leading-relaxed">
                Your symptom description is processed by an external, secure AI language model (NVIDIA
                NIM) to assist in understanding your symptoms. Only anonymous clinical text and age bands
                are transmitted. Your personal identity, email, and exact coordinates are never shared with
                the AI service.
              </p>
            </div>
          </div>

          {/* Key point 2: Retention */}
          <div className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
            <Clock className="h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">
                {isGuest ? "Guest Data Retention (24 Hours)" : "Patient Account Data Retention"}
              </p>
              <p className="mt-0.5 leading-relaxed">
                {isGuest
                  ? "As a guest, your temporary assessment session is stored with a 24-hour expiration token and is automatically deleted thereafter."
                  : "As a registered patient, your assessments are retained in your secure private history until you choose to export or delete your account."}
              </p>
            </div>
          </div>

          {/* Key point 3: Clinical Nature */}
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-200">
                Non-Diagnostic Clinical Disclaimer
              </p>
              <p className="mt-0.5 leading-relaxed text-amber-800 dark:text-amber-300">
                Clinix does not generate definitive medical diagnoses or prescribe medications. If at any
                moment you experience severe pain, chest tightness, severe breathing trouble, or sudden
                weakness, immediately stop and dial <strong>112</strong>.
              </p>
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-2 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedAi}
                onChange={(e) => setAgreedAi(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-xs text-slate-700 dark:text-slate-300">
                I consent to the processing of my symptom description by secure AI services for triage.
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedRetention}
                onChange={(e) => setAgreedRetention(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-xs text-slate-700 dark:text-slate-300">
                I agree to the data retention terms under the Ghana Data Protection Act (Act 843).
              </span>
            </label>
          </div>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onConsentComplete(false)}
            disabled={submitting}
          >
            Decline & Exit
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleAccept}
            disabled={submitting || !agreedAi || !agreedRetention}
            className="w-full sm:w-auto"
          >
            {submitting ? "Recording..." : "I Understand & Consent"}
          </Button>
        </div>
      </div>
    </div>
  );
}
