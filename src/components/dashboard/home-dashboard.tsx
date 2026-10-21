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
  Loader2,
} from "lucide-react";
import { ConsentModal } from "@/components/consent/consent-modal";
import { HealthcareFinderWidget } from "@/components/chat/healthcare-finder-widget";

interface Message {
  id: string;
  sender: "assistant" | "user";
  text: string;
  isEmergency?: boolean;
  urgency?: "emergency" | "urgent" | "routine" | "self_care_eligible" | "insufficient_information";
  followUps?: string[];
  recommendations?: string[];
  possibleCauses?: Array<{
    condition?: string;
    name?: string;
    probability?: string;
    rationale?: string;
    explanation?: string;
  }>;
  redFlags?: string[];
  disclaimer?: string;
  facilityResults?: any[];
  clinicSearchPrompt?: {
    active: boolean;
    defaultRadiusMeters?: number;
    detectedLocationName?: string;
  };
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
  const chatEndRef = React.useRef<HTMLDivElement>(null);

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

  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

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
    if (!text || isTyping) return;

    // Handle quick action links
    if (text.toLowerCase().includes("start a full symptom check")) {
      router.push("/symptom-checker");
      return;
    }
    if (text.toLowerCase().includes("retry sending")) {
      const lastUser = [...messages].reverse().find((m) => m.sender === "user");
      if (lastUser) {
        handleSendQuery(lastUser.text);
      }
      return;
    }

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      sender: "user",
      text,
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setSymptomInput("");
    setIsTyping(true);

    // Rule-based Emergency Screening (Client Fast-Gate)
    const lower = text.toLowerCase();
    const isEmergency =
      lower.includes("chest pain") ||
      lower.includes("heart attack") ||
      lower.includes("can't breathe") ||
      lower.includes("cant breathe") ||
      lower.includes("shortness of breath") ||
      lower.includes("stroke") ||
      lower.includes("severe bleeding") ||
      lower.includes("unconscious") ||
      lower.includes("thunderclap") ||
      lower.includes("worst headache of my life") ||
      lower.includes("worst headache") ||
      (lower.includes("stiff neck") && (lower.includes("fever") || lower.includes("vomit"))) ||
      lower.includes("slurred speech") ||
      lower.includes("facial droop") ||
      lower.includes("arm weakness");

