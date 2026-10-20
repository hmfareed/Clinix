"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  PhoneCall,
  HeartPulse,
  Activity,
  ArrowRight,
  MapPin,
  Clock,
  Sparkles,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConsentModal } from "@/components/consent/consent-modal";

export default function HomePage() {
  const router = useRouter();
  const [showConsent, setShowConsent] = React.useState(false);
  const [loadingGuest, setLoadingGuest] = React.useState(false);

  async function handleStartGuestTriage() {
    setShowConsent(true);
  }

  async function onConsentComplete(granted: boolean) {
    setShowConsent(false);
    if (!granted) return;

    setLoadingGuest(true);
    try {
      const res = await fetch("/api/auth/guest", { method: "POST" });
      if (res.ok) {
        router.push("/symptom-checker");
      } else {
        alert("Could not initialize guest session. Please try again.");
      }
    } catch (e) {
      console.error(e);
      alert("Error starting guest triage.");
    } finally {
      setLoadingGuest(false);
    }
  }

  return (
    <div className="flex flex-col">
      {/* Consent Modal */}
      <ConsentModal
        isOpen={showConsent}
        onConsentComplete={onConsentComplete}
        isGuest={true}
      />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-teal-50/60 via-white to-slate-50 py-16 sm:py-24 dark:from-slate-900 dark:via-slate-950 dark:to-slate-950">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-100/60 px-3 py-1 text-xs font-semibold text-teal-800 dark:border-teal-900/60 dark:bg-teal-950/60 dark:text-teal-300">
              <ShieldCheck className="h-4 w-4" />
              <span>Safety-First Clinical Triage & Care Guidance</span>
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl dark:text-white">
              Understand Your Symptoms.{" "}
              <span className="text-teal-600 dark:text-teal-400">Reach the Right Care.</span>
            </h1>

            <p className="mt-6 text-base sm:text-lg leading-relaxed text-slate-600 dark:text-slate-300">
              Clinix helps you assess the urgency of your health concerns, ask guided clinical questions,
              and find nearby medical services — governed by doctor-reviewed safety rules and independent
              emergency escalation.
            </p>

            {/* Emergency Alert Callout */}
            <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-left dark:border-red-950 dark:bg-red-950/40">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <PhoneCall className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-red-900 dark:text-red-200">
                      Experiencing a severe or life-threatening condition?
                    </h4>
                    <p className="text-xs text-red-800 dark:text-red-300">
                      Do not wait for an AI assessment. Call Ghana National Ambulance Services immediately.
                    </p>
                  </div>
                </div>
                <a
                  href="tel:112"
                  className="inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-red-700 shrink-0"
                >
                  Dial 112 Now
                </a>
              </div>
            </div>

            {/* CTAs */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                variant="default"
                size="lg"
                onClick={handleStartGuestTriage}
                disabled={loadingGuest}
                className="w-full sm:w-auto flex items-center gap-2 text-base font-semibold shadow-md"
              >
                <span>{loadingGuest ? "Starting..." : "Start Fast Guest Triage"}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>

              <Link href="/register" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="w-full text-base">
                  Create Patient Account
                </Button>
              </Link>
            </div>

            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              No account required for immediate triage. 24-hour privacy retention for guests.
            </p>
          </div>
        </div>
      </section>

      {/* 4 Pillars of Clinix Safety */}
      <section className="py-16 bg-white dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Engineered with Clinical Guardrails
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              How Clinix prioritizes safety over conversational speculation.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-teal-100 dark:border-slate-800">
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400 mb-2">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <CardTitle className="text-base">Independent Safety Engine</CardTitle>
                <CardDescription className="text-xs">
                  Emergency rules run before and after any AI generation. The strictest urgency category
                  always wins.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-teal-100 dark:border-slate-800">
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400 mb-2">
                  <Activity className="h-5 w-5" />
                </div>
                <CardTitle className="text-base">No Fabricated Certainty</CardTitle>
                <CardDescription className="text-xs">
                  We never manufacture disease percentages or definitive diagnoses. Missing clinical fields
                  remain unknown.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-teal-100 dark:border-slate-800">
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400 mb-2">
                  <MapPin className="h-5 w-5" />
                </div>
                <CardTitle className="text-base">Verified Care Navigation</CardTitle>
                <CardDescription className="text-xs">
                  Direct links and telephone contacts to nearby clinics, hospitals, and pharmacies from
                  curated sources.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-teal-100 dark:border-slate-800">
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400 mb-2">
                  <Lock className="h-5 w-5" />
                </div>
                <CardTitle className="text-base">Act 843 Privacy Compliance</CardTitle>
                <CardDescription className="text-xs">
                  Full control over your data. Guest sessions expire in 24 hours; registered patients retain
                  full export and deletion rights.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
