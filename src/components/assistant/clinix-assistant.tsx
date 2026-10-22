"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  HeartPulse,
  Send,
  PhoneCall,
  MapPin,
  Pill,
  RotateCcw,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Clock,
  ExternalLink,
  ChevronRight,
  Info,
  CheckCircle2,
  Plus,
  X,
  FileText,
  BookmarkCheck,
  Activity,
  Stethoscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ConsentModal } from "@/components/consent/consent-modal";
import { AssessmentResultCard } from "@/components/assistant/AssessmentResultCard";
import { HealthcareFinderWidget } from "@/components/chat/healthcare-finder-widget";
import {
  StructuredAssistantResponse,
  FollowUpQuestion,
  AssistantAction,
} from "@/lib/assistant/schemas";

interface MessageItem {
  id: string;
  role: "patient" | "assistant" | "system";
  content: string;
  responseType?: string;
  intent?: string;
  structuredPayload?: StructuredAssistantResponse;
  /** Parsed assessment data for rich result rendering */
  assessmentData?: {
    summary: string;
    urgency: "emergency" | "urgent" | "routine" | "self_care_eligible" | "insufficient_information";
    possibleConditions: Array<{ name: string; explanation: string; supportingSymptoms?: string[]; missingInformation?: string[] }>;
    recommendedNextSteps: string[];
    suggestedOTCDrugs: Array<{ name: string; purpose: string; warning: string }>;
    limitations: string[];
  };
  createdAt: string;
}

interface ConversationItem {
  id: string;
  title: string;
  status: string;
  currentState: string;
  lastActiveAt: string;
}

const QUICK_PROMPTS = [
  "I have a fever and body aches since yesterday",
  "Can I take paracetamol with ibuprofen?",
  "Find a clinic near me in Accra",
  "Stomach pain and nausea this morning",
];

const CONCLUDE_PROMPT = "I've answered enough — please give me your assessment now.";