    if (isEmergency) {
      setTimeout(() => {
        setIsTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            sender: "assistant",
            isEmergency: true,
            urgency: "emergency",
            text: "EMERGENCY WARNING: Severe symptoms like chest pain, severe breathing difficulty, sudden thunderclap headache, stiff neck with fever, or signs of stroke require immediate in-person emergency care. Please do not wait for an automated chat. Call emergency dispatch immediately.",
            redFlags: [
              "Sudden explosive onset ('thunderclap') or progressive neurological deficit",
              "Stiff neck accompanied by fever, vomiting, or altered mental state",
              "Chest tightness, shortness of breath, or loss of consciousness",
            ],
            recommendations: [
              "Call 112 immediately or proceed to the nearest emergency facility.",
              "Do not attempt to drive yourself if experiencing acute distress or neurological symptoms.",
            ],
            disclaimer: "Emergency protocols activated. Immediate in-person medical care is required.",
          },
        ]);
        setShowEmergencyModal(true);
      }, 250);
      return;
    }

    // Accumulate clinical symptoms context across multi-turn queries
    const priorUserTexts = messages.filter((m) => m.sender === "user").map((m) => m.text);
    const cumulativeSymptoms =
      priorUserTexts.length > 0 ? `${priorUserTexts.join(". ")}. Current update: ${text}` : text;

    // Prepare conversation history matching API schema (prior turns)
    const conversationHistory = messages
      .filter((m) => m.id !== "m-0")
      .map((m) => ({
        role: m.sender === "user" ? ("patient" as const) : ("assistant" as const),
        content: m.text,
      }));

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          symptoms: cumulativeSymptoms,
          conversationHistory,
        }),
      });

      const json = await res.json();
      setIsTyping(false);

      if (res.ok && json.data) {
        const data = json.data;
        const urgency = data.urgencyLevel || data.urgency;
        const isEmerg = urgency === "emergency";
        const replyText =
          data.message ||
          data.reply ||
          data.summary ||
          "I have assessed your symptoms against clinical safety and triage protocols.";

        // Clean conditions: require non-empty condition or name
        const rawCauses = data.possibleCauses || data.possibleConditions || [];
        const validCauses = Array.isArray(rawCauses)
          ? rawCauses
              .filter((c: any) => Boolean((c.name || c.condition)?.trim()))
              .map((c: any) => ({
                condition: (c.condition || c.name || "").trim(),
                name: (c.name || c.condition || "").trim(),
                explanation: (c.explanation || c.rationale || "").trim(),
                probability: c.probability,
              }))
          : [];

        // Clean recommendations
        const rawRecs = data.nextSteps || data.recommendedNextSteps || [];
        const validRecs = Array.isArray(rawRecs)
          ? rawRecs.filter((r: any) => typeof r === "string" && r.trim().length > 0)
          : [];

        // Clean follow-ups
        const rawFollowUps = data.followUpQuestions || [];
        const validFollowUps = Array.isArray(rawFollowUps)
          ? rawFollowUps.filter((q: any) => typeof q === "string" && q.trim().length > 0)
          : [];

        // Clean red flags
        const rawRedFlags = data.redFlags || [];
        const validRedFlags = Array.isArray(rawRedFlags)
          ? rawRedFlags.filter((f: any) => typeof f === "string" && f.trim().length > 0)
          : [];

        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            sender: "assistant",
            text: replyText,
            isEmergency: isEmerg,
            urgency,
            followUps: validFollowUps,
            recommendations: validRecs,
            possibleCauses: validCauses,
            redFlags: validRedFlags,
            disclaimer: data.disclaimer,
            facilityResults: data.facilityResults,
            clinicSearchPrompt: data.clinicSearchPrompt,
          },
        ]);

        if (isEmerg) {
          setShowEmergencyModal(true);
        }
      } else {
        const fallbackText =
          json.error?.message ||
          "We couldn't connect to the health assistant right now. If you are experiencing severe or worsening symptoms, please call 112 immediately or visit the nearest healthcare facility.";
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            sender: "assistant",
            text: fallbackText,
            recommendations: [
              "If your symptoms are severe or distressing, call 112 immediately.",
              "You can retry sending your message or start a full structured symptom check.",
            ],
            followUps: ["Retry sending my message", "Start a full symptom check"],
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
          text: "Network connection was interrupted. If you have an urgent medical concern, call 112 immediately.",
          recommendations: [
            "Check your internet connection and try sending your message again.",
            "If in distress, call emergency services directly.",
          ],
          followUps: ["Retry sending my message"],
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
        <div className="lg:col-span-7 rounded-2xl border border-zinc-800/80 bg-zinc-950 p-4 sm:p-5 shadow-md flex flex-col justify-between min-h-[490px] space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-950/70 border border-blue-800/50 text-blue-400">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <h2 className="text-sm font-bold text-white">
                Your Health Assistant
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/assistant"
                className="text-[11px] font-semibold text-teal-400 hover:text-teal-300 flex items-center gap-1 bg-teal-950/60 border border-teal-800/40 px-2 py-0.5 rounded-full transition"
              >
                Open Full Assistant <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* Conversational Stream */}
          <div
            className="space-y-3 min-h-[300px] max-h-[460px] overflow-y-auto pr-1.5 scroll-smooth flex-1"
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
                  className={`max-w-[88%] rounded-xl p-3 sm:p-3.5 text-xs sm:text-[13px] leading-relaxed space-y-2.5 break-words whitespace-pre-wrap ${
                    msg.isEmergency
                      ? "bg-red-950/70 text-red-100 border border-red-800/80 font-medium"
                      : msg.sender === "user"
                      ? "bg-blue-600 text-white rounded-br-xs"
                      : "bg-zinc-900 text-zinc-200 border border-zinc-800/80 rounded-tl-xs"
                  }`}
                >
                  {/* Urgency Badge */}
                  {msg.urgency && (
                    <div className="flex items-center gap-1.5 pb-0.5">
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          msg.urgency === "emergency"
                            ? "bg-red-900/80 border-red-700 text-red-200"
                            : msg.urgency === "urgent"
                            ? "bg-amber-950/80 border-amber-800 text-amber-300"
                            : msg.urgency === "routine"
                            ? "bg-blue-950/80 border-blue-800 text-blue-300"
                            : msg.urgency === "self_care_eligible"
                            ? "bg-emerald-950/80 border-emerald-800 text-emerald-300"
                            : "bg-zinc-800 border-zinc-700 text-zinc-300"
                        }`}
                      >
                        {msg.urgency === "emergency" && "Emergency Action Required"}
                        {msg.urgency === "urgent" && "Urgent Care Recommended"}
                        {msg.urgency === "routine" && "Scheduled Evaluation"}
                        {msg.urgency === "self_care_eligible" && "Self-Care Eligible"}
                        {msg.urgency === "insufficient_information" && "Clinical Triage Inquiry"}
                      </span>
                    </div>
                  )}

                  <p className="text-zinc-200 leading-relaxed font-normal">{msg.text}</p>

                  {/* Warning Signs (Red Flags) — Prominent Emergency Box */}
                  {(() => {
                    const validFlags = (msg.redFlags || []).filter(
                      (f) => typeof f === "string" && f.trim().length > 0
                    );
                    if (validFlags.length === 0) return null;
                    return (
                      <div className="rounded-lg bg-red-950/40 border border-red-800/60 p-2.5 space-y-1.5 animate-in fade-in">
                        <div className="flex items-center gap-1.5 text-red-300 font-semibold text-[11px]">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                          <span>When to Seek Immediate Emergency Care:</span>
                        </div>
                        <ul className="list-disc list-inside text-[11px] text-red-200/90 space-y-1 pl-0.5">
                          {validFlags.map((flag, idx) => (
                            <li key={idx} className="leading-snug">{flag}</li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}

                  {/* Possible Considerations (Differential) — only rendered when valid non-empty items exist */}
                  {(() => {
                    const validCauses = (msg.possibleCauses || []).filter(
                      (cause) => Boolean((cause.condition || cause.name)?.trim())
                    );
                    if (validCauses.length === 0) return null;
                    return (
                      <div className="rounded-lg bg-black/60 p-2.5 border border-zinc-800/80 space-y-2 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                            Possible Considerations (Differential):
                          </span>
                          <span className="text-[9px] text-zinc-500 italic">Non-diagnostic</span>
                        </div>
                        <div className="space-y-1.5">
                          {validCauses.slice(0, 3).map((cause, idx) => {
                            const title = (cause.condition || cause.name || "").trim();
                            const explanation = (cause.explanation || cause.rationale || "").trim();
                            return (
                              <div
                                key={idx}
                                className="text-[11px] space-y-0.5 border-b border-zinc-800/40 pb-1.5 last:border-b-0 last:pb-0"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-zinc-200 font-semibold">{title}</span>
                                  {cause.probability && (
                                    <span className="text-[9px] text-zinc-400 capitalize px-1.5 py-0.5 bg-zinc-900 rounded border border-zinc-800">
                                      {cause.probability}
                                    </span>
                                  )}
                                </div>
                                {explanation && (
                                  <p className="text-[10px] text-zinc-400 leading-normal">{explanation}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Recommended Next Steps — only rendered when valid steps exist */}
                  {(() => {
                    const validRecs = (msg.recommendations || []).filter(
                      (rec) => typeof rec === "string" && rec.trim().length > 0
                    );
                    if (validRecs.length === 0) return null;
                    return (
                      <div className="rounded-lg bg-black/40 p-2.5 border border-zinc-800/60 space-y-1.5 animate-in fade-in">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                          Recommended Next Steps:
                        </span>
                        <ul className="list-disc list-inside text-[11px] text-zinc-300 space-y-1">
                          {validRecs.slice(0, 3).map((rec, idx) => (
                            <li key={idx} className="leading-snug">{rec}</li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}

                  {/* Disclaimer notice */}
                  {msg.disclaimer && (
                    <p className="text-[10px] text-zinc-500 italic border-t border-zinc-800/40 pt-1 leading-tight">
                      ⚕️ {msg.disclaimer}
                    </p>
                  )}

                  {/* Healthcare Facilities Discovery Widget */}
                  {msg.sender === "assistant" &&
                    (msg.clinicSearchPrompt?.active ||
                      (msg.facilityResults && msg.facilityResults.length > 0)) && (
                      <div className="pt-2">
                        <HealthcareFinderWidget
                          initialFacilities={msg.facilityResults || []}
                          initialLocationName={msg.clinicSearchPrompt?.detectedLocationName}
                          defaultRadiusMeters={msg.clinicSearchPrompt?.defaultRadiusMeters || 5000}
                        />
                      </div>
                    )}

                  {/* Action buttons & Links */}
                  {msg.isEmergency ? (
                    <div className="pt-1">
                      <a
                        href="tel:112"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 text-white px-3 py-1.5 text-xs font-bold shadow-sm hover:bg-red-500 transition cursor-pointer"
                      >
                        <PhoneCall className="h-3 w-3 animate-bounce" />
                        <span>Dial 112 Emergency Dispatch Now</span>
                      </a>
                    </div>
                  ) : msg.urgency && msg.urgency !== "insufficient_information" ? (
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-zinc-800/60">
                      <Link
                        href="/clinics"
                        className="inline-flex items-center gap-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2 py-1 text-[11px] font-medium transition"
                      >
                        <MapPin className="h-3 w-3 text-teal-400" />
                        <span>Find Nearby Clinics</span>
                      </Link>
                      <Link
                        href="/symptom-checker"
                        className="inline-flex items-center gap-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 text-[11px] font-medium transition"
                      >
                        <Stethoscope className="h-3 w-3" />
                        <span>Full Assessment</span>
                      </Link>
                    </div>
                  ) : null}


                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-2 items-center animate-in fade-in duration-150">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                  <Loader2 className="h-3 w-3 animate-spin" />
                </div>
                <div className="flex items-center gap-1.5 rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300">
                  <span className="font-medium text-zinc-300">Thinking</span>
                  <span className="flex gap-1 items-center ml-0.5">
                    <span className="h-1 w-1 rounded-full bg-zinc-400 animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-1 w-1 rounded-full bg-zinc-400 animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-1 w-1 rounded-full bg-zinc-400 animate-bounce" />
                  </span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
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
