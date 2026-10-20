"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Stethoscope,
  Pill,
  MapPin,
  PhoneCall,
  ArrowRight,
  Sparkles,
  Send,
  ShieldCheck,
  FileText,
  Clock,
  Brain,
  Zap,
  Lock,
  Activity,
  AlertCircle,
  X,
} from "lucide-react";
import { ConsentModal } from "@/components/consent/consent-modal";

interface Message {
  id: string;
  sender: "assistant" | "user";
  text: string;
  isEmergency?: boolean;
}

export function HomeDashboard() {
  const router = useRouter();
  const { data: session } = useSession();

  const [showConsent, setShowConsent] = React.useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = React.useState(false);
  const [showLearnMoreModal, setShowLearnMoreModal] = React.useState(false);

  // Health Assistant Interactive State
  const [symptomInput, setSymptomInput] = React.useState("");
  const [isTyping, setIsTyping] = React.useState(false);

  const displayName = session?.user?.name
    ? session.user.name.split(" ")[0]
    : session?.user?.email
    ? session.user.email.split("@")[0]
    : "Friend";

  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: "m-0",
      sender: "assistant",
      text: `Hello ${displayName}! I'm your AI health assistant. Tell me what's wrong, and I'll help you find the possible cause, suggest next steps, and guide you to the right care.`,
    },
  ]);

  function handleStartTriage() {
    setShowConsent(true);
  }

  async function onConsentComplete(granted: boolean) {
    setShowConsent(false);
    if (!granted) return;

    // Check if session exists or establish guest session
    if (!session?.user) {
      try {
        await fetch("/api/auth/guest", { method: "POST" });
      } catch (err) {
        console.error("Guest session init error:", err);
      }
    }
    router.push("/symptom-checker");
  }

  // Handle Quick Chips or User Input
  async function handleSendQuery(textToSend?: string) {
    const text = (textToSend || symptomInput).trim();
    if (!text) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      sender: "user",
      text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setSymptomInput("");
    setIsTyping(true);

    // Rule-based Emergency Screening (Section 4.3 & 5 Step 3)
    const lower = text.toLowerCase();
    const isEmergency =
      lower.includes("chest pain") ||
      lower.includes("heart attack") ||
      lower.includes("can't breathe") ||
      lower.includes("shortness of breath") ||
      lower.includes("stroke") ||
      lower.includes("severe bleeding") ||
      lower.includes("unconscious");

    if (isEmergency) {
      setTimeout(() => {
        setIsTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            sender: "assistant",
            isEmergency: true,
            text: "EMERGENCY WARNING: Symptoms such as severe chest pain, breathing difficulty, or signs of stroke require immediate emergency medical care. Please do not wait for an automated chat. Call emergency services right now.",
          },
        ]);
        setShowEmergencyModal(true);
      }, 400);
      return;
    }

    // Call server triage or assessment endpoint
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: text }],
          turn: 1,
        }),
      });

      const data = await res.json();
      setIsTyping(false);

      if (res.ok && data.message) {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            sender: "assistant",
            text: data.message,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            sender: "assistant",
            text: "I understand your symptoms. For an accurate, multi-step clinical assessment and recommended next steps, please start a full symptom check.",
          },
        ]);
      }
    } catch {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          sender: "assistant",
          text: "Thank you for sharing your symptoms. To get personalized guidance and potential explanations, please tap 'Check My Symptoms' to begin your full assessment.",
        },
      ]);
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* 1. HERO / WELCOME BANNER (Matching Prototype) */}
      <section className="relative overflow-hidden rounded-3xl border border-blue-100/80 bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-sky-100/60 p-6 sm:p-10 shadow-xs dark:border-slate-800 dark:from-slate-900/90 dark:via-blue-950/20 dark:to-slate-900">
        {/* Soft Background Orbs */}
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="absolute right-32 bottom-0 h-48 w-48 rounded-full bg-indigo-400/10 blur-2xl" />

        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8">
          {/* Welcome Text & CTA */}
          <div className="max-w-xl text-center lg:text-left space-y-4">
            <span className="text-sm font-semibold tracking-wide text-blue-600 dark:text-blue-400">
              Hi {displayName},
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.15]">
              How can we help you today?
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
              Describe what you&apos;re feeling, and our AI will guide you with the next best steps.
            </p>
            <div className="pt-2">
              <button
                onClick={handleStartTriage}
                className="inline-flex items-center gap-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 px-6 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-500/25 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <span>Check My Symptoms</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* 3D Modern Healthcare Shield Illustration */}
          <div className="relative flex items-center justify-center shrink-0">
            {/* Glowing background halo */}
            <div className="absolute h-48 w-48 rounded-full bg-blue-300/30 blur-2xl dark:bg-blue-600/20" />
            
            <div className="relative flex h-36 w-36 sm:h-44 sm:w-44 items-center justify-center rounded-3xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 text-white shadow-xl shadow-blue-500/30 p-8">
              <div className="flex flex-col items-center justify-center gap-2">
                <Activity className="h-14 w-14 sm:h-16 sm:w-16 animate-pulse" />
                <span className="text-[10px] font-bold tracking-widest uppercase opacity-80">
                  Clinix Guard
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. FOUR PRIMARY FEATURE CARDS (4-Column Grid) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Card 1: Symptom Checker */}
        <Link
          href="/symptom-checker"
          className="group flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-6 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-900"
        >
          <div className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-200 shadow-2xs">
              <Stethoscope className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                Symptom Checker
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Get an AI-powered assessment
              </p>
            </div>
          </div>
          <div className="mt-6 flex items-center text-xs font-bold text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </div>
        </Link>

        {/* Card 2: Medications */}
        <Link
          href="/medications"
          className="group flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-6 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-sky-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-sky-900"
        >
          <div className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400 group-hover:bg-sky-600 group-hover:text-white transition-colors duration-200 shadow-2xs">
              <Pill className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                Medications
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Learn about medications and side effects
              </p>
            </div>
          </div>
          <div className="mt-6 flex items-center text-xs font-bold text-slate-400 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </div>
        </Link>

        {/* Card 3: Find Nearby Clinics */}
        <Link
          href="/clinics"
          className="group flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-6 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-teal-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-900"
        >
          <div className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400 group-hover:bg-teal-600 group-hover:text-white transition-colors duration-200 shadow-2xs">
              <MapPin className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                Find Nearby Clinics
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Locate trusted clinics near you
              </p>
            </div>
          </div>
          <div className="mt-6 flex items-center text-xs font-bold text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </div>
        </Link>

        {/* Card 4: Emergency */}
        <Link
          href="/emergency"
          className="group flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-6 shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-rose-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-rose-900"
        >
          <div className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 group-hover:bg-rose-600 group-hover:text-white transition-colors duration-200 shadow-2xs">
              <PhoneCall className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                Emergency
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Call for urgent help or get emergency numbers
              </p>
            </div>
          </div>
          <div className="mt-6 flex items-center text-xs font-bold text-slate-400 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </div>
        </Link>
      </section>

      {/* 3. SPLIT MIDDLE SECTION (Left: Health Assistant, Right: Quick Access & Trust) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Your Health Assistant (7 of 12 cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-100 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                <Sparkles className="h-4 w-4" />
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Your Health Assistant
              </h2>
            </div>
            <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400 px-2.5 py-0.5 rounded-full">
              Live & Protected
            </span>
          </div>

          {/* Conversational Stream */}
          <div
            className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1"
            role="log"
            aria-live="polite"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 items-start ${
                  msg.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.sender === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-2xs mt-1">
                    <Activity className="h-4 w-4" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                    msg.isEmergency
                      ? "bg-red-50 text-red-900 border border-red-200 dark:bg-red-950/50 dark:text-red-200 dark:border-red-800 font-medium"
                      : msg.sender === "user"
                      ? "bg-blue-600 text-white rounded-br-xs"
                      : "bg-slate-50 text-slate-700 dark:bg-slate-800/80 dark:text-slate-200 rounded-tl-xs"
                  }`}
                >
                  {msg.text}
                  {msg.isEmergency && (
                    <div className="mt-3">
                      <a
                        href="tel:112"
                        className="inline-flex items-center gap-2 rounded-xl bg-red-600 text-white px-4 py-2 text-xs font-bold shadow hover:bg-red-700"
                      >
                        <PhoneCall className="h-3.5 w-3.5 animate-bounce" />
                        <span>Dial 112 Emergency Dispatch Now</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-3 items-center">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                  <Activity className="h-4 w-4 animate-spin" />
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-2.5 text-xs text-slate-500 dark:bg-slate-800">
                  <span className="animate-pulse">Analyzing symptoms against safety catalog...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Box matching design */}
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 transition-all">
            <textarea
              rows={2}
              className="w-full resize-none bg-transparent text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none dark:text-white"
              placeholder="Describe your symptoms..."
              value={symptomInput}
              onChange={(e) => setSymptomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendQuery();
                }
              }}
            />
            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-400">
                Press Enter to send
              </span>
              <button
                onClick={() => handleSendQuery()}
                disabled={!symptomInput.trim() || isTyping}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
                aria-label="Send symptom description"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Quick Prompt Chips (Section 4.3) */}
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Quick Inquiries:
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                "I have a fever",
                "I have a headache",
                "I feel chest pain",
                "I have a cough",
              ].map((chip) => (
                <button
                  key={chip}
                  onClick={() => handleSendQuery(chip)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
                    chip.includes("chest pain")
                      ? "border-red-200 bg-red-50/60 text-red-700 hover:bg-red-100/80 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300 hover:bg-blue-50/70 hover:text-blue-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-800"
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-slate-400 text-center pt-1">
            This is not a substitute for professional medical advice.
          </p>
        </div>

        {/* Right Column: Quick Access & Priority Card (5 of 12 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Quick Access Card */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Quick Access
            </h3>
            <div className="space-y-2.5">
              {/* Nearby Clinics */}
              <Link
                href="/clinics"
                className="group flex items-center justify-between rounded-xl p-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400 shadow-2xs">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                      Nearby Clinics
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Find clinics within your area
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-all group-hover:translate-x-1" />
              </Link>

              {/* Emergency Numbers */}
              <Link
                href="/emergency"
                className="group flex items-center justify-between rounded-xl p-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 shadow-2xs">
                    <PhoneCall className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                      Emergency Numbers
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Ambulance, fire, police (112)
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-all group-hover:translate-x-1" />
              </Link>

              {/* My Health Records */}
              <Link
                href="/history"
                className="group flex items-center justify-between rounded-xl p-3 transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 shadow-2xs">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      My Health Records
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      View your past consultations
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-all group-hover:translate-x-1" />
              </Link>
            </div>
          </div>

          {/* "Your Health, Our Priority" Trust Banner */}
          <div className="rounded-2xl border border-teal-100/90 bg-gradient-to-br from-teal-50/90 to-emerald-50/60 p-6 shadow-xs dark:border-teal-900/60 dark:from-teal-950/40 dark:to-slate-900 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white shadow-xs shadow-teal-600/30">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-teal-950 dark:text-teal-200">
                  Your Health, Our Priority
                </h4>
                <p className="text-xs text-teal-800 dark:text-teal-400">
                  Secure. Reliable. Always available.
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Every Clinix assessment is screened by clinician-reviewed rules and guarded by emergency escalation protocols.
            </p>
            <div>
              <button
                onClick={() => setShowLearnMoreModal(true)}
                className="rounded-xl border border-teal-200 bg-white/90 px-4 py-2 text-xs font-bold text-teal-800 hover:bg-white shadow-2xs dark:border-teal-800 dark:bg-slate-850 dark:text-teal-300"
              >
                Learn More
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. BOTTOM TRUST / PILLARS BAR (4 Columns) */}
      <section className="rounded-2xl border border-slate-100 bg-white p-6 sm:p-8 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-center sm:text-left divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800">
          {/* Pillar 1 */}
          <div className="flex items-center gap-3.5 sm:px-4 first:pl-0 pt-4 sm:pt-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                AI-Powered
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Accurate and reliable insights
              </p>
            </div>
          </div>

          {/* Pillar 2 */}
          <div className="flex items-center gap-3.5 sm:px-4 pt-4 sm:pt-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Local Care
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Real clinics, real people
              </p>
            </div>
          </div>

          {/* Pillar 3 */}
          <div className="flex items-center gap-3.5 sm:px-4 pt-4 sm:pt-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Fast Response
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                When every second counts
              </p>
            </div>
          </div>

          {/* Pillar 4 */}
          <div className="flex items-center gap-3.5 sm:px-4 last:pr-0 pt-4 sm:pt-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Privacy First
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Your data stays yours
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Consent Modal for Guided Symptom Assessment */}
      <ConsentModal
        isOpen={showConsent}
        onConsentComplete={onConsentComplete}
        isGuest={!session?.user}
      />

      {/* Emergency Alert Modal (Triggered by Chest Pain / Red Flag Prompt) */}
      {showEmergencyModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-label="Urgent Emergency Warning"
        >
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-red-200 bg-white p-6 shadow-2xl dark:border-red-900 dark:bg-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-red-100 dark:border-red-900/60">
              <div className="flex items-center gap-2.5 text-red-600">
                <AlertCircle className="h-6 w-6 animate-bounce" />
                <h3 className="text-base font-black uppercase tracking-wider text-red-600">
                  Immediate Emergency Warning
                </h3>
              </div>
              <button
                onClick={() => setShowEmergencyModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="py-4 space-y-3">
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                Symptoms of chest pain, shortness of breath, or sudden weakness can indicate a life-threatening medical emergency.
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Do not wait for an automated chat questionnaire. Please reach emergency medical dispatchers or visit the nearest emergency facility immediately.
              </p>
              <div className="rounded-2xl bg-red-50 p-4 border border-red-100 dark:bg-red-950/40 dark:border-red-900 text-center space-y-2">
                <span className="text-xs font-semibold text-red-700 dark:text-red-300">
                  Ghana National Ambulance Service
                </span>
                <div>
                  <a
                    href="tel:112"
                    className="inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 px-6 py-3 text-sm font-black text-white shadow-md shadow-red-500/30"
                  >
                    <PhoneCall className="h-4 w-4 animate-bounce" />
                    <span>Dial 112 Directly</span>
                  </a>
                </div>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowEmergencyModal(false)}
                className="text-xs text-slate-500 hover:text-slate-700 font-semibold"
              >
                Dismiss Warning
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Learn More Trust Modal */}
      {showLearnMoreModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-label="Clinix Security and Clinical Governance"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2 text-teal-600">
                <ShieldCheck className="h-5 w-5" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Security & Safety Architecture
                </h3>
              </div>
              <button
                onClick={() => setShowLearnMoreModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                <strong>Clinix</strong> is engineered to enterprise healthcare standards:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong>Dual-Layer Emergency Shield:</strong> Pre-AI and post-AI rule engines guarantee critical red flags immediately trigger emergency escalation.
                </li>
                <li>
                  <strong>Act 843 Privacy Compliance:</strong> Compliant with the Ghana Data Protection Act, 2012. You maintain full ownership, export rights, and right to erasure.
                </li>
                <li>
                  <strong>Zero Prescribing & No Dosage Calculation:</strong> Designed strictly for triage and care navigation, avoiding dangerous medication calculations.
                </li>
                <li>
                  <strong>Decoupled Emergency Path:</strong> Emergency dialer operates independently of AI and database uptime.
                </li>
              </ul>
            </div>
            <div className="pt-2 flex justify-end gap-2">
              <Link
                href="/privacy"
                onClick={() => setShowLearnMoreModal(false)}
                className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
              >
                Read Full Privacy Policy
              </Link>
              <button
                onClick={() => setShowLearnMoreModal(false)}
                className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