export function ClinixAssistant() {
  const router = useRouter();
  const { data: session } = useSession();

  // Active conversation state
  const [conversationId, setConversationId] = React.useState<string | null>(null);
  const [currentState, setCurrentState] = React.useState<string>("idle");
  const [messages, setMessages] = React.useState<MessageItem[]>([]);
  const [activeAssessmentId, setActiveAssessmentId] = React.useState<string | null>(null);
  const [patientTurnCount, setPatientTurnCount] = React.useState(0);

  // Input & sending
  const [inputText, setInputText] = React.useState("");
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [unsentMessage, setUnsentMessage] = React.useState<string | null>(null);

  // History & drawer
  const [conversations, setConversations] = React.useState<ConversationItem[]>([]);
  const [showHistoryDrawer, setShowHistoryDrawer] = React.useState(false);
  const [loadingHistory, setLoadingHistory] = React.useState(false);

  // Alerts & Errors
  const [errorState, setErrorState] = React.useState<{
    message: string;
    safeAction?: string;
  } | null>(null);
  const [isEmergencyEscalated, setIsEmergencyEscalated] = React.useState(false);
  const [savedSuccessMessage, setSavedSuccessMessage] = React.useState<string | null>(null);

  // Consent modal
  const [hasConsented, setHasConsented] = React.useState(false);
  const [showConsentModal, setShowConsentModal] = React.useState(false);

  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages or typing
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  // Load initial conversation or create one
  React.useEffect(() => {
    initializeAssistant();
  }, []);

  async function initializeAssistant() {
    try {
      // 1. Fetch user/guest conversations to resume latest if active
      const res = await fetch("/api/v1/assistant/conversations");
      if (res.ok) {
        const json = await res.json();
        if (json.data && json.data.length > 0) {
          setConversations(json.data);
          const active = json.data.find((c: ConversationItem) => c.status === "active");
          if (active) {
            await loadConversation(active.id);
            return;
          }
        }
      }

      // 2. Otherwise start a new conversation
      await startNewConversation();
    } catch {
      await startNewConversation();
    }
  }

  async function startNewConversation() {
    setIsProcessing(true);
    setErrorState(null);
    setIsEmergencyEscalated(false);
    setActiveAssessmentId(null);
    setPatientTurnCount(0);

    try {
      const res = await fetch("/api/v1/assistant/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Health Inquiry" }),
      });

      if (res.ok) {
        const json = await res.json();
        const newId = json.data.id;
        setConversationId(newId);
        setCurrentState(json.data.currentState || "idle");

        // Set initial welcoming assistant message
        setMessages([
          {
            id: `welcome-${Date.now()}`,
            role: "assistant",
            content:
              "Hello! I am your Clinix Health Assistant. Describe what you are experiencing in your own words, ask a question about medication, or find nearby healthcare facilities. I am here to help you understand possible explanations and navigate care safely.",
            createdAt: new Date().toISOString(),
          },
        ]);
      } else {
        setErrorState({
          message: "Could not initialize consultation session. Please check your network connection.",
          safeAction: "If you are in distress, dial 112 immediately.",
        });
      }
    } catch {
      setErrorState({
        message: "Failed to connect to the Clinix service.",
        safeAction: "If this is an emergency, dial 112 immediately.",
      });
    } finally {
      setIsProcessing(false);
    }
  }

  async function loadConversation(id: string) {
    setIsProcessing(true);
    setErrorState(null);
    try {
      const res = await fetch(`/api/v1/assistant/conversations/${id}`);
      if (res.ok) {
        const json = await res.json();
        setConversationId(json.data.conversation.id);
        setCurrentState(json.data.conversation.currentState);
        setActiveAssessmentId(json.data.conversation.assessmentId || null);

        if (json.data.conversation.currentState === "escalated" || json.data.conversation.status === "emergency") {
          setIsEmergencyEscalated(true);
        }

        const formattedMessages: MessageItem[] = json.data.messages.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          responseType: m.responseType,
          intent: m.intent,
          structuredPayload: m.structuredPayload,
          assessmentData: m.structuredPayload?.assessmentDetails ?? undefined,
          createdAt: m.createdAt,
        }));

        setMessages(
          formattedMessages.length > 0
            ? formattedMessages
            : [
                {
                  id: `init-${Date.now()}`,
                  role: "assistant",
                  content:
                    "Welcome back. Tell me what is concerning you today, and I will help guide you toward the right care.",
                  createdAt: new Date().toISOString(),
                },
              ]
        );
        setShowHistoryDrawer(false);
      }
    } catch {
      setErrorState({
        message: "Failed to load conversation history.",
      });
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleSendMessage(textToSend?: string) {
    const text = (textToSend || inputText).trim();
    if (!text || isProcessing) return;

    if (!hasConsented && messages.length <= 1) {
      setShowConsentModal(true);
      return;
    }

    let targetConvId = conversationId;
    if (!targetConvId) {
      await startNewConversation();
      return;
    }

    const clientMsgId = `cli_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newPatientMsg: MessageItem = {
      id: clientMsgId,
      role: "patient",
      content: text,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, newPatientMsg]);
    setInputText("");
    setIsProcessing(true);
    setErrorState(null);
    setUnsentMessage(null);
    setPatientTurnCount((c) => c + 1);

    try {
      const res = await fetch(`/api/v1/assistant/conversations/${targetConvId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          clientMessageId: clientMsgId,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error?.message || "Server was unable to process message.");
      }

      const turnData = json.data;
      const respPayload: StructuredAssistantResponse = turnData.response;

      setCurrentState(turnData.currentState);
      if (turnData.assessmentId) {
        setActiveAssessmentId(turnData.assessmentId);
      }

      if (turnData.currentState === "escalated" || respPayload.safety?.urgentPathwayTriggered) {
        setIsEmergencyEscalated(true);
      }

      const newAssistantMsg: MessageItem = {
        id: `asst_${Date.now()}`,
        role: "assistant",
        content: respPayload.message,
        responseType: respPayload.followUpQuestion ? "follow_up_question" : "message",
        intent: respPayload.intent,
        structuredPayload: respPayload,
        assessmentData: turnData.assessmentDetails ?? respPayload.assessmentDetails ?? undefined,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, newAssistantMsg]);
    } catch (err: unknown) {
      console.error("[ASSISTANT UI ERROR]", err);
      setUnsentMessage(text);
      setErrorState({
        message: err instanceof Error ? err.message : "Failed to receive response from Clinix assistant.",
        safeAction: "If you have severe or worsening symptoms, call 112 immediately or visit the nearest clinic.",
      });
    } finally {
      setIsProcessing(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  async function handleSaveAssessment() {
    if (!activeAssessmentId) return;
    if (!session?.user) {
      router.push(`/login?callbackUrl=/assistant`);
      return;
    }

    try {
      const res = await fetch(`/api/v1/assistant/assessments/${activeAssessmentId}/save`, {
        method: "POST",
      });
      if (res.ok) {
        setSavedSuccessMessage("Assessment successfully saved to your health history!");
        setTimeout(() => setSavedSuccessMessage(null), 4000);
      } else {
        const json = await res.json();
        setErrorState({ message: json.error?.message || "Could not save assessment." });
      }
    } catch {
      setErrorState({ message: "Network error while saving assessment." });
    }
  }

  async function refreshHistoryList() {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/v1/assistant/conversations");
      if (res.ok) {
        const json = await res.json();
        setConversations(json.data || []);
      }
    } finally {
      setLoadingHistory(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-5xl mx-auto bg-slate-50 dark:bg-slate-950 border-x border-slate-200 dark:border-slate-800">
      {/* 1. Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm">
            <HeartPulse className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Clinix Assistant
              </h1>
              <Badge variant="outline" className="border-teal-500/40 text-teal-700 dark:text-teal-300 text-xs gap-1">
                <ShieldCheck className="h-3 w-3 text-teal-600" />
                Clinical Safety Active
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              Guidance & care navigation · Non-diagnostic health information
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowHistoryDrawer(!showHistoryDrawer);
              if (!showHistoryDrawer) refreshHistoryList();
            }}
            className="text-xs gap-1.5"
            aria-label="View previous conversations"
          >
            <Clock className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">History</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={startNewConversation}
            className="text-xs gap-1.5 border-teal-600/30 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40"
            aria-label="Start new consultation"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New Chat</span>
          </Button>
        </div>
      </div>

      {/* 2. Emergency Escalation Banner */}
      {isEmergencyEscalated && (
        <div
          role="alert"
          aria-live="assertive"
          className="bg-red-600 text-white px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0 shadow-md animate-in fade-in"
        >
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 shrink-0 text-red-100" />
            <div>
              <p className="text-sm font-bold">EMERGENCY PROTOCOL ACTIVATED</p>
              <p className="text-xs text-red-100">
                Critical warning signs reported. Do not rely on chat. Call emergency services immediately.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <a
              href="tel:112"
              className="flex items-center justify-center gap-2 w-full sm:w-auto bg-white text-red-700 hover:bg-red-50 font-bold px-4 py-2 rounded-lg text-sm shadow transition"
            >
              <PhoneCall className="h-4 w-4" />
              Call 112 Now
            </a>
            <Link
              href="/clinics?type=emergency_department"
              className="hidden sm:flex items-center gap-1.5 bg-red-700 hover:bg-red-800 text-white font-semibold px-3 py-2 rounded-lg text-xs"
            >
              <MapPin className="h-3.5 w-3.5" />
              Nearest ER
            </Link>
          </div>
        </div>
      )}

      {/* 3. Main Conversation Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isPatient = msg.role === "patient";
          const isEmergency = msg.responseType === "emergency_alert" || msg.structuredPayload?.safety?.urgentPathwayTriggered;
          const followUp = msg.structuredPayload?.followUpQuestion;
          const actions = msg.structuredPayload?.actions || [];
          const sources = msg.structuredPayload?.sources || [];
          const isAssessmentResult = msg.intent === "symptom_assessment" && msg.responseType === "assessment_result";

          // Extract structured assessment data from actions for AssessmentResultCard
          const nearbyClinicLinks = actions
            .filter((a) => a.id.startsWith("nearby_clinic_") && a.target)
            .map((a) => ({ label: a.label, href: a.target! }));

          const details = msg.assessmentData || msg.structuredPayload?.assessmentDetails;
          const hasAssessmentDetails = Boolean(
            details && (details.possibleConditions?.length > 0 || details.summary)
          );

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isPatient ? "items-end" : "items-start"} max-w-[85%] sm:max-w-[78%] ${
                isPatient ? "ml-auto" : "mr-auto"
              }`}
            >
              <div
                className={`p-3.5 rounded-2xl text-sm leading-relaxed ${
                  isPatient
                    ? "bg-teal-600 text-white rounded-br-xs shadow-sm"
                    : isEmergency
                    ? "bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-100 border-2 border-red-500 rounded-bl-xs shadow-sm"
                    : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-bl-xs shadow-xs"
                } w-full`}
              >
                {/* Emergency Header if applicable */}
                {isEmergency && (
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold mb-2 text-xs uppercase tracking-wide">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Urgent Clinical Guidance
                  </div>
                )}

                {/* Main Message Body — rendered as Markdown for assistant, plain text for patient */}
                {isPatient ? (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                ) : hasAssessmentDetails && msg.structuredPayload?.state === "presenting_result" ? (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-800 dark:text-slate-200 font-medium">
                      Based on your responses, I have completed the symptom analysis. Here is the evaluation, potential causes, relief options, and nearby healthcare facilities:
                    </p>
                    <AssessmentResultCard
                      summary={details!.summary}
                      urgency={details!.urgency as any}
                      possibleConditions={details!.possibleConditions}
                      recommendedNextSteps={details!.recommendedNextSteps}
                      suggestedOTCDrugs={details!.suggestedOTCDrugs}
                      limitations={details!.limitations}
                      nearbyClinicLinks={nearbyClinicLinks}
                    />
                  </div>
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-1.5 prose-strong:text-slate-900 dark:prose-strong:text-white">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}

                {/* Healthcare Facility Discovery Widget */}
                {!isPatient &&
                  (msg.intent === "clinic_search" ||
                    msg.structuredPayload?.clinicSearchPrompt?.active ||
                    (msg.structuredPayload?.facilityResults && msg.structuredPayload.facilityResults.length > 0)) && (
                    <div className="mt-3.5">
                      <HealthcareFinderWidget
                        initialFacilities={msg.structuredPayload?.facilityResults || []}
                        initialLocationName={msg.structuredPayload?.clinicSearchPrompt?.detectedLocationName}
                        defaultRadiusMeters={msg.structuredPayload?.clinicSearchPrompt?.defaultRadiusMeters || 5000}
                      />
                    </div>
                  )}



                {/* Action Buttons */}
                {actions.filter((a) => !a.id.startsWith("nearby_clinic_")).length > 0 && (
                  <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap gap-2">
                    {actions
                      .filter((a) => !a.id.startsWith("nearby_clinic_"))
                      .map((act) => {
                        if (act.type === "link" && act.target) {
                          return (
                            <Link
                              key={act.id}
                              href={act.target}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                            >
                              <ExternalLink className="h-3.5 w-3.5 text-teal-600" />
                              {act.label}
                            </Link>
                          );
                        }
                        if (act.type === "call" && act.target) {
                          return (
                            <a
                              key={act.id}
                              href={act.target}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-red-600 text-white hover:bg-red-700 shadow-xs transition"
                            >
                              <PhoneCall className="h-3.5 w-3.5" />
                              {act.label}
                            </a>
                          );
                        }
                        if (act.target === "save_assessment") {
                          return (
                            <React.Fragment key={act.id}>
                              <button
                                type="button"
                                onClick={handleSaveAssessment}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-800 hover:bg-teal-100 transition cursor-pointer"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                {act.label}
                              </button>
                              {conversationId && (
                                <Link
                                  href={`/symptom-checker?conversationId=${conversationId}`}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800 hover:bg-blue-100 transition"
                                >
                                  <Stethoscope className="h-3.5 w-3.5" />
                                  Full Clinical Assessment →
                                </Link>
                              )}
                            </React.Fragment>
                          );
                        }
                        if (act.target === "new_conversation") {
                          return (
                            <button
                              key={act.id}
                              type="button"
                              onClick={startNewConversation}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition cursor-pointer"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              {act.label}
                            </button>
                          );
                        }
                        return null;
                      })}
                  </div>
                )}

                {/* Sources Attribution */}
                {sources.length > 0 && (
                  <div className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
                    Source: {sources.map((s) => s.title).join(", ")}
                  </div>
                )}
              </div>

              {/* Timestamp */}
              <span className="text-[10px] text-slate-400 mt-1 px-1">
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          );
        })}

        {/* Typing indicator */}
        {isProcessing && (
          <div className="flex items-center gap-2 px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-bl-xs shadow-xs max-w-[160px] animate-in fade-in duration-150">
            <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Thinking</span>
            <span className="flex gap-0.5 items-center ml-0.5">
              <span className="h-1 w-1 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce [animation-delay:-0.3s]" />
              <span className="h-1 w-1 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce [animation-delay:-0.15s]" />
              <span className="h-1 w-1 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce" />
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 4. Notification Alerts (Saved success, errors) */}
      {savedSuccessMessage && (
        <div className="mx-4 mb-2 p-2.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookmarkCheck className="h-4 w-4 text-teal-600" />
            <span>{savedSuccessMessage}</span>
          </div>
          <Link href="/history" className="font-semibold underline ml-2">
            View Records
          </Link>
        </div>
      )}

      {errorState && (
        <div className="mx-4 mb-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100 text-xs space-y-1.5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>{errorState.message}</span>
            </div>
            {unsentMessage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSendMessage(unsentMessage)}
                className="h-7 text-xs px-2.5 ml-2"
              >
                Retry
              </Button>
            )}
          </div>
          {errorState.safeAction && (
            <p className="text-[11px] text-amber-800 dark:text-amber-200 pl-6">
              {errorState.safeAction}
            </p>
          )}
        </div>
      )}

      {/* 5. Quick Prompts (if chat has 1 or fewer turns) */}
      {messages.length <= 2 && (
        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 overflow-x-auto">
          <p className="text-[11px] font-semibold text-slate-400 mb-1.5">Common questions to get started:</p>
          <div className="flex gap-2">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleSendMessage(prompt)}
                className="whitespace-nowrap px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs hover:bg-teal-50 dark:hover:bg-teal-950/50 hover:text-teal-700 hover:border-teal-300 border border-transparent transition cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 5b. During symptom assessment — progress indicator + "Conclude" chip */}
      {currentState === "asking_questions" && messages.length > 2 && (
        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-800 bg-teal-50/60 dark:bg-teal-950/20">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-teal-700 dark:text-teal-400 font-medium flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              Assessment in progress — answering questions helps me give better guidance
            </p>
            <button
              type="button"
              onClick={() => handleSendMessage(CONCLUDE_PROMPT)}
              disabled={isProcessing}
              className="whitespace-nowrap px-3 py-1 rounded-full bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 text-[11px] font-semibold border border-teal-300 dark:border-teal-700 hover:bg-teal-200 transition cursor-pointer disabled:opacity-40"
            >
              Get assessment now →
            </button>
          </div>
        </div>
      )}

      {/* 6. Input Form */}
      <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-end gap-2"
        >
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={2000}
              placeholder="Describe your symptoms, ask about medication, or find a clinic..."
              className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white dark:focus:bg-slate-900 transition"
              aria-label="Describe what you are experiencing"
              disabled={isProcessing}
            />
            {inputText.length > 1500 && (
              <span className="absolute right-2 bottom-2 text-[10px] text-slate-400">
                {2000 - inputText.length} left
              </span>
            )}
          </div>

          <Button
            type="submit"
            disabled={!inputText.trim() || isProcessing}
            className="h-11 w-11 shrink-0 rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-xs p-0 flex items-center justify-center transition disabled:opacity-50"
            aria-label="Send message"
          >
            {isProcessing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </form>

        <p className="text-[10px] text-slate-400 text-center mt-2">
          Clinix is an informational assistant and does not replace medical advice. In an emergency, dial 112 immediately.
        </p>
      </div>

      {/* 7. History Drawer */}
      {showHistoryDrawer && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full p-4 flex flex-col shadow-xl animate-in slide-in-from-right">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-teal-600" />
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Past Consultations
                </h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistoryDrawer(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-2">
              {loadingHistory ? (
                <div className="flex justify-center p-6">
                  <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
                </div>
              ) : conversations.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  No previous consultations found.
                </p>
              ) : (
                conversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => loadConversation(c.id)}
                    className={`w-full text-left p-3 rounded-xl border transition ${
                      c.id === conversationId
                        ? "border-teal-500 bg-teal-50/50 dark:bg-teal-950/30"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {c.title}
                      </span>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] ${
                          c.status === "emergency"
                            ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                            : c.status === "completed"
                            ? "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {c.status}
                      </Badge>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {new Date(c.lastActiveAt).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button
                onClick={() => {
                  setShowHistoryDrawer(false);
                  startNewConversation();
                }}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white text-xs gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Start Fresh Consultation
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Consent Modal */}
      <ConsentModal
        isOpen={showConsentModal}
        onConsentComplete={(granted: boolean) => {
          setHasConsented(granted);
          setShowConsentModal(false);
          if (granted && inputText.trim()) {
            handleSendMessage();
          }
        }}
      />
    </div>
  );
}
