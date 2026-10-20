"use client";

import * as React from "react";
import Link from "next/link";
import {
  HeartPulse,
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
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AssessmentResult } from "@/services/assessment-service";
import { TriState } from "@/lib/safety/types";
import { ConsentModal } from "@/components/consent/consent-modal";

interface Message {
  role: "patient" | "assistant";
  content: string;
}

export default function SymptomCheckerPage() {
  const [step, setStep] = React.useState<"initial" | "chat" | "result">("initial");
  const [hasConsented, setHasConsented] = React.useState(false);
  const [showConsentModal, setShowConsentModal] = React.useState(false);

  // Form State
  const [symptoms, setSymptoms] = React.useState("");
  const [age, setAge] = React.useState<string>("");
  const [allergiesStatus, setAllergiesStatus] = React.useState<TriState>("unknown");
  const [allergiesText, setAllergiesText] = React.useState("");
  const [medicinesStatus, setMedicinesStatus] = React.useState<TriState>("unknown");
  const [medicinesText, setMedicinesText] = React.useState("");
  const [pregnancy, setPregnancy] = React.useState<TriState | "not_applicable">("unknown");

  // Chat State
  const [conversation, setConversation] = React.useState<Message[]>([]);
  const [currentInput, setCurrentInput] = React.useState("");
  const [currentQuestion, setCurrentQuestion] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [errorState, setErrorState] = React.useState<{ message: string; safeAction?: string } | null>(null);

  // Result State
  const [assessment, setAssessment] = React.useState<AssessmentResult | null>(null);

  function handleStartAssessment(e: React.FormEvent) {
    e.preventDefault();
    if (!symptoms.trim()) return;

    if (!hasConsented) {
      setShowConsentModal(true);
      return;
    }

    startTriageRequest();
  }

  async function startTriageRequest() {
    setLoading(true);
    setErrorState(null);

    const payload = {
      symptoms: symptoms.trim(),
      age: age ? Number(age) : undefined,
      allergies: {
        status: allergiesStatus,
        items: allergiesText ? allergiesText.split(",").map((s) => s.trim()) : [],
      },
      currentMedicines: {
        status: medicinesStatus,
        items: medicinesText ? medicinesText.split(",").map((s) => s.trim()) : [],
      },
      pregnancy,
      language: "en",
    };

    try {
      const res = await fetch("/api/ai/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorState({
          message: data.error?.message || "Assessment unavailable.",
          safeAction: data.error?.safeAction,
        });
        return;
      }

      const result: AssessmentResult = data.data;

      // If emergency detected or no follow-up questions, display results immediately
      if (result.urgency === "emergency" || !result.followUpQuestions || result.followUpQuestions.length === 0) {
        setAssessment(result);
        setStep("result");
      } else {
        // Move to interactive single-question chat
        setAssessment(result);
        setConversation([
          { role: "patient", content: symptoms },
          { role: "assistant", content: result.summary },
        ]);
        setCurrentQuestion(result.followUpQuestions[0]);
        setStep("chat");
      }
    } catch {
      setErrorState({
        message: "We couldn't connect to the assessment service.",
        safeAction: "If you feel this is an emergency, please call 112 immediately.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!currentInput.trim() || loading) return;

    const userMessage = currentInput.trim();
    setCurrentInput("");
    setLoading(true);
    setErrorState(null);

    const newHistory: Message[] = [
      ...conversation,
      { role: "patient", content: userMessage },
    ];
    setConversation(newHistory);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          symptoms,
          conversationHistory: newHistory,
          age: age ? Number(age) : undefined,
          allergies: { status: allergiesStatus },
          currentMedicines: { status: medicinesStatus },
          pregnancy,
          language: "en",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorState({
          message: data.error?.message || "Failed to continue conversation.",
          safeAction: data.error?.safeAction,
        });
        return;
      }

      const result: AssessmentResult = data.data;
      setAssessment(result);

      if (data.isConcluded || result.urgency === "emergency" || !result.followUpQuestions || result.followUpQuestions.length === 0) {
        setStep("result");
      } else {
        setConversation((prev) => [
          ...prev,
          { role: "assistant", content: result.followUpQuestions[0] },
        ]);
        setCurrentQuestion(result.followUpQuestions[0]);
      }
    } catch {
      setErrorState({
        message: "Connection failed during follow-up.",
        safeAction: "If you have severe symptoms, call 112 now.",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleStopAndConclude() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Patient requested to stop interview and conclude.",
          symptoms,
          conversationHistory: conversation,
          age: age ? Number(age) : undefined,
          allergies: { status: allergiesStatus },
          currentMedicines: { status: medicinesStatus },
          pregnancy,
          language: "en",
          concludeNow: true,
        }),
      });

      const data = await res.json();
      if (res.ok && data.data) {
        setAssessment(data.data);
      }
    } catch {
      // Keep existing assessment if network drops
    } finally {
      setStep("result");
      setLoading(false);
    }
  }

  function handleReset() {
    setStep("initial");
    setSymptoms("");
    setAge("");
    setAllergiesStatus("unknown");
    setMedicinesStatus("unknown");
    setPregnancy("unknown");
    setConversation([]);
    setCurrentQuestion(null);
    setAssessment(null);
    setErrorState(null);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Consent Modal */}
      <ConsentModal
        isOpen={showConsentModal}
        onConsentComplete={(granted) => {
          setShowConsentModal(false);
          if (granted) {
            setHasConsented(true);
            startTriageRequest();
          }
        }}
      />

      {/* Emergency Header Fast Call Bar */}
      <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-3 sm:p-4 dark:border-red-950 dark:bg-red-950/40">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <PhoneCall className="h-4 w-4 text-red-600 animate-pulse shrink-0" />
            <span className="text-xs sm:text-sm font-semibold text-red-900 dark:text-red-200">
              Immediate Danger? Severe chest pain, gasping, or sudden weakness?
            </span>
          </div>
          <a
            href="tel:112"
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-red-700"
          >
            <span>Dial 112 Now</span>
          </a>
        </div>
      </div>

      {/* STEP 1: INITIAL COMPLAINT FORM */}
      {step === "initial" && (
        <Card className="shadow-md border-slate-200 dark:border-slate-800">
          <CardHeader className="border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                <HeartPulse className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">Describe Your Symptoms</CardTitle>
                <CardDescription className="text-xs">
                  Describe what you are experiencing. Our safety engine will guide you to appropriate care.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <form onSubmit={handleStartAssessment}>
            <CardContent className="space-y-6 pt-6">
              {errorState && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">{errorState.message}</p>
                      {errorState.safeAction && <p className="mt-1">{errorState.safeAction}</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* Primary Complaint */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-900 dark:text-white">
                  What symptoms are you experiencing? <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="w-full min-h-[110px] rounded-lg border border-slate-300 p-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  placeholder="e.g. I have had a throbbing headache since yesterday morning and felt dizzy whenever I stand up..."
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  required
                />
                <p className="text-[11px] text-slate-500">
                  Include when it started, how severe it is, and whether it has been getting worse.
                </p>
              </div>

              {/* Clinical Context Fields (Tri-State) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                {/* Age */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Patient Age (years)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="120"
                    placeholder="e.g. 28"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                  />
                </div>

                {/* Pregnancy (if applicable) */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Pregnancy Status
                  </label>
                  <select
                    className="w-full h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:border-slate-700 dark:bg-slate-900"
                    value={pregnancy}
                    onChange={(e) => setPregnancy(e.target.value as TriState | "not_applicable")}
                  >
                    <option value="unknown">Unknown / Prefer not to say</option>
                    <option value="no">Not Pregnant</option>
                    <option value="yes">Currently Pregnant</option>
                    <option value="not_applicable">Not Applicable</option>
                  </select>
                </div>

                {/* Allergies Tri-State */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Known Drug or Food Allergies?
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs">
                      <input
                        type="radio"
                        name="allergies"
                        checked={allergiesStatus === "no"}
                        onChange={() => setAllergiesStatus("no")}
                      />
                      <span>No Known Allergies</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs">
                      <input
                        type="radio"
                        name="allergies"
                        checked={allergiesStatus === "yes"}
                        onChange={() => setAllergiesStatus("yes")}
                      />
                      <span>Yes (Specify)</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs">
                      <input
                        type="radio"
                        name="allergies"
                        checked={allergiesStatus === "unknown"}
                        onChange={() => setAllergiesStatus("unknown")}
                      />
                      <span>Unknown</span>
                    </label>
                  </div>
                  {allergiesStatus === "yes" && (
                    <Input
                      type="text"
                      placeholder="e.g. Penicillin, Aspirin, Peanuts"
                      className="mt-1"
                      value={allergiesText}
                      onChange={(e) => setAllergiesText(e.target.value)}
                    />
                  )}
                </div>

                {/* Current Medicines Tri-State */}
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Currently Taking Any Medications?
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs">
                      <input
                        type="radio"
                        name="medicines"
                        checked={medicinesStatus === "no"}
                        onChange={() => setMedicinesStatus("no")}
                      />
                      <span>No Medications</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs">
                      <input
                        type="radio"
                        name="medicines"
                        checked={medicinesStatus === "yes"}
                        onChange={() => setMedicinesStatus("yes")}
                      />
                      <span>Yes (Specify)</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs">
                      <input
                        type="radio"
                        name="medicines"
                        checked={medicinesStatus === "unknown"}
                        onChange={() => setMedicinesStatus("unknown")}
                      />
                      <span>Unknown</span>
                    </label>
                  </div>
                  {medicinesStatus === "yes" && (
                    <Input
                      type="text"
                      placeholder="e.g. Metformin, Amlodipine, Vitamin D"
                      className="mt-1"
                      value={medicinesText}
                      onChange={(e) => setMedicinesText(e.target.value)}
                    />
                  )}
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <span className="text-xs text-slate-500">
                Triage rules run before AI generation. Safety guaranteed.
              </span>
              <Button type="submit" variant="default" size="lg" disabled={loading} className="w-full sm:w-auto">
                {loading ? "Evaluating Safety Rules..." : "Start Symptom Assessment"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {/* STEP 2: MULTI-TURN GUIDED FOLLOW-UP CHAT */}
      {step === "chat" && (
        <Card className="shadow-md border-slate-200 dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
            <div>
              <CardTitle className="text-lg font-bold">Follow-Up Questions</CardTitle>
              <CardDescription className="text-xs">
                One question at a time to clarify your clinical urgency.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleStopAndConclude}
              disabled={loading}
              className="text-xs"
            >
              Stop & View Results
            </Button>
          </CardHeader>

          <CardContent
            className="space-y-4 pt-4 max-h-[500px] overflow-y-auto"
            role="log"
            aria-live="polite"
            aria-label="Assessment conversation history"
          >
            {conversation.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "patient" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                    msg.role === "patient"
                      ? "bg-teal-600 text-white rounded-br-none"
                      : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100 rounded-bl-none"
                  }`}
                >
                  <p className="font-semibold text-[10px] opacity-75 uppercase mb-1">
                    {msg.role === "patient" ? "You" : "Clinical Assistant"}
                  </p>
                  <p>{msg.content}</p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-xl bg-slate-100 px-4 py-3 text-xs text-slate-500 dark:bg-slate-800">
                  <span className="animate-pulse">Evaluating safety rules and generating response...</span>
                </div>
              </div>
            )}

            {errorState && (
              <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                <p className="font-bold">{errorState.message}</p>
                {errorState.safeAction && <p className="mt-1">{errorState.safeAction}</p>}
              </div>
            )}
          </CardContent>

          <CardFooter className="border-t border-slate-100 pt-3 dark:border-slate-800">
            <form onSubmit={handleSendReply} className="flex w-full items-center gap-2">
              <Input
                type="text"
                placeholder="Type your answer here..."
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                disabled={loading}
                className="flex-1"
                autoFocus
              />
              <Button type="submit" variant="default" size="icon" disabled={loading || !currentInput.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardFooter>
        </Card>
      )}

      {/* STEP 3: STRUCTURED ASSESSMENT RESULTS */}
      {step === "result" && assessment && (
        <div className="space-y-6">
          {/* URGENCY BANNER (Shown First) */}
          <div
            className={`rounded-2xl p-6 shadow-md border ${
              assessment.urgency === "emergency"
                ? "bg-red-600 text-white border-red-700"
                : assessment.urgency === "urgent"
                ? "bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900"
                : assessment.urgency === "routine"
                ? "bg-teal-50 text-teal-900 border-teal-200 dark:bg-teal-950/40 dark:text-teal-200 dark:border-teal-900"
                : assessment.urgency === "self_care_eligible"
                ? "bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900"
                : "bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700"
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                {assessment.urgency === "emergency" ? (
                  <ShieldAlert className="h-8 w-8 text-white shrink-0 mt-0.5 animate-bounce" />
                ) : assessment.urgency === "urgent" ? (
                  <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <ShieldCheck className="h-8 w-8 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider opacity-80">
                      Triage Urgency Level
                    </span>
                    <Badge
                      variant={
                        assessment.urgency === "emergency"
                          ? "destructive"
                          : assessment.urgency === "urgent"
                          ? "warning"
                          : "default"
                      }
                    >
                      {assessment.urgency.replace("_", " ").toUpperCase()}
                    </Badge>
                  </div>
                  <h2 className="mt-1 text-2xl font-black">
                    {assessment.urgency === "emergency"
                      ? "Emergency Medical Assistance Required"
                      : assessment.urgency === "urgent"
                      ? "Prompt In-Person Medical Review Needed"
                      : assessment.urgency === "routine"
                      ? "Routine Clinical Evaluation Recommended"
                      : assessment.urgency === "self_care_eligible"
                      ? "Self-Care Information May Be Appropriate"
                      : "Insufficient Clinical Information"}
                  </h2>
                  <p className="mt-2 text-xs sm:text-sm leading-relaxed opacity-90">
                    {assessment.summary}
                  </p>
                </div>
              </div>

              {assessment.urgency === "emergency" && (
                <a
                  href="tel:112"
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-base font-black text-red-600 shadow-xl transition hover:bg-red-50 shrink-0"
                >
                  <PhoneCall className="h-5 w-5" />
                  <span>Call 112 Immediately</span>
                </a>
              )}
            </div>
          </div>

          {/* RECOMMENDED NEXT STEPS */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-teal-600" />
                Recommended Next Steps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-xs sm:text-sm">
                {assessment.recommendedNextSteps.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-slate-700 dark:text-slate-300">
                    <ChevronRight className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* POSSIBLE EXPLANATIONS (Differential) */}
          {assessment.possibleConditions && assessment.possibleConditions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Info className="h-5 w-5 text-teal-600" />
                  Possible Explanations (Not a Confirmed Diagnosis)
                </CardTitle>
                <CardDescription className="text-xs">
                  Conditions that can present with similar symptoms. These are possibilities for clinical
                  discussion, not verified medical determinations.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {assessment.possibleConditions.map((cond, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40 text-xs"
                  >
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">{cond.name}</h4>
                    <p className="mt-1 text-slate-600 dark:text-slate-300">{cond.explanation}</p>
                    {cond.supportingSymptoms?.length > 0 && (
                      <p className="mt-2 text-[11px] text-slate-500">
                        <strong>Matching symptoms:</strong> {cond.supportingSymptoms.join(", ")}
                      </p>
                    )}
                    {cond.missingInformation?.length > 0 && (
                      <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                        <strong>Missing information:</strong> {cond.missingInformation.join(", ")}
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* MEDICATION GUIDANCE / SAFEGUARD NOTICE */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-teal-600" />
                Medication Information & Precautions
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              <p>{assessment.medicationGuidance.explanation}</p>
              {assessment.medicationGuidance.requiresProfessionalReview && (
                <p className="mt-2 font-semibold text-amber-800 dark:text-amber-300">
                  Always consult a licensed pharmacist or physician before taking any new medication,
                  adjusting dosages, or discontinuing prescribed treatment.
                </p>
              )}
            </CardContent>
          </Card>

          {/* LIMITATIONS & DISCLAIMER */}
          <div className="rounded-xl border border-slate-200 bg-slate-100/70 p-4 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            <h4 className="font-bold text-slate-900 dark:text-white mb-1">Clinical Limitations:</h4>
            <ul className="list-disc list-inside space-y-1">
              {assessment.limitations.map((lim, idx) => (
                <li key={idx}>{lim}</li>
              ))}
            </ul>
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
              <Button variant="outline" size="sm" onClick={() => window.print()} className="w-full sm:w-auto flex items-center gap-1.5 text-xs">
                <Printer className="h-4 w-4" />
                <span>Print or Save Summary</span>
              </Button>

              <Link href="/clinics" className="w-full sm:w-auto">
                <Button variant="outline" size="sm" className="w-full flex items-center gap-1.5 text-xs text-teal-700 dark:text-teal-400">
                  <MapPin className="h-4 w-4 text-teal-600" />
                  <span>Find Nearby Clinics & Hospitals</span>
                </Button>
              </Link>
            </div>

            <Button variant="default" size="sm" onClick={handleReset} className="w-full sm:w-auto flex items-center gap-1.5 text-xs">
              <RotateCcw className="h-4 w-4" />
              <span>Start New Assessment</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
