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
      }, 350);
      return;
    }

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
    <div className="space-y-4 sm:space-y-4.5 animate-in fade-in duration-200 bg-black text-slate-100 max-w-6xl mx-auto">
      {/* 1. FOUR PRIMARY FEATURE CARDS (4-Column Grid) */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
        {/* Card 1: Symptom Checker */}
        <Link
          href="/symptom-checker"
          className="group flex flex-col justify-between rounded-xl border border-zinc-800/80 bg-zinc-950 p-3.5 sm:p-4 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-blue-500/60 hover:bg-zinc-900/60"
        >
          <div className="space-y-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-950/70 border border-blue-800/40 text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-150">
              <Stethoscope className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                Symptom Checker
              </h3>
              <p className="mt-0.5 text-[11px] text-zinc-400 leading-tight">
                Get an AI-powered assessment
              </p>
            </div>
          </div>
          <div className="mt-2 flex items-center text-zinc-500 group-hover:text-blue-400 transition-colors">
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </div>
        </Link>

        {/* Card 2: Medications */}
        <Link
          href="/medications"
          className="group flex flex-col justify-between rounded-xl border border-zinc-800/80 bg-zinc-950 p-3.5 sm:p-4 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-sky-500/60 hover:bg-zinc-900/60"
        >
          <div className="space-y-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-950/70 border border-sky-800/40 text-sky-400 group-hover:bg-sky-600 group-hover:text-white transition-colors duration-150">
              <Pill className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-sky-400 transition-colors">
                Medications
              </h3>
              <p className="mt-0.5 text-[11px] text-zinc-400 leading-tight">
                Learn about medications & side effects
              </p>
            </div>
          </div>
          <div className="mt-2 flex items-center text-zinc-500 group-hover:text-sky-400 transition-colors">
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </div>
        </Link>

        {/* Card 3: Find Nearby Clinics */}
        <Link
          href="/clinics"
          className="group flex flex-col justify-between rounded-xl border border-zinc-800/80 bg-zinc-950 p-3.5 sm:p-4 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-teal-500/60 hover:bg-zinc-900/60"
        >
          <div className="space-y-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-950/70 border border-teal-800/40 text-teal-400 group-hover:bg-teal-600 group-hover:text-white transition-colors duration-150">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-teal-400 transition-colors">
                Find Nearby Clinics
              </h3>
              <p className="mt-0.5 text-[11px] text-zinc-400 leading-tight">
                Locate trusted clinics near you
              </p>
            </div>
          </div>
          <div className="mt-2 flex items-center text-zinc-500 group-hover:text-teal-400 transition-colors">
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </div>
        </Link>

        {/* Card 4: Emergency */}
        <Link
          href="/emergency"
          className="group flex flex-col justify-between rounded-xl border border-zinc-800/80 bg-zinc-950 p-3.5 sm:p-4 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-rose-500/60 hover:bg-zinc-900/60"
        >
          <div className="space-y-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-950/70 border border-rose-800/40 text-rose-400 group-hover:bg-rose-600 group-hover:text-white transition-colors duration-150">
              <PhoneCall className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-rose-400 transition-colors">
                Emergency
              </h3>
              <p className="mt-0.5 text-[11px] text-zinc-400 leading-tight">
                Call for urgent help & contacts
              </p>
            </div>
          </div>
          <div className="mt-2 flex items-center text-zinc-500 group-hover:text-rose-400 transition-colors">
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </div>
        </Link>
      </section>

      {/* 3. SPLIT MIDDLE SECTION (Appears immediately on the first screen!) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 items-start">
        {/* Left Column: Your Health Assistant (7 of 12 cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-zinc-800/80 bg-zinc-950 p-4 sm:p-5 shadow-md space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-950/70 border border-blue-800/50 text-blue-400">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <h2 className="text-sm font-bold text-white">
                Your Health Assistant
              </h2>
            </div>
            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/70 border border-emerald-800/50 px-2 py-0.5 rounded-full">
              Live & Protected
            </span>
          </div>

          {/* Conversational Stream (Compact height) */}
          <div
            className="space-y-2.5 max-h-[140px] sm:max-h-[160px] overflow-y-auto pr-1"
            role="log"
            aria-live="polite"
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 items-start ${
                  msg.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.sender === "assistant" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-xs mt-0.5">
                    <Activity className="h-3.5 w-3.5" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-xl p-2.5 sm:p-3 text-xs leading-relaxed ${
                    msg.isEmergency
                      ? "bg-red-950/60 text-red-200 border border-red-800/80 font-medium"
                      : msg.sender === "user"
                      ? "bg-blue-600 text-white rounded-br-xs"
                      : "bg-zinc-900 text-zinc-200 border border-zinc-800/80 rounded-tl-xs"
                  }`}
                >
                  {msg.text}
                  {msg.isEmergency && (
                    <div className="mt-2">
                      <a
                        href="tel:112"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 text-white px-3 py-1.5 text-xs font-bold shadow hover:bg-red-500"
                      >
                        <PhoneCall className="h-3 w-3 animate-bounce" />
                        <span>Dial 112 Emergency Dispatch Now</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-2 items-center">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                  <Activity className="h-3 w-3 animate-spin" />
                </div>
                <div className="rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-[11px] text-zinc-400">
                  <span className="animate-pulse">Analyzing symptoms against safety catalog...</span>
                </div>
              </div>
            )}
          </div>

          {/* Compact Input Box */}
          <div className="rounded-xl border border-zinc-800 bg-black p-2 shadow-inner focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all">
            <textarea
              rows={1}
              className="w-full resize-none bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none min-h-[38px] py-1 px-1"
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
            <div className="flex items-center justify-between pt-1 px-1 border-t border-zinc-900/60">
              <span className="text-[10px] text-zinc-500">
                Press Enter to send
              </span>
              <button
                onClick={() => handleSendQuery()}
                disabled={!symptomInput.trim() || isTyping}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white transition-transform hover:scale-105 active:scale-95 disabled:opacity-35"
                aria-label="Send symptom description"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Prompt Chips */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mr-1">
              Quick:
            </span>
            {[
              "I have a fever",
              "I have a headache",
              "I feel chest pain",
              "I have a cough",
            ].map((chip) => (
              <button
                key={chip}
                onClick={() => handleSendQuery(chip)}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all ${
                  chip.includes("chest pain")
                    ? "border-red-800/80 bg-red-950/60 text-red-300 hover:bg-red-900/60"
                    : "border-zinc-800 bg-zinc-900/90 text-zinc-300 hover:border-blue-500/60 hover:text-blue-400"
                }`}
              >
                {chip}
              </button>
            ))}
          </div>

          <p className="text-[10px] text-zinc-500 text-center pt-0.5">
            This is not a substitute for professional medical advice.
          </p>
        </div>

        {/* Right Column: Quick Access & Priority Card (5 of 12 cols) */}
        <div className="lg:col-span-5 space-y-3.5">
          {/* Quick Access Card */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950 p-4 shadow-md space-y-2">
            <h3 className="text-xs sm:text-sm font-bold text-white">
              Quick Access
            </h3>
            <div className="space-y-1.5">
              {/* Nearby Clinics */}
              <Link
                href="/clinics"
                className="group flex items-center justify-between rounded-lg p-2 transition hover:bg-zinc-900/80"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-950/70 border border-teal-800/40 text-teal-400 shadow-2xs">
                    <MapPin className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white group-hover:text-teal-400 transition-colors">
                      Nearby Clinics
                    </h4>
                    <p className="text-[10px] text-zinc-400">
                      Find clinics within your area
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-zinc-600 group-hover:text-teal-400 transition-transform group-hover:translate-x-0.5" />
              </Link>

              {/* Emergency Numbers */}
              <Link
                href="/emergency"
                className="group flex items-center justify-between rounded-lg p-2 transition hover:bg-zinc-900/80"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-950/70 border border-rose-800/40 text-rose-400 shadow-2xs">
                    <PhoneCall className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white group-hover:text-rose-400 transition-colors">
                      Emergency Numbers
                    </h4>
                    <p className="text-[10px] text-zinc-400">
                      Ambulance, fire, police (112)
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-zinc-600 group-hover:text-rose-400 transition-transform group-hover:translate-x-0.5" />
              </Link>

              {/* My Health Records */}
              <Link
                href="/history"
                className="group flex items-center justify-between rounded-lg p-2 transition hover:bg-zinc-900/80"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-950/70 border border-blue-800/40 text-blue-400 shadow-2xs">
                    <FileText className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors">
                      My Health Records
                    </h4>
                    <p className="text-[10px] text-zinc-400">
                      View your past consultations
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-zinc-600 group-hover:text-blue-400 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>

          {/* "Your Health, Our Priority" Trust Banner */}
          <div className="rounded-2xl border border-teal-900/60 bg-gradient-to-br from-teal-950/40 via-zinc-950 to-emerald-950/30 p-3.5 sm:p-4 shadow-md space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-white shadow-xs shadow-teal-600/30">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-teal-200">
                  Your Health, Our Priority
                </h4>
                <p className="text-[10px] text-teal-400">
                  Secure. Reliable. Always available.
                </p>
              </div>
            </div>
            <p className="text-[11px] text-zinc-300 leading-snug">
              Every Clinix assessment is screened by clinician-reviewed rules and guarded by emergency escalation protocols.
            </p>
            <div>
              <button
                onClick={() => setShowLearnMoreModal(true)}
                className="rounded-lg border border-teal-800/70 bg-zinc-900/90 px-3 py-1 text-[11px] font-bold text-teal-300 hover:bg-zinc-800 shadow-xs transition-colors"
              >
                Learn More
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. COMPACT BOTTOM TRUST / PILLARS BAR (4 Columns) */}
      <section className="rounded-xl border border-zinc-800/80 bg-zinc-950 px-4 py-3 shadow-md">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-left divide-y sm:divide-y-0 lg:divide-x divide-zinc-900">
          {/* Pillar 1 */}
          <div className="flex items-center gap-2.5 pr-2 pt-1 sm:pt-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-950/70 border border-blue-800/40 text-blue-400">
              <Brain className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">
                AI-Powered
              </h4>
              <p className="text-[10px] text-zinc-400">
                Accurate insights
              </p>
            </div>
          </div>

          {/* Pillar 2 */}
          <div className="flex items-center gap-2.5 px-0 lg:px-3 pt-1 sm:pt-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-950/70 border border-blue-800/40 text-blue-400">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">
                Local Care
              </h4>
              <p className="text-[10px] text-zinc-400">
                Real clinics & care
              </p>
            </div>
          </div>

          {/* Pillar 3 */}
          <div className="flex items-center gap-2.5 px-0 lg:px-3 pt-1 sm:pt-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-950/70 border border-blue-800/40 text-blue-400">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">
                Fast Response
              </h4>
              <p className="text-[10px] text-zinc-400">
                Seconds count
              </p>
            </div>
          </div>

          {/* Pillar 4 */}
          <div className="flex items-center gap-2.5 pl-0 lg:pl-3 pt-1 sm:pt-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-950/70 border border-blue-800/40 text-blue-400">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">
                Privacy First
              </h4>
              <p className="text-[10px] text-zinc-400">
                Data stays yours
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

      {/* Emergency Alert Modal */}
      {showEmergencyModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-label="Urgent Emergency Warning"
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-red-900 bg-zinc-950 p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-2.5 border-b border-red-900/60">
              <div className="flex items-center gap-2 text-red-500">
                <AlertCircle className="h-5 w-5 animate-bounce" />
                <h3 className="text-sm font-black uppercase tracking-wider text-red-500">
                  Immediate Emergency Warning
                </h3>
              </div>
              <button
                onClick={() => setShowEmergencyModal(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-900 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="py-3 space-y-2.5">
              <p className="text-xs sm:text-sm font-bold text-white">
                Symptoms of chest pain, shortness of breath, or sudden weakness can indicate a life-threatening medical emergency.
              </p>
              <p className="text-[11px] text-zinc-300 leading-relaxed">
                Do not wait for an automated chat questionnaire. Please reach emergency medical dispatchers or visit the nearest emergency facility immediately.
              </p>
              <div className="rounded-xl bg-red-950/60 p-3 border border-red-900/80 text-center space-y-1.5">
                <span className="text-[11px] font-semibold text-red-300">
                  Ghana National Ambulance Service
                </span>
                <div>
                  <a
                    href="tel:112"
                    className="inline-flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 px-5 py-2.5 text-xs font-black text-white shadow-lg shadow-red-600/40"
                  >
                    <PhoneCall className="h-3.5 w-3.5 animate-bounce" />
                    <span>Dial 112 Directly</span>
                  </a>
                </div>
              </div>
            </div>
            <div className="pt-1 flex justify-end">
              <button
                onClick={() => setShowEmergencyModal(false)}
                className="text-[11px] text-zinc-400 hover:text-white font-semibold"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-label="Clinix Security and Clinical Governance"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
              <div className="flex items-center gap-2 text-teal-400">
                <ShieldCheck className="h-4 w-4" />
                <h3 className="text-sm font-bold text-white">
                  Security & Safety Architecture
                </h3>
              </div>
              <button
                onClick={() => setShowLearnMoreModal(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-900 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2 text-[11px] text-zinc-300 leading-relaxed">
              <p>
                <strong>Clinix</strong> is engineered to enterprise healthcare standards:
              </p>
              <ul className="list-disc pl-4 space-y-1">
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
            <div className="pt-1 flex justify-end gap-2">
              <Link
                href="/privacy"
                onClick={() => setShowLearnMoreModal(false)}
                className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 hover:bg-zinc-800"
              >
                Read Privacy Policy
              </Link>
              <button
                onClick={() => setShowLearnMoreModal(false)}
                className="rounded-lg bg-teal-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-teal-500 shadow-xs shadow-teal-600/30"
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
