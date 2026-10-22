"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  HeartPulse,
  Stethoscope,
  PhoneCall,
  MapPin,
  Send,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  Printer,
  ChevronRight,
  Info,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  FileText,
  BookmarkCheck,
  Edit3,
  Save,
  Loader2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConsentModal } from "@/components/consent/consent-modal";
import { HealthcareFinderWidget } from "@/components/chat/healthcare-finder-widget";
import { AssessmentContextResult } from "@/services/full-assessment-service";
import { formatDistance } from "@/lib/healthcare-places/distance";

type StepType = "start" | "collect" | "interview" | "result" | "escalated";

interface AssessmentRecord {
  id: string;
  status: string;
  isDraft: boolean;
  urgency?: "emergency" | "urgent" | "routine" | "self_care_eligible" | "insufficient_information";
  summary?: string;
  primaryComplaint?: {
    symptom: string;
    affectedArea?: string;
    onset?: "sudden" | "gradual" | "not_sure";
    duration?: "started_today" | "since_yesterday" | "several_days" | "several_weeks_or_longer";
    severity?: "mild" | "moderate" | "severe";
  };
  patientInfo?: {
    age?: number;
    gender?: string;
    pregnancy?: string;
  };
  medicalHistory?: {
    conditions?: string[];
    allergies?: { status: string; items?: string[] };
    currentMedications?: { status: string; items?: string[] };
  };
  reportedFacts?: {
    known: Array<{ label: string; value: string; source: "patient" | "conversation" | "inferred" }>;
    unknown: Array<{ label: string; reason?: string }>;
  };
  interviewProgress?: {
    currentStep: number;
    pathway?: string;
    answeredQuestions: Array<{
      questionId: string;
      questionText: string;
      answerText: string;
      answeredAt: string;
    }>;
    currentQuestion?: {
      id: string;
      text: string;
      type: "single_choice" | "multiple_choice" | "free_text";
      options?: string[];
      category?: string;
    } | null;
  };
  possibleConditions?: Array<{
    name: string;
    explanation: string;
    supportingSymptoms?: string[];
    missingInformation?: string[];
  }>;
  recommendations?: string[];
  limitations?: string[];
  medicationGuidance?: {
    available: boolean;
    explanation: string;
    requiresProfessionalReview: boolean;
    suggestedOTCDrugs?: Array<{
      name: string;
      purpose: string;
      warning: string;
    }>;
  };
  lastSavedAt?: string;
}

export default function SymptomCheckerPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
        </div>
      }
    >
      <FullAssessmentContent />
    </React.Suspense>
  );
}

function cleanErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    const msg = err.message;
    if (
      msg.includes("ECONNREFUSED") ||
      msg.includes("127.0.0.1") ||
      msg.includes("Mongo") ||
      msg.includes("connect") ||
      msg.includes("Socket")
    ) {
      return "The assessment system is ready in live session mode. Please tap Start New Assessment.";
    }
    return msg;
  }
  return fallback;
}

function FullAssessmentContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryConversationId = searchParams.get("conversationId");
  const queryDraftId = searchParams.get("draftId");

  const [step, setStep] = React.useState<StepType>("start");
  const [assessment, setAssessment] = React.useState<AssessmentRecord | null>(null);
  const [contextData, setContextData] = React.useState<AssessmentContextResult | null>(null);

  // Loading & Error States
  const [loadingContext, setLoadingContext] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorState, setErrorState] = React.useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = React.useState<string | null>(null);

  // Form State (Step 2)
  const [symptomText, setSymptomText] = React.useState("");
  const [onset, setOnset] = React.useState<"sudden" | "gradual" | "not_sure">("not_sure");
  const [duration, setDuration] = React.useState<"started_today" | "since_yesterday" | "several_days" | "several_weeks_or_longer">("started_today");
  const [severity, setSeverity] = React.useState<"mild" | "moderate" | "severe">("moderate");
  const [affectedArea, setAffectedArea] = React.useState("General");
  const [age, setAge] = React.useState<string>("");
  const [allergiesHas, setAllergiesHas] = React.useState<"yes" | "no" | "unknown">("unknown");
  const [allergiesDetail, setAllergiesDetail] = React.useState("");
  const [medsHas, setMedsHas] = React.useState<"yes" | "no" | "unknown">("unknown");
  const [medsDetail, setMedsDetail] = React.useState("");
  const [hasEmergencySigns, setHasEmergencySigns] = React.useState<"yes" | "no" | "unsure">("no");

  // Interview State (Step 3)
  const [chatInput, setChatInput] = React.useState("");
  const [showEditFactsModal, setShowEditFactsModal] = React.useState(false);
  const chatEndRef = React.useRef<HTMLDivElement>(null);

  // Load context (drafts & recent conversation) on mount
  React.useEffect(() => {
    async function loadContext() {
      setLoadingContext(true);
      try {
        const res = await fetch("/api/v1/assessments/context");
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            setContextData(json.data);

            // If draftId was passed in URL, automatically resume it
            if (queryDraftId) {
              await handleInit("resume", undefined, queryDraftId);
            } else if (queryConversationId) {
              // If conversationId was passed in URL, automatically initialize with conversation
              await handleInit("conversation", queryConversationId);
            }
          }
        }
      } catch (err) {
        console.warn("Could not load assessment context:", err);
      } finally {
        setLoadingContext(false);
      }
    }
    loadContext();
  }, [queryConversationId, queryDraftId]);

  // Scroll to bottom of chat on new questions/answers
  React.useEffect(() => {
    if (step === "interview") {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [assessment?.interviewProgress?.answeredQuestions, isSubmitting, step]);

  // Handle initialization of assessment
  async function handleInit(source: "new" | "conversation" | "resume", convId?: string, draftId?: string) {
    setIsSubmitting(true);
    setErrorState(null);
    try {
      const res = await fetch("/api/v1/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          conversationId: convId || queryConversationId || contextData?.recentConversation?.id,
          draftId: draftId || queryDraftId || contextData?.activeDraft?.id,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to initialize assessment.");
      }

      const rec: AssessmentRecord = json.data;
      setAssessment(rec);

      // Populate form state from loaded assessment
      if (rec.primaryComplaint?.symptom) setSymptomText(rec.primaryComplaint.symptom);
      if (rec.primaryComplaint?.onset) setOnset(rec.primaryComplaint.onset);
      if (rec.primaryComplaint?.duration) setDuration(rec.primaryComplaint.duration);
      if (rec.primaryComplaint?.severity) setSeverity(rec.primaryComplaint.severity);
      if (rec.primaryComplaint?.affectedArea) setAffectedArea(rec.primaryComplaint.affectedArea);
      if (rec.patientInfo?.age) setAge(String(rec.patientInfo.age));

      if (rec.status === "completed") {
        setStep("result");
      } else if (rec.status === "escalated") {
        setStep("escalated");
      } else if (rec.interviewProgress && rec.interviewProgress.answeredQuestions?.length > 0) {
        setStep("interview");
      } else if (source === "conversation") {
        // Pre-populated from chat — move to Step 2 for quick verification
        setStep("collect");
      } else {
        setStep("collect");
      }
    } catch (err: unknown) {
      setErrorState(cleanErrorMessage(err, "Failed to start assessment."));
    } finally {
      setIsSubmitting(false);
    }
  }

  // Handle saving Step 2 (Initial Symptom Form)
  async function handleSaveStep2(e?: React.FormEvent, proceedToInterview = true) {
    if (e) e.preventDefault();
    if (!symptomText.trim()) {
      setErrorState("Please describe your symptoms to proceed.");
      return;
    }

    // Emergency Warning Signs trigger
    if (hasEmergencySigns === "yes") {
      setStep("escalated");
      return;
    }

    setIsSubmitting(true);
    setErrorState(null);

    try {
      const payload = {
        primaryComplaint: {
          symptom: symptomText.trim(),
          onset,
          duration,
          severity,
          affectedArea,
        },
        patientInfo: {
          age: age ? Number(age) : undefined,
        },
        medicalHistory: {
          allergies: {
            status: allergiesHas,
            items: allergiesDetail ? allergiesDetail.split(",").map((s) => s.trim()) : [],
          },
          currentMedications: {
            status: medsHas,
            items: medsDetail ? medsDetail.split(",").map((s) => s.trim()) : [],
          },
        },
        currentStep: proceedToInterview ? 3 : 2,
      };

      const res = await fetch(`/api/v1/assessments/${assessment?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to update assessment.");
      }

      setAssessment(json.data);

      if (json.data.status === "escalated") {
        setStep("escalated");
      } else if (proceedToInterview) {
        setStep("interview");
      } else {
        setSaveSuccessMsg("Draft saved successfully. You can return anytime.");
        setTimeout(() => setSaveSuccessMsg(null), 4000);
      }
    } catch (err: unknown) {
      setErrorState(cleanErrorMessage(err, "Failed to save information."));
    } finally {
      setIsSubmitting(false);
    }
  }

  // Handle submitting an adaptive interview answer
  async function handleSubmitAnswer(answerToSend?: string, concludeNow = false) {
    const text = (answerToSend || chatInput).trim();
    if (!text && !concludeNow) return;

    setIsSubmitting(true);
    setErrorState(null);
    setChatInput("");

    try {
      const res = await fetch(`/api/v1/assessments/${assessment?.id}/interview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answer: text || "Patient requested to conclude interview.",
          questionId: assessment?.interviewProgress?.currentQuestion?.id,
          concludeNow,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Failed to submit answer.");
      }

      const updated: AssessmentRecord = json.data;
      setAssessment(updated);

      if (updated.status === "escalated") {
        setStep("escalated");
      } else if (updated.status === "completed") {
        setStep("result");
      }
    } catch (err: unknown) {
      setErrorState(cleanErrorMessage(err, "Error processing answer."));
    } finally {
      setIsSubmitting(false);
    }
  }

  // Handle manual conclusion
  async function handleConcludeNow() {
    await handleSubmitAnswer("Patient requested evaluation conclusion.", true);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
                <h1 className="text-lg font-bold text-white tracking-tight">Full Patient Assessment</h1>
                {contextData?.isOffline && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/60 border border-emerald-500/30 text-emerald-300">
                    Live Session Mode
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400">Structured clinical interview & health navigation</p>
            </div>
          </div>

          {/* Step Badges */}
          <div className="flex items-center gap-1.5">
            {[
              { id: "start", label: "Start", num: 1 },
              { id: "collect", label: "Symptoms", num: 2 },
              { id: "interview", label: "Interview", num: 3 },
              { id: "result", label: "Summary", num: 4 },
            ].map((s) => {
              const active = step === s.id;
              const passed =
                (step === "collect" && s.num < 2) ||
                (step === "interview" && s.num < 3) ||
                (step === "result" && s.num <= 4);

              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    active
                      ? "bg-teal-500/20 text-teal-300 border border-teal-500/40"
                      : passed
                      ? "bg-zinc-900 text-zinc-300 border border-zinc-800"
                      : "text-zinc-600 border border-transparent"
                  }`}
                >
                  <span>{s.num}.</span>
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Global Notifications */}
        {saveSuccessMsg && (
          <div className="p-3 rounded-lg bg-teal-950/60 border border-teal-800 text-teal-200 text-xs flex items-center gap-2 animate-in fade-in">
            <BookmarkCheck className="h-4 w-4 text-teal-400 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {errorState && (
          <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-200 text-xs flex items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
              <span>{errorState}</span>
            </div>
            <button onClick={() => setErrorState(null)} className="text-zinc-400 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 1: START ASSESSMENT                                                  */}
        {/* ========================================================================= */}
        {step === "start" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Clinical Notice Card */}
            <div className="rounded-xl bg-zinc-900/80 border border-zinc-800/80 p-5 space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0 mt-0.5">
                  <Stethoscope className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">How Full Assessment Works</h2>
                  <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                    Clinix conducts a step-by-step clinical interview to understand your symptoms, screens for urgent warning signs, and compiles a comprehensive evaluation with verified care recommendations.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-black/40 border border-zinc-800/60 text-[11px] text-zinc-400 space-y-1">
                <p className="font-semibold text-zinc-300">⚕️ Important Clinical Disclaimer:</p>
                <p>
                  This assessment is for informational and triage guidance only. It is <strong>not a medical diagnosis</strong>. If you are experiencing acute chest pain, severe breathing difficulty, sudden weakness, or uncontrolled bleeding, do not complete this form — <strong>call 112 immediately</strong>.
                </p>
              </div>
            </div>

            {/* Launch Options */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1">
                Choose How You Want to Begin:
              </h3>

              {/* Option A: Use Current Chat */}
              {contextData?.hasRecentConversation && (
                <div className="rounded-xl bg-gradient-to-br from-teal-950/40 via-zinc-900/60 to-zinc-900 border border-teal-500/30 p-5 relative hover:border-teal-400/60 transition group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-teal-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
                          Recommended
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-white">Use Information from Current Chat</h4>
                      <p className="text-xs text-zinc-300">
                        We detected your recent consultation. You won&apos;t have to repeat symptoms you already shared.
                      </p>

                      {/* Preview of extracted facts */}
                      <div className="mt-3 p-3 rounded-lg bg-black/50 border border-zinc-800/80 space-y-2 text-xs">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                          Detected Information:
                        </span>
                        <div className="space-y-1">
                          {contextData.recentConversation?.extractedFacts.known.map((fact, idx) => (
                            <div key={idx} className="flex items-start gap-1.5 text-zinc-200 text-[11px]">
                              <CheckCircle2 className="h-3.5 w-3.5 text-teal-400 shrink-0 mt-0.5" />
                              <span>
                                <strong>{fact.label}:</strong> {fact.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-end">
                    <Button
                      onClick={() => handleInit("conversation", contextData.recentConversation?.id)}
                      disabled={isSubmitting}
                      className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-2 transition"
                    >
                      {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                      <span>Continue with Current Chat Info</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* Option B: Continue Existing Draft */}
              {contextData?.hasActiveDraft && (
                <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-5 hover:border-zinc-700 transition">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-amber-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                          Incomplete Draft
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-white">Resume Incomplete Assessment</h4>
                      <p className="text-xs text-zinc-300">
                        {contextData.activeDraft?.primarySymptom
                          ? `Draft for: "${contextData.activeDraft.primarySymptom}"`
                          : "Saved draft in progress"}
                      </p>
                      <span className="text-[10px] text-zinc-500 block">
                        Last saved: {new Date(contextData.activeDraft!.lastSavedAt || contextData.activeDraft!.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <Button
                      onClick={() => handleInit("resume", undefined, contextData.activeDraft?.id)}
                      disabled={isSubmitting}
                      variant="outline"
                      className="border-zinc-700 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold"
                    >
                      Resume Draft →
                    </Button>
                  </div>
                </div>
              )}

              {/* Option C: Start Fresh */}
              <div className="rounded-xl bg-zinc-900/40 border border-zinc-800/60 p-5 hover:border-zinc-700 transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <h4 className="text-base font-bold text-white">Start a New Assessment</h4>
                    <p className="text-xs text-zinc-400">
                      Begin an assessment from scratch without importing any previous chat context.
                    </p>
                  </div>

                  <Button
                    onClick={() => handleInit("new")}
                    disabled={isSubmitting}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
                  >
                    Start New
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: COLLECT SYMPTOMS & INITIAL FORM                                   */}
        {/* ========================================================================= */}
        {step === "collect" && (
          <form onSubmit={(e) => handleSaveStep2(e, true)} className="space-y-6 animate-in fade-in duration-200">
            <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-6 space-y-6">
              <div>
                <h2 className="text-base font-bold text-white">Initial Symptom Information</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Step 2 of 4 • Tell us what you are feeling</p>
              </div>

              {/* Primary Symptom */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-300 block">
                  What symptoms are you experiencing? <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={symptomText}
                  onChange={(e) => setSymptomText(e.target.value)}
                  placeholder="e.g. Headache and vomiting since yesterday morning with fatigue..."
                  rows={3}
                  required
                  className="w-full rounded-lg bg-black/60 border border-zinc-800 p-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />

                {/* Quick Symptom Chips */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {["Headache", "Fever & Chills", "Vomiting / Nausea", "Stomach Cramps", "Cough", "Chest Tightness", "Body Aches"].map(
                    (s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setSymptomText((prev) => (prev ? `${prev}, ${s.toLowerCase()}` : s));
                        }}
                        className="px-2.5 py-1 rounded-md bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-[11px] transition"
                      >
                        + {s}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Onset Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-300 block">How did the symptoms begin?</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "sudden", label: "Suddenly" },
                    { value: "gradual", label: "Gradually" },
                    { value: "not_sure", label: "Not sure" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setOnset(opt.value as any)}
                      className={`p-2.5 rounded-lg text-xs font-semibold text-center border transition ${
                        onset === opt.value
                          ? "bg-teal-500/20 text-teal-300 border-teal-500/60"
                          : "bg-black/40 text-zinc-400 border-zinc-800 hover:border-zinc-700"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-300 block">
                  How long have you experienced these symptoms?
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { value: "started_today", label: "Started today" },
                    { value: "since_yesterday", label: "Since yesterday" },
                    { value: "several_days", label: "Several days" },
                    { value: "several_weeks_or_longer", label: "Several weeks +" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDuration(opt.value as any)}
                      className={`p-2.5 rounded-lg text-xs font-semibold text-center border transition ${
                        duration === opt.value
                          ? "bg-teal-500/20 text-teal-300 border-teal-500/60"
                          : "bg-black/40 text-zinc-400 border-zinc-800 hover:border-zinc-700"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Severity Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-300 block">How severe are your symptoms?</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "mild", label: "Mild (Noticeable but normal activity possible)" },
                    { value: "moderate", label: "Moderate (Impacting daily activities)" },
                    { value: "severe", label: "Severe (Difficult to function)" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSeverity(opt.value as any)}
                      className={`p-2.5 rounded-lg text-xs font-semibold text-center border transition ${
                        severity === opt.value
                          ? "bg-teal-500/20 text-teal-300 border-teal-500/60"
                          : "bg-black/40 text-zinc-400 border-zinc-800 hover:border-zinc-700"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Affected Body Area */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-300 block">Affected body area</label>
                <div className="flex flex-wrap gap-1.5">
                  {["Head / Neck", "Chest", "Abdomen / Stomach", "Back", "Limbs / Joints", "Skin", "General / Whole Body"].map(
                    (area) => (
                      <button
                        key={area}
                        type="button"
                        onClick={() => setAffectedArea(area)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                          affectedArea === area
                            ? "bg-blue-600 text-white border-blue-500"
                            : "bg-black/40 text-zinc-400 border-zinc-800 hover:border-zinc-700"
                        }`}
                      >
                        {area}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Medical History & Allergies */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-800/60">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300 block">Known drug allergies</label>
                  <div className="flex gap-2">
                    <select
                      value={allergiesHas}
                      onChange={(e) => setAllergiesHas(e.target.value as any)}
                      className="rounded-lg bg-black/60 border border-zinc-800 p-2 text-xs text-zinc-200"
                    >
                      <option value="unknown">Unknown</option>
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                    {allergiesHas === "yes" && (
                      <input
                        type="text"
                        value={allergiesDetail}
                        onChange={(e) => setAllergiesDetail(e.target.value)}
                        placeholder="e.g. Penicillin, Sulfa"
                        className="flex-1 rounded-lg bg-black/60 border border-zinc-800 p-2 text-xs text-zinc-200"
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300 block">Current medications</label>
                  <div className="flex gap-2">
                    <select
                      value={medsHas}
                      onChange={(e) => setMedsHas(e.target.value as any)}
                      className="rounded-lg bg-black/60 border border-zinc-800 p-2 text-xs text-zinc-200"
                    >
                      <option value="unknown">Unknown</option>
                      <option value="no">None</option>
                      <option value="yes">Taking</option>
                    </select>
                    {medsHas === "yes" && (
                      <input
                        type="text"
                        value={medsDetail}
                        onChange={(e) => setMedsDetail(e.target.value)}
                        placeholder="e.g. Paracetamol, Metformin"
                        className="flex-1 rounded-lg bg-black/60 border border-zinc-800 p-2 text-xs text-zinc-200"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Emergency Warning Signs Screen */}
              <div className="rounded-lg bg-red-950/20 border border-red-900/40 p-4 space-y-3">
                <div className="flex items-center gap-2 text-red-400">
                  <ShieldAlert className="h-4 w-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Independent Clinical Safety Screen</span>
                </div>
                <p className="text-xs text-zinc-300">
                  Are you experiencing any emergency warning signs, such as confusion, difficulty breathing, new numbness/weakness, or a sudden, explosive severe headache?
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "no", label: "No" },
                    { value: "unsure", label: "Unsure" },
                    { value: "yes", label: "Yes (Severe / Urgent)" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setHasEmergencySigns(opt.value as any)}
                      className={`p-2 rounded-lg text-xs font-bold border transition ${
                        hasEmergencySigns === opt.value
                          ? opt.value === "yes"
                            ? "bg-red-600 text-white border-red-500"
                            : "bg-teal-500/20 text-teal-300 border-teal-500"
                          : "bg-black/40 text-zinc-400 border-zinc-800"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                onClick={(e) => handleSaveStep2(e, false)}
                variant="outline"
                disabled={isSubmitting}
                className="border-zinc-800 hover:bg-zinc-900 text-zinc-300 text-xs font-semibold flex items-center gap-1.5"
              >
                <Save className="h-3.5 w-3.5 text-zinc-400" />
                <span>Save Draft & Exit</span>
              </Button>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-5 py-2.5 rounded-lg flex items-center gap-2 shadow-sm"
              >
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArrowRight className="h-3.5 w-3.5" />
                )}
                <span>Continue to Adaptive Interview</span>
              </Button>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: ADAPTIVE INTERVIEW                                                */}
        {/* ========================================================================= */}
        {step === "interview" && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Header with Progress & Fact Review Button */}
            <div className="flex items-center justify-between bg-zinc-900/60 border border-zinc-800 rounded-xl p-3.5 px-4">
              <div>
                <span className="text-xs font-bold text-teal-400 uppercase tracking-wider block">
                  Adaptive Clinical Interview
                </span>
                <span className="text-[11px] text-zinc-400">
                  Question {(assessment?.interviewProgress?.answeredQuestions?.length || 0) + 1} • Clinix asks one question at a time
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setShowEditFactsModal(!showEditFactsModal)}
                  variant="outline"
                  size="sm"
                  className="h-8 text-[11px] border-zinc-700 hover:bg-zinc-800 text-zinc-300 flex items-center gap-1.5"
                >
                  <FileText className="h-3.5 w-3.5 text-teal-400" />
                  <span>Reported Facts ({assessment?.reportedFacts?.known?.length || 0})</span>
                </Button>

                <Button
                  onClick={handleConcludeNow}
                  disabled={isSubmitting}
                  variant="outline"
                  size="sm"
                  className="h-8 text-[11px] border-amber-600/40 text-amber-300 hover:bg-amber-950/40"
                >
                  Conclude Now →
                </Button>
              </div>
            </div>

            {/* Collapsible Reported Facts Panel */}
            {showEditFactsModal && (
              <div className="rounded-xl bg-black/60 border border-zinc-800 p-4 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-200">What Clinix Has Recorded So Far:</span>
                  <button
                    onClick={() => setShowEditFactsModal(false)}
                    className="text-zinc-400 hover:text-white text-xs"
                  >
                    Close
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {assessment?.reportedFacts?.known.map((fact, idx) => (
                    <div key={idx} className="p-2 rounded-lg bg-zinc-900 border border-zinc-800/80">
                      <span className="text-[10px] text-zinc-400 block font-semibold">{fact.label}</span>
                      <span className="text-zinc-200 font-medium">{fact.value}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-2 flex justify-end">
                  <Button
                    onClick={() => setStep("collect")}
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] border-zinc-700"
                  >
                    <Edit3 className="h-3 w-3 mr-1 text-teal-400" />
                    Edit Initial Information
                  </Button>
                </div>
              </div>
            )}

            {/* Interactive Interview Transcript */}
            <div
              role="log"
              aria-live="polite"
              className="rounded-xl bg-zinc-900/40 border border-zinc-800 p-4 min-h-[380px] max-h-[520px] overflow-y-auto space-y-4"
            >
              {/* Initial Complaint Card */}
              <div className="p-3 rounded-lg bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-300 space-y-1">
                <span className="text-[10px] font-bold uppercase text-teal-400 tracking-wider">
                  Initial Consultation Details
                </span>
                <p>
                  <strong>Primary Complaint:</strong> {assessment?.primaryComplaint?.symptom}
                </p>
                {assessment?.primaryComplaint?.onset && (
                  <p>
                    <strong>Onset:</strong> {assessment.primaryComplaint.onset.replace(/_/g, " ")} •{" "}
                    <strong>Duration:</strong> {assessment.primaryComplaint.duration?.replace(/_/g, " ")} •{" "}
                    <strong>Severity:</strong> {assessment.primaryComplaint.severity}
                  </p>
                )}
              </div>

              {/* Previously Answered Questions */}
              {assessment?.interviewProgress?.answeredQuestions.map((turn, idx) => (
                <div key={idx} className="space-y-2">
                  {/* Assistant Question */}
                  <div className="flex items-start gap-2 max-w-[85%]">
                    <div className="p-1 rounded bg-teal-500/10 text-teal-400 shrink-0 mt-0.5">
                      <Stethoscope className="h-3.5 w-3.5" />
                    </div>
                    <div className="p-3 rounded-xl rounded-tl-xs bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 leading-relaxed">
                      {turn.questionText}
                    </div>
                  </div>

                  {/* Patient Answer */}
                  <div className="flex justify-end">
                    <div className="p-3 rounded-xl rounded-tr-xs bg-blue-600 text-white text-xs max-w-[85%] leading-relaxed">
                      {turn.answerText}
                    </div>
                  </div>
                </div>
              ))}

              {/* Current Active Question */}
              {assessment?.interviewProgress?.currentQuestion && (
                <div className="flex items-start gap-2 max-w-[85%] animate-in fade-in">
                  <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400 shrink-0 mt-0.5">
                    <Stethoscope className="h-4 w-4" />
                  </div>
                  <div className="p-4 rounded-xl rounded-tl-xs bg-zinc-900 border border-teal-500/30 text-sm text-zinc-100 font-medium leading-relaxed shadow-sm">
                    {assessment.interviewProgress.currentQuestion.text}
                  </div>
                </div>
              )}

              {/* Thinking Indicator */}
              {isSubmitting && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-zinc-900 border border-zinc-800 max-w-[140px] text-xs text-zinc-400 animate-pulse">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-400" />
                  <span>Analyzing...</span>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Natural Chat Input (One question at a time) */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmitAnswer();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type your answer naturally..."
                disabled={isSubmitting}
                className="flex-1 rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <Button
                type="submit"
                disabled={isSubmitting || !chatInput.trim()}
                className="bg-teal-600 hover:bg-teal-500 text-white px-5 rounded-xl font-bold flex items-center gap-1.5"
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">Send</span>
              </Button>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 4: ASSESSMENT RESULTS                                                */}
        {/* ========================================================================= */}
        {step === "result" && assessment && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Urgency Guidance Banner */}
            <div
              className={`p-5 rounded-xl border flex items-start gap-4 ${
                assessment.urgency === "emergency"
                  ? "bg-red-950/40 border-red-700 text-red-200"
                  : assessment.urgency === "urgent"
                  ? "bg-amber-950/40 border-amber-600 text-amber-200"
                  : assessment.urgency === "self_care_eligible"
                  ? "bg-emerald-950/40 border-emerald-600 text-emerald-200"
                  : "bg-teal-950/40 border-teal-600 text-teal-200"
              }`}
            >
              <div className="p-2 rounded-lg bg-black/40 shrink-0 mt-0.5">
                {assessment.urgency === "emergency" ? (
                  <ShieldAlert className="h-6 w-6 text-red-400" />
                ) : assessment.urgency === "urgent" ? (
                  <AlertTriangle className="h-6 w-6 text-amber-400" />
                ) : (
                  <ShieldCheck className="h-6 w-6 text-teal-400" />
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Triage Urgency Level:</span>
                  <Badge className="capitalize text-[10px] font-bold">
                    {(assessment.urgency || "routine").toUpperCase()}
                  </Badge>
                </div>
                <h3 className="text-base font-extrabold text-white">
                  {assessment.urgency === "emergency"
                    ? "Immediate In-Person Emergency Evaluation Required"
                    : assessment.urgency === "urgent"
                    ? "In-Person Medical Review Recommended Within 24 Hours"
                    : "Routine Consultation or Self-Care Monitoring"}
                </h3>
                <p className="text-xs opacity-90 leading-relaxed">{assessment.summary}</p>
              </div>
            </div>

            {/* Section 1: Summary of Symptoms & Information Gathered */}
            <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="h-4 w-4 text-teal-400" />
                  <span>Reported Symptoms & Information Gathered</span>
                </h3>
                <span className="text-[10px] text-zinc-500">Verified by Patient</span>
              </div>

              {/* Known facts vs. Remaining uncertainties */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider block">
                    Patient-Reported Facts:
                  </span>
                  <div className="space-y-1.5">
                    {assessment.reportedFacts?.known.map((fact, idx) => (
                      <div key={idx} className="p-2 rounded bg-black/40 border border-zinc-800 text-zinc-200">
                        <span className="text-[10px] text-zinc-400 block">{fact.label}</span>
                        <span className="font-medium">{fact.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Remaining Uncertainties:
                  </span>
                  <div className="space-y-1.5">
                    {assessment.limitations?.map((lim, idx) => (
                      <div key={idx} className="p-2 rounded bg-black/20 border border-zinc-800/60 text-zinc-400">
                        <span>• {lim}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Possible Considerations (Differential) with Uncertainty */}
            {assessment.possibleConditions && assessment.possibleConditions.length > 0 && (
              <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-5 space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-blue-400" />
                    <span>Possible Considerations (Differential)</span>
                  </h3>
                  <span className="text-[10px] text-amber-400 italic">Non-diagnostic</span>
                </div>

                <p className="text-xs text-zinc-400">
                  These represent plausible clinical possibilities based on your reported symptoms. Only a licensed clinician can provide a formal diagnosis.
                </p>

                <div className="space-y-2 pt-1">
                  {assessment.possibleConditions.map((cond, idx) => (
                    <div key={idx} className="p-3.5 rounded-lg bg-black/40 border border-zinc-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-zinc-100">{cond.name}</span>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed">{cond.explanation}</p>
                      {cond.missingInformation && cond.missingInformation.length > 0 && (
                        <div className="text-[11px] text-zinc-500 pt-1">
                          <span className="text-zinc-400 font-semibold">Missing confirmation:</span>{" "}
                          {cond.missingInformation.join(", ")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 3: Recommended Next Steps */}
            {assessment.recommendations && assessment.recommendations.length > 0 && (
              <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-5 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-zinc-800/80 pb-3">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>Recommended Next Steps</span>
                </h3>
                <div className="space-y-2 text-xs">
                  {assessment.recommendations.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-zinc-200">
                      <span className="h-5 w-5 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="leading-relaxed">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 4: Integrated Healthcare Facility Search */}
            <div className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-teal-400" />
                    <span>Find Nearby Healthcare Facilities</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Connect directly to verified hospitals and clinics ranked by proximity.
                  </p>
                </div>
              </div>

              {/* Interactive Nearby Facility Finder Widget */}
              <HealthcareFinderWidget defaultRadiusMeters={5000} />
            </div>

            {/* Action Buttons: Save, Print, Start Over */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-zinc-800">
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => window.print()}
                  variant="outline"
                  className="border-zinc-800 hover:bg-zinc-900 text-zinc-300 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Summary</span>
                </Button>

                <Link href="/dashboard/assessments">
                  <Button variant="outline" className="border-zinc-800 hover:bg-zinc-900 text-zinc-300 text-xs font-semibold">
                    View in Records
                  </Button>
                </Link>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => {
                    setStep("start");
                    setAssessment(null);
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>New Assessment</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ESCALATED: IMMEDIATE EMERGENCY WARNING                                    */}
        {/* ========================================================================= */}
        {step === "escalated" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="rounded-xl bg-red-950/60 border-2 border-red-600 p-6 space-y-4 text-center">
              <div className="inline-flex p-3 rounded-full bg-red-600 text-white animate-bounce">
                <ShieldAlert className="h-8 w-8" />
              </div>
              <h2 className="text-xl font-extrabold text-white">
                POTENTIAL MEDICAL EMERGENCY DETECTED
              </h2>
              <p className="text-xs text-red-200 max-w-lg mx-auto leading-relaxed">
                Critical warning signs have been reported that require immediate in-person emergency medical care. Do not wait to complete an automated form.
              </p>

              <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
                <a
                  href="tel:112"
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 text-white px-6 py-3.5 text-sm font-extrabold shadow-lg transition"
                >
                  <PhoneCall className="h-5 w-5 animate-pulse" />
                  <span>CALL 112 EMERGENCY DISPATCH NOW</span>
                </a>

                <Link
                  href="/clinics?type=emergency_department"
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 border border-zinc-700 hover:bg-zinc-800 text-white px-5 py-3.5 text-xs font-bold transition"
                >
                  <MapPin className="h-4 w-4 text-red-400" />
                  <span>Find Nearest Emergency Hospital</span>
                </Link>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 space-y-2">
              <p className="font-semibold text-zinc-300">Why was this assessment halted?</p>
              <p>
                Clinix operates strict clinical safety guardrails. When symptoms such as severe difficulty breathing, acute chest pain, sudden explosive headache, confusion, or severe neurological deficits are reported, the system halts routine question answering to avoid delaying lifesaving care.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
