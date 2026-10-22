"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Pill,
  Search,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  PhoneCall,
  UserCheck,
  Info,
  Clock,
  ArrowRight,
  ExternalLink,
  Loader2,
  FileText,
  AlertOctagon,
  Sparkles,
  Bookmark,
  BookmarkCheck,
  Trash2,
  HelpCircle,
  CheckCircle2,
  X,
  Plus,
  Send,
  RotateCcw,
  Flag,
  Share2,
  ChevronRight,
  Layers,
  HeartHandshake,
  Activity,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ApprovedMedication,
  MedicationEvaluationResult,
  MedicationSafetyStatus,
  PregnancyStatus,
  MultiDrugSafetyCheckResult,
  MedicationAiQueryResult,
} from "@/lib/medication/types";
import { TriState } from "@/lib/safety/types";

type ActiveTab = "search" | "guide" | "safety" | "saved" | "ask_ai";

const FEATURED_SEARCH_MEDS = [
  { name: "Paracetamol", label: "Paracetamol", class: "OTC Analgesic" },
  { name: "Ibuprofen", label: "Ibuprofen", class: "OTC NSAID" },
  { name: "Artemether + Lumefantrine", label: "Coartem", class: "POM Antimalarial" },
  { name: "Amoxicillin", label: "Amoxicillin", class: "POM Antibiotic" },
  { name: "Cetirizine", label: "Cetirizine", class: "OTC Antihistamine" },
  { name: "Oral Rehydration Salts (ORS)", label: "ORS", class: "OTC Hydration" },
  { name: "Omeprazole", label: "Omeprazole", class: "OTC / POM Antacid" },
  { name: "Salbutamol", label: "Salbutamol", class: "POM Inhaler" },
  { name: "Ciprofloxacin", label: "Ciprofloxacin", class: "POM Antibacterial" },
  { name: "Metformin", label: "Metformin", class: "POM Antidiabetic" },
  { name: "Amlodipine", label: "Amlodipine", class: "POM Blood Pressure" },
  { name: "Aspirin", label: "Aspirin", class: "Age Caution" },
];

const CATEGORY_FILTERS = [
  { id: "all", label: "All Categories" },
  { id: "analgesic", label: "Pain & Fever" },
  { id: "antibacterial", label: "Antibiotics" },
  { id: "antimalarial", label: "Antimalarial" },
  { id: "antihistamine", label: "Allergy & Cold" },
  { id: "antacid", label: "Digestive & Acidity" },
  { id: "bronchodilator", label: "Respiratory & Asthma" },
  { id: "antihypertensive", label: "Cardiovascular" },
  { id: "antidiabetic", label: "Diabetes" },
];

const FORM_FILTERS = [
  { id: "all", label: "All Forms" },
  { id: "tablet", label: "Tablets" },
  { id: "capsule", label: "Capsules" },
  { id: "syrup", label: "Syrups / Liquids" },
  { id: "inhaler", label: "Inhalers" },
  { id: "suspension", label: "Suspensions" },
];

interface LocalSavedMed {
  id: string;
  medicationId: string;
  genericName: string;
  brandName?: string;
  dosageForm?: string;
  strength?: string;
  therapeuticClass?: string;
  classification?: string;
  notes?: string;
  createdAt: string;
}

export default function MedicationsPage() {
  const { data: session } = useSession();

  // Navigation state
  const [activeTab, setActiveTab] = React.useState<ActiveTab>("search");

  // Search tab state
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedCategory, setSelectedCategory] = React.useState("all");
  const [selectedForm, setSelectedForm] = React.useState("all");
  const [selectedClassification, setSelectedClassification] = React.useState<string>("all");
  const [searchResults, setSearchResults] = React.useState<ApprovedMedication[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);

  // Selected Medication for Guide view
  const [selectedMed, setSelectedMed] = React.useState<ApprovedMedication | null>(null);
  const [activeGuideSection, setActiveGuideSection] = React.useState<string>("overview");

  // Recently viewed medicines (stored in localStorage)
  const [recentlyViewed, setRecentlyViewed] = React.useState<ApprovedMedication[]>([]);

  // Saved medicines state
  const [savedMeds, setSavedMeds] = React.useState<LocalSavedMed[]>([]);
  const [savedLoading, setSavedLoading] = React.useState(false);
  const [editingNoteId, setEditingNoteId] = React.useState<string | null>(null);
  const [tempNoteText, setTempNoteText] = React.useState("");

  // Safety & Interactions Checker State
  const [safetySelectedMeds, setSafetySelectedMeds] = React.useState<string[]>([
    "Paracetamol",
    "Ibuprofen",
  ]);
  const [newMedInput, setNewMedInput] = React.useState("");
  const [safetyAge, setSafetyAge] = React.useState<string>("");
  const [safetyPregnancy, setSafetyPregnancy] = React.useState<PregnancyStatus>("unknown");
  const [safetyBreastfeeding, setSafetyBreastfeeding] = React.useState<string>("unknown");
  const [safetyAllergiesStatus, setSafetyAllergiesStatus] = React.useState<TriState>("unknown");
  const [safetyAllergiesText, setSafetyAllergiesText] = React.useState("");
  const [safetyConditions, setSafetyConditions] = React.useState<string[]>([]);
  const [safetyEvaluating, setSafetyEvaluating] = React.useState(false);
  const [safetyResult, setSafetyResult] = React.useState<MultiDrugSafetyCheckResult | null>(null);
  const [safetyError, setSafetyError] = React.useState<string | null>(null);

  // Ask Clinix AI state
  const [catalogMeds, setCatalogMeds] = React.useState<ApprovedMedication[]>([]);
  const [aiSelectedMed, setAiSelectedMed] = React.useState<ApprovedMedication | null>(null);
  const [aiQuestion, setAiQuestion] = React.useState("");
  const [aiLoading, setAiLoading] = React.useState(false);
  const [aiResponse, setAiResponse] = React.useState<MedicationAiQueryResult | null>(null);
  const [aiChatHistory, setAiChatHistory] = React.useState<
    Array<{ role: "user" | "assistant"; text: string; result?: MedicationAiQueryResult }>
  >([]);

  // Feedback Dialog state
  const [feedbackOpen, setFeedbackOpen] = React.useState(false);
  const [feedbackMed, setFeedbackMed] = React.useState<ApprovedMedication | null>(null);
  const [feedbackType, setFeedbackType] = React.useState<
    "incorrect_information" | "missing_warning" | "dosage_discrepancy" | "side_effect_update" | "general_feedback"
  >("general_feedback");
  const [feedbackDetails, setFeedbackDetails] = React.useState("");
  const [feedbackEmail, setFeedbackEmail] = React.useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = React.useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = React.useState(false);

  // Emergency Modal state
  const [emergencyAlertOpen, setEmergencyAlertOpen] = React.useState(false);
  const [emergencyReason, setEmergencyReason] = React.useState("");

  // Load recently viewed & saved medicines on mount
  React.useEffect(() => {
    try {
      const storedRecent = localStorage.getItem("clinix_recent_meds");
      if (storedRecent) {
        setRecentlyViewed(JSON.parse(storedRecent));
      }
      const storedSaved = localStorage.getItem("clinix_local_saved_meds");
      if (storedSaved) {
        setSavedMeds(JSON.parse(storedSaved));
      }
    } catch {
      // Safe fallback
    }

    // Load server-side saved medicines if authenticated
    if (session?.user?.id) {
      loadServerSavedMeds();
    }

    // Initial search load
    handleSearch("", "all", "all", "all");
  }, [session?.user?.id]);

  const loadServerSavedMeds = async () => {
    try {
      setSavedLoading(true);
      const res = await fetch("/api/medication/saved");
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setSavedMeds(json.data);
          localStorage.setItem("clinix_local_saved_meds", JSON.stringify(json.data));
        }
      }
    } catch {
      // Offline fallback
    } finally {
      setSavedLoading(false);
    }
  };

  const recordRecentlyViewed = (med: ApprovedMedication) => {
    try {
      setRecentlyViewed((prev) => {
        const filtered = prev.filter((m) => m.id !== med.id);
        const updated = [med, ...filtered].slice(0, 6);
        localStorage.setItem("clinix_recent_meds", JSON.stringify(updated));
        return updated;
      });
    } catch {
      // Safe
    }
  };

  // Perform search
  const handleSearch = async (
    q: string = searchQuery,
    cat: string = selectedCategory,
    form: string = selectedForm,
    classification: string = selectedClassification
  ) => {
    setIsSearching(true);
    setSearchError(null);

    try {
      const params = new URLSearchParams();
      if (q.trim()) params.append("q", q.trim());
      if (cat !== "all") params.append("category", cat);
      if (form !== "all") params.append("form", form);
      if (classification !== "all") params.append("classification", classification);

      const res = await fetch(`/api/medication/search?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Search service unavailable. Please try again.");
      }
      const json = await res.json();
      const results = json.data || [];
      setSearchResults(results);

      // Cache complete catalog on first load
      if (catalogMeds.length === 0 && results.length > 0 && !q.trim()) {
        setCatalogMeds(results);
      }

      // Default select the first medication if none selected
      if (!selectedMed && results.length > 0) {
        setSelectedMed(results[0]);
      }
    } catch (err: any) {
      setSearchError(err?.message || "Failed to search medications.");
    } finally {
      setIsSearching(false);
    }
  };

  // Toggle saving medication
  const toggleSaveMedication = async (med: ApprovedMedication) => {
    const isSaved = savedMeds.some((s) => s.medicationId === med.id);

    if (isSaved) {
      // Remove
      setSavedMeds((prev) => {
        const next = prev.filter((s) => s.medicationId !== med.id);
        localStorage.setItem("clinix_local_saved_meds", JSON.stringify(next));
        return next;
      });

      if (session?.user?.id) {
        try {
          await fetch(`/api/medication/saved/${encodeURIComponent(med.id)}`, {
            method: "DELETE",
          });
        } catch {
          // Sync error
        }
      }
    } else {
      // Add
      const newEntry: LocalSavedMed = {
        id: `local-${Date.now()}`,
        medicationId: med.id,
        genericName: med.genericName,
        brandName: med.brandNames[0],
        dosageForm: med.dosageForms?.[0] || med.availableForms?.[0]?.form,
        strength: med.activeIngredients?.[0]?.strength,
        therapeuticClass: med.therapeuticClass,
        classification: med.classification,
        createdAt: new Date().toISOString(),
      };

      setSavedMeds((prev) => {
        const next = [newEntry, ...prev];
        localStorage.setItem("clinix_local_saved_meds", JSON.stringify(next));
        return next;
      });

      if (session?.user?.id) {
        try {
          await fetch("/api/medication/saved", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              medicationId: med.id,
              genericName: med.genericName,
              brandName: med.brandNames[0],
              dosageForm: med.dosageForms?.[0] || med.availableForms?.[0]?.form,
              strength: med.activeIngredients?.[0]?.strength,
              therapeuticClass: med.therapeuticClass,
              classification: med.classification,
            }),
          });
        } catch {
          // Sync error
        }
      }
    }
  };

  // Run Safety & Multi-Drug Evaluation
  const runSafetyEvaluation = async () => {
    if (safetySelectedMeds.length === 0) {
      setSafetyError("Please select at least one medication to evaluate.");
      return;
    }

    setSafetyEvaluating(true);
    setSafetyError(null);

    const parsedAge = safetyAge.trim() !== "" ? Number(safetyAge) : undefined;
    const allergyItems =
      safetyAllergiesStatus === "yes" && safetyAllergiesText.trim()
        ? safetyAllergiesText.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

    try {
      const res = await fetch("/api/medication/safety-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medications: safetySelectedMeds,
          patientContext: {
            ageYears: parsedAge,
            pregnancy: safetyPregnancy,
            breastfeeding: safetyBreastfeeding as any,
            allergies: {
              status: safetyAllergiesStatus,
              items: allergyItems,
            },
            conditions: safetyConditions,
            currentMedicines: {
              status: "unknown",
              items: [],
            },
          },
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setSafetyError(json.error?.message || "Safety evaluation failed.");
      } else {
        setSafetyResult(json.data);
        if (json.data.emergencyDetected) {
          setEmergencyReason(
            json.data.emergencyMessage || "Critical emergency warning signs detected."
          );
          setEmergencyAlertOpen(true);
        }
      }
    } catch {
      setSafetyError("Network connection interrupted. Please try again.");
    } finally {
      setSafetyEvaluating(false);
    }
  };

  // Ask Clinix AI Handler
  const handleAskMedicationAi = async (
    customQuestion?: string,
    medOverride?: ApprovedMedication | null
  ) => {
    const q = (customQuestion || aiQuestion).trim();
    if (!q) return;

    // Use override if explicitly provided, otherwise currently selected topic
    const targetMed = medOverride !== undefined ? medOverride : aiSelectedMed;

    setAiLoading(true);
    const userMsg = q;
    setAiQuestion("");

    // Append to local chat
    setAiChatHistory((prev) => [...prev, { role: "user", text: userMsg }]);

    try {
      const res = await fetch("/api/medication/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medicationId: targetMed?.id,
          medicationName: targetMed?.genericName,
          question: userMsg,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        const errorText =
          json.error?.message ||
          "Unable to consult the medication assistant at this time. Please speak with a licensed pharmacist.";
        setAiChatHistory((prev) => [
          ...prev,
          { role: "assistant", text: errorText },
        ]);
      } else {
        const result: MedicationAiQueryResult = json.data;
        setAiResponse(result);
        setAiChatHistory((prev) => [
          ...prev,
          { role: "assistant", text: result.answer, result },
        ]);

        // Sync topic selector if medicine was identified by assistant
        if (result.medicationIdentified?.id) {
          const pool = catalogMeds.length > 0 ? catalogMeds : searchResults;
          const matched =
            pool.find((m) => m.id === result.medicationIdentified?.id) ||
            searchResults.find((m) => m.id === result.medicationIdentified?.id);
          if (matched) {
            setAiSelectedMed(matched);
          }
        }

        if (result.isEmergency) {
          setEmergencyReason(result.emergencyInstructions || "Immediate emergency care required.");
          setEmergencyAlertOpen(true);
        }
      }
    } catch {
      setAiChatHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Connection failed. For urgent medical concerns, call 112 immediately.",
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  // Open Medicine in Guide Tab
  const openMedicineGuide = (med: ApprovedMedication) => {
    setSelectedMed(med);
    recordRecentlyViewed(med);
    setActiveTab("guide");
    setActiveGuideSection("overview");
  };

  // Open Medicine in Ask AI Tab
  const openMedicineAi = (med: ApprovedMedication, initialPrompt?: string) => {
    setAiSelectedMed(med);
    setActiveTab("ask_ai");
    if (initialPrompt) {
      handleAskMedicationAi(initialPrompt, med);
    }
  };

  // Add medicine to Safety Checker
  const addToSafetyCheck = (medName: string) => {
    if (!safetySelectedMeds.includes(medName)) {
      setSafetySelectedMeds((prev) => [...prev, medName]);
    }
    setActiveTab("safety");
  };

  // Submit Feedback
  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackMed || !feedbackDetails.trim()) return;

    setFeedbackSubmitting(true);
    try {
      const res = await fetch("/api/medication/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medicationId: feedbackMed.id,
          medicationName: feedbackMed.genericName,
          feedbackType,
          details: feedbackDetails,
          contactEmail: feedbackEmail.trim() || undefined,
        }),
      });

      if (res.ok) {
        setFeedbackSuccess(true);
        setTimeout(() => {
          setFeedbackOpen(false);
          setFeedbackSuccess(false);
          setFeedbackDetails("");
        }, 1800);
      }
    } catch {
      // Handled
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 py-6 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Top Header & Emergency Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full bg-cyan-950/40 px-3 py-1 text-xs font-semibold text-cyan-400 border border-cyan-800/40">
              <Pill className="h-3.5 w-3.5 text-cyan-400" />
              <span>MEDICATION INFORMATION & SAFETY MODULE</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <span>Medication Centre</span>
              <span className="text-xs px-2.5 py-0.5 rounded-md bg-zinc-800 text-zinc-400 font-normal">
                Verified References
              </span>
            </h1>
            <p className="text-sm text-zinc-400 max-w-2xl">
              Find reliable medication information, explore active ingredients and indications, check multi-drug safety interactions, and consult the Clinix AI assistant.
            </p>
          </div>

          {/* Clinical Disclaimer & Emergency Fast Contact */}
          <div className="flex items-center gap-3">
            <a
              href="tel:112"
              className="inline-flex items-center gap-2 rounded-lg bg-red-600/90 hover:bg-red-600 px-3.5 py-2 text-xs font-bold text-white transition active:scale-95 shadow-sm"
              title="Immediate emergency ambulance call"
            >
              <PhoneCall className="h-3.5 w-3.5" />
              <span>Emergency: 112</span>
            </a>
          </div>
        </div>

        {/* Global Clinical Safety Notice */}
        <div className="flex items-center gap-3 rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-3 text-xs text-zinc-400">
          <Info className="h-4 w-4 text-cyan-400 shrink-0" />
          <span>
            <strong className="text-zinc-200">Clinical Safeguard:</strong> Medication information is educational and grounded in official regulatory labels. Clinix does not calculate individualized body-weight dosages or prescribe medications. Always consult a registered pharmacist or doctor.
          </span>
        </div>

        {/* Navigation Tabs (Dribbble/Prototype Inspired Segmented Control) */}
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-900 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab("search")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition ${
              activeTab === "search"
                ? "bg-zinc-800 text-cyan-400 border border-cyan-500/30 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            <Search className="h-4 w-4" />
            <span>Medication Search</span>
            <span className="ml-1 rounded-full bg-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300">
              {searchResults.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("guide")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition ${
              activeTab === "guide"
                ? "bg-zinc-800 text-cyan-400 border border-cyan-500/30 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            <FileText className="h-4 w-4" />
            <span>Medicine Guide</span>
            {selectedMed && (
              <span className="max-w-[120px] truncate text-xs text-zinc-300">
                ({selectedMed.genericName})
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("safety")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition ${
              activeTab === "safety"
                ? "bg-zinc-800 text-cyan-400 border border-cyan-500/30 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Safety & Interactions</span>
            {safetySelectedMeds.length > 0 && (
              <span className="ml-1 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 px-1.5 py-0.2 text-[10px]">
                {safetySelectedMeds.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("saved")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition ${
              activeTab === "saved"
                ? "bg-zinc-800 text-cyan-400 border border-cyan-500/30 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
          >
            <Bookmark className="h-4 w-4" />
            <span>Saved Reference List</span>
            {savedMeds.length > 0 && (
              <span className="ml-1 rounded-full bg-zinc-700 px-1.5 py-0.2 text-[10px] text-zinc-300">
                {savedMeds.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("ask_ai")}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition ${
              activeTab === "ask_ai"
                ? "bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-sm"
                : "text-blue-400 hover:text-blue-300 hover:bg-zinc-900"
            }`}
          >
            <Sparkles className="h-4 w-4 text-blue-400" />
            <span>Ask Clinix AI</span>
          </button>
        </div>

        {/* =========================================================================
            TAB 1: MEDICATION SEARCH & CATALOG EXPLORER
        ========================================================================== */}
        {activeTab === "search" && (
          <div className="space-y-6">
            {/* Search Input Bar */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 sm:p-5 shadow-inner">
              <div className="relative">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search by brand name, generic name, active ingredient (e.g. Paracetamol, Panadol, Ibuprofen, Coartem, Amoxil...)"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    handleSearch(e.target.value, selectedCategory, selectedForm, selectedClassification);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSearch(searchQuery, selectedCategory, selectedForm, selectedClassification);
                    }
                  }}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900/90 py-3 pl-12 pr-28 text-sm text-white placeholder-zinc-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition"
                  aria-label="Search medications"
                />
                <button
                  type="button"
                  onClick={() => handleSearch(searchQuery, selectedCategory, selectedForm, selectedClassification)}
                  className="absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 px-3.5 py-1.5 text-xs font-semibold text-white transition active:scale-95"
                >
                  {isSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                  <span>Search</span>
                </button>
              </div>

              {/* Quick Search Chips */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium text-zinc-500">Popular:</span>
                {FEATURED_SEARCH_MEDS.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => {
                      setSearchQuery(item.name);
                      handleSearch(item.name, selectedCategory, selectedForm, selectedClassification);
                    }}
                    className="rounded-full bg-zinc-900 border border-zinc-800/80 px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:border-cyan-500/50 hover:text-cyan-400 transition"
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Filters Bar: Category, Dosage Form, Classification */}
              <div className="mt-4 pt-4 border-t border-zinc-900 flex flex-wrap gap-4 items-center justify-between text-xs">
                {/* Category Filter */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-zinc-500 font-medium">Category:</span>
                  {CATEGORY_FILTERS.slice(0, 6).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        handleSearch(searchQuery, cat.id, selectedForm, selectedClassification);
                      }}
                      className={`rounded-md px-2 py-0.5 text-xs transition ${
                        selectedCategory === cat.id
                          ? "bg-cyan-950 text-cyan-300 border border-cyan-800 font-semibold"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Classification Toggle */}
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-500 font-medium">Status:</span>
                  <select
                    value={selectedClassification}
                    onChange={(e) => {
                      setSelectedClassification(e.target.value);
                      handleSearch(searchQuery, selectedCategory, selectedForm, e.target.value);
                    }}
                    className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="all">All Classifications</option>
                    <option value="over_the_counter">Over-the-Counter (OTC)</option>
                    <option value="prescription_only">Prescription Only (POM)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Recently Viewed Medicines Strip */}
            {recentlyViewed.length > 0 && !searchQuery.trim() && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  <Clock className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Recently Viewed</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                  {recentlyViewed.map((med) => (
                    <button
                      key={med.id}
                      type="button"
                      onClick={() => openMedicineGuide(med)}
                      className="text-left rounded-xl border border-zinc-800 bg-zinc-900/60 p-2.5 hover:border-zinc-700 transition"
                    >
                      <div className="font-semibold text-xs text-white truncate">{med.genericName}</div>
                      <div className="text-[10px] text-zinc-400 truncate">{med.brandNames[0] || med.therapeuticClass}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Error Message */}
            {searchError && (
              <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-4 text-xs text-red-300 flex items-center justify-between">
                <span>{searchError}</span>
                <Button size="sm" variant="outline" onClick={() => handleSearch()}>
                  Retry
                </Button>
              </div>
            )}

            {/* Results Grid */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
                <span>
                  Showing {searchResults.length} verified {searchResults.length === 1 ? "medicine" : "medicines"}
                </span>
                <span className="text-[11px] text-zinc-500">
                  Data authority: Ghana FDA / MoH Guidelines & DailyMed
                </span>
              </div>

              {isSearching ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                      key={i}
                      className="h-48 rounded-2xl border border-zinc-800 bg-zinc-900/40 animate-pulse p-4 space-y-3"
                    >
                      <div className="h-4 w-3/4 bg-zinc-800 rounded" />
                      <div className="h-3 w-1/2 bg-zinc-800 rounded" />
                      <div className="h-16 bg-zinc-800/60 rounded" />
                    </div>
                  ))}
                </div>
              ) : searchResults.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950 p-8 text-center space-y-3">
                  <Pill className="mx-auto h-8 w-8 text-zinc-500" />
                  <h3 className="text-sm font-semibold text-zinc-300">No verified medicines matched your search</h3>
                  <p className="text-xs text-zinc-500 max-w-md mx-auto">
                    Try checking spelling or searching by active generic ingredient (e.g. Paracetamol, Ibuprofen, Amoxicillin). Clinix does not display fabricated medicine records.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSearchQuery("");
                      setSelectedCategory("all");
                      setSelectedForm("all");
                      setSelectedClassification("all");
                      handleSearch("", "all", "all", "all");
                    }}
                  >
                    Reset All Filters
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {searchResults.map((med) => {
                    const isSaved = savedMeds.some((s) => s.medicationId === med.id);
                    const isRx = med.classification === "prescription_only";

                    return (
                      <div
                        key={med.id}
                        className="group flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 hover:border-zinc-700 hover:bg-zinc-900 transition-all shadow-sm"
                      >
                        <div className="space-y-3">
                          {/* Classification & ID Header */}
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                isRx
                                  ? "bg-amber-950/60 text-amber-400 border border-amber-800/60"
                                  : "bg-emerald-950/60 text-emerald-400 border border-emerald-800/60"
                              }`}
                            >
                              {isRx ? "Prescription Only (POM)" : "Over The Counter (OTC)"}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono">
                              {med.registrationNumber || med.id}
                            </span>
                          </div>

                          {/* Medicine Names */}
                          <div>
                            <h2 className="text-base font-bold text-white group-hover:text-cyan-400 transition">
                              {med.genericName}
                            </h2>
                            {med.brandNames && med.brandNames.length > 0 && (
                              <p className="text-xs text-zinc-400 mt-0.5">
                                Brands: <span className="text-zinc-300">{med.brandNames.slice(0, 3).join(", ")}</span>
                                {med.brandNames.length > 3 && ` +${med.brandNames.length - 3}`}
                              </p>
                            )}
                          </div>

                          {/* Class & Dosage Form */}
                          <div className="space-y-1 text-xs">
                            <div className="text-zinc-400 flex items-center gap-1.5">
                              <span className="text-zinc-500 font-medium">Class:</span>
                              <span className="text-zinc-300 truncate">{med.therapeuticClass}</span>
                            </div>
                            {med.availableForms && med.availableForms.length > 0 && (
                              <div className="text-zinc-400 flex items-center gap-1.5">
                                <span className="text-zinc-500 font-medium">Form:</span>
                                <span className="text-zinc-300 truncate">
                                  {med.availableForms[0].form} ({med.availableForms[0].standardStrength || "Standard"})
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Boxed Warning Tag if present */}
                          {med.boxedWarning && (
                            <div className="rounded-lg bg-red-950/30 border border-red-900/40 p-2 text-[11px] text-red-300 flex items-start gap-1.5">
                              <AlertOctagon className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                              <span className="line-clamp-2">{med.boxedWarning}</span>
                            </div>
                          )}

                          {/* Approved Indications Snippet */}
                          <div className="space-y-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                              Approved Uses:
                            </span>
                            <p className="text-xs text-zinc-300 line-clamp-2">
                              {med.approvedIndications.join(", ")}
                            </p>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-5 pt-3 border-t border-zinc-800/80 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => openMedicineGuide(med)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white transition active:scale-95"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span>Guide</span>
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => addToSafetyCheck(med.genericName)}
                              className="rounded-lg border border-zinc-800 hover:border-cyan-500/50 hover:bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-cyan-400 transition"
                              title="Check drug interactions"
                            >
                              Safety
                            </button>

                            <button
                              type="button"
                              onClick={() => openMedicineAi(med, `What should I know before taking ${med.genericName}?`)}
                              className="rounded-lg border border-zinc-800 hover:border-blue-500/50 hover:bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-blue-400 transition"
                              title="Ask Clinix AI about this medicine"
                            >
                              Ask AI
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleSaveMedication(med)}
                              className={`rounded-lg p-1.5 transition ${
                                isSaved
                                  ? "text-cyan-400 bg-cyan-950/40 border border-cyan-800"
                                  : "text-zinc-500 hover:text-zinc-300 border border-transparent"
                              }`}
                              title={isSaved ? "Saved in reference list" : "Save reference"}
                            >
                              {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: MEDICINE GUIDE (IN-DEPTH DEDICATED DETAIL VIEW)
        ========================================================================== */}
        {activeTab === "guide" && (
          <div className="space-y-6">
            {selectedMed ? (
              <div className="space-y-6">
                {/* Header Card */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                            selectedMed.classification === "prescription_only"
                              ? "bg-amber-950 text-amber-400 border border-amber-800"
                              : "bg-emerald-950 text-emerald-400 border border-emerald-800"
                          }`}
                        >
                          {selectedMed.classification === "prescription_only"
                            ? "Prescription-Only Medicine (POM)"
                            : "Over-the-Counter (OTC)"}
                        </span>
                        <span className="text-xs text-zinc-400 font-mono">
                          ID: {selectedMed.id}
                        </span>
                        {selectedMed.registrationNumber && (
                          <span className="rounded bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">
                            Reg: {selectedMed.registrationNumber}
                          </span>
                        )}
                      </div>

                      <h2 className="text-3xl font-extrabold text-white">
                        {selectedMed.genericName}
                      </h2>

                      {selectedMed.brandNames && selectedMed.brandNames.length > 0 && (
                        <p className="text-sm text-zinc-400">
                          Marketed Brand Names:{" "}
                          <span className="text-zinc-200 font-medium">
                            {selectedMed.brandNames.join(", ")}
                          </span>
                        </p>
                      )}

                      <div className="text-xs text-zinc-400 flex flex-wrap gap-x-4 gap-y-1">
                        <span>
                          <strong className="text-zinc-300">Therapeutic Class:</strong>{" "}
                          {selectedMed.therapeuticClass}
                        </span>
                        {selectedMed.manufacturerOrDistributor && (
                          <span>
                            <strong className="text-zinc-300">Manufacturer / Distributor:</strong>{" "}
                            {selectedMed.manufacturerOrDistributor}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick Guide Actions */}
                    <div className="flex flex-wrap md:flex-col gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openMedicineAi(selectedMed, `What are the most important precautions for ${selectedMed.genericName}?`)}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2 text-xs font-semibold text-white transition active:scale-95"
                      >
                        <Sparkles className="h-4 w-4" />
                        <span>Ask AI About This Medicine</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => addToSafetyCheck(selectedMed.genericName)}
                        className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 px-4 py-2 text-xs font-semibold text-cyan-400 transition"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        <span>Check Safety & Interactions</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleSaveMedication(selectedMed)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-300 transition"
                        >
                          {savedMeds.some((s) => s.medicationId === selectedMed.id) ? (
                            <>
                              <BookmarkCheck className="h-3.5 w-3.5 text-cyan-400" />
                              <span className="text-cyan-400">Bookmarked</span>
                            </>
                          ) : (
                            <>
                              <Bookmark className="h-3.5 w-3.5" />
                              <span>Bookmark</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setFeedbackMed(selectedMed);
                            setFeedbackOpen(true);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 hover:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition"
                          title="Report discrepancy or suggest correction"
                        >
                          <Flag className="h-3.5 w-3.5" />
                          <span>Report</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sub-navigation jump links */}
                <div className="flex overflow-x-auto gap-2 border-b border-zinc-900 pb-2 text-xs">
                  {[
                    { id: "overview", label: "Overview & Uses" },
                    { id: "warnings", label: "Warnings & Contraindications" },
                    { id: "side_effects", label: "Side Effects" },
                    { id: "interactions", label: "Interactions" },
                    { id: "special_pop", label: "Pregnancy & Special Groups" },
                    { id: "storage", label: "Storage & Handling" },
                    { id: "sources", label: "Source & Attribution" },
                  ].map((sec) => (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => setActiveGuideSection(sec.id)}
                      className={`whitespace-nowrap rounded-lg px-3 py-1.5 font-medium transition ${
                        activeGuideSection === sec.id
                          ? "bg-zinc-800 text-cyan-400 font-semibold"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                      }`}
                    >
                      {sec.label}
                    </button>
                  ))}
                </div>

                {/* Section Content */}
                <div className="space-y-6">
                  {/* Overview & Uses */}
                  {(activeGuideSection === "overview" || activeGuideSection === "all") && (
                    <Card className="border-zinc-800 bg-zinc-950">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base text-white flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-cyan-400" />
                          <span>Approved Uses & Indications</span>
                        </CardTitle>
                        <CardDescription className="text-xs text-zinc-400">
                          Officially registered therapeutic indications approved by national medicine regulatory authorities.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4 text-sm">
                        <ul className="list-disc pl-5 space-y-1.5 text-zinc-200">
                          {selectedMed.approvedIndications.map((ind, i) => (
                            <li key={i}>{ind}</li>
                          ))}
                        </ul>

                        {/* Active Ingredients & Formulations */}
                        {selectedMed.activeIngredients && selectedMed.activeIngredients.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-zinc-900">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                              Active Substance & Strength:
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {selectedMed.activeIngredients.map((ai, i) => (
                                <span
                                  key={i}
                                  className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-1 text-xs text-cyan-300 font-medium"
                                >
                                  {ai.name} {ai.strength ? `— ${ai.strength}` : ""}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedMed.availableForms && selectedMed.availableForms.length > 0 && (
                          <div className="mt-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                              Available Dosage Forms & Routes:
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              {selectedMed.availableForms.map((f, i) => (
                                <div
                                  key={i}
                                  className="rounded-lg bg-zinc-900/60 border border-zinc-800/80 p-2.5 text-zinc-300"
                                >
                                  <div className="font-semibold text-white">{f.form}</div>
                                  <div className="text-[11px] text-zinc-400">
                                    Route: {f.route} | Strength: {f.standardStrength || "Standard packaging"}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Warnings & Contraindications */}
                  {(activeGuideSection === "warnings" || activeGuideSection === "all") && (
                    <Card className="border-zinc-800 bg-zinc-950">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base text-white flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-400" />
                          <span>Warnings, Precautions & Contraindications</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 text-sm">
                        {/* Boxed Warning */}
                        {selectedMed.boxedWarning && (
                          <div className="rounded-xl border border-red-900/60 bg-red-950/30 p-4 space-y-1.5">
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-400">
                              <AlertOctagon className="h-4 w-4 text-red-400" />
                              <span>Boxed Warning / High Priority Safety Alert</span>
                            </div>
                            <p className="text-xs text-red-200 leading-relaxed font-medium">
                              {selectedMed.boxedWarning}
                            </p>
                          </div>
                        )}

                        {/* Contraindications List */}
                        {selectedMed.contraindications.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                              Do Not Take If (Contraindications):
                            </h4>
                            <div className="space-y-2">
                              {selectedMed.contraindications.map((contra, i) => (
                                <div
                                  key={i}
                                  className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 text-xs"
                                >
                                  <div className="font-bold text-red-400 flex items-center gap-1.5">
                                    <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                                    <span>{contra.condition}</span>
                                  </div>
                                  <p className="text-zinc-300 mt-1">{contra.explanation}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* General Administration Warnings */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                            Label Instructions & Precautions:
                          </h4>
                          <ul className="list-disc pl-5 space-y-1.5 text-xs text-zinc-300">
                            {selectedMed.administrationWarnings.map((warn, i) => (
                              <li key={i}>{warn}</li>
                            ))}
                          </ul>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Side Effects */}
                  {(activeGuideSection === "side_effects" || activeGuideSection === "all") && (
                    <Card className="border-zinc-800 bg-zinc-950">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base text-white flex items-center gap-2">
                          <Activity className="h-4 w-4 text-cyan-400" />
                          <span>Adverse Reactions & Side Effects</span>
                        </CardTitle>
                        <CardDescription className="text-xs text-zinc-400">
                          Clear distinction between common mild reactions and serious clinical warning signs.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Common Side Effects */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                            Common / Expected Effects:
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {selectedMed.commonSideEffects.map((eff, i) => (
                              <span
                                key={i}
                                className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300"
                              >
                                {eff}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Serious Adverse Reactions */}
                        {selectedMed.seriousAdverseEffects && selectedMed.seriousAdverseEffects.length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-zinc-900">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                              <span>Serious Symptoms (Seek Urgent In-Person Care):</span>
                            </h4>
                            <div className="space-y-1.5">
                              {selectedMed.seriousAdverseEffects.map((sae, i) => (
                                <div
                                  key={i}
                                  className="rounded-lg bg-red-950/20 border border-red-900/30 p-2.5 text-xs text-red-200"
                                >
                                  {sae}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Interactions */}
                  {(activeGuideSection === "interactions" || activeGuideSection === "all") && (
                    <Card className="border-zinc-800 bg-zinc-950">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base text-white flex items-center gap-2">
                          <Layers className="h-4 w-4 text-cyan-400" />
                          <span>Interactions (Drug, Alcohol, Food)</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Known Drug Interactions */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                            Recorded Medicine Interactions:
                          </h4>
                          {selectedMed.interactions.length === 0 ? (
                            <p className="text-xs text-zinc-400">
                              No major pairwise drug interactions recorded in this reference record.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {selectedMed.interactions.map((inter, i) => (
                                <div
                                  key={i}
                                  className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3 text-xs"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-white">{inter.medicineOrClass}</span>
                                    <Badge
                                      variant="outline"
                                      className={
                                        inter.severity === "major"
                                          ? "text-red-400 border-red-800"
                                          : "text-amber-400 border-amber-800"
                                      }
                                    >
                                      {inter.severity.toUpperCase()}
                                    </Badge>
                                  </div>
                                  <p className="text-zinc-300 mt-1">{inter.effect}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Food & Alcohol */}
                        {selectedMed.foodAlcoholInteractions && selectedMed.foodAlcoholInteractions.length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-zinc-900">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                              Food, Alcohol & Supplement Interactions:
                            </h4>
                            <div className="space-y-2">
                              {selectedMed.foodAlcoholInteractions.map((fai, i) => (
                                <div
                                  key={i}
                                  className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-3 text-xs"
                                >
                                  <span className="font-bold text-cyan-300">{fai.item}: </span>
                                  <span className="text-zinc-300">{fai.warning}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Special Populations */}
                  {(activeGuideSection === "special_pop" || activeGuideSection === "all") && (
                    <Card className="border-zinc-800 bg-zinc-950">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base text-white flex items-center gap-2">
                          <HeartHandshake className="h-4 w-4 text-cyan-400" />
                          <span>Pregnancy, Breastfeeding, Pediatric & Older Adults</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-xs">
                        <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 space-y-1">
                          <div className="font-bold text-white flex items-center justify-between">
                            <span>Pregnancy</span>
                            <span
                              className={`text-[11px] font-semibold ${
                                selectedMed.pregnancyPrecautions.isContraindicated
                                  ? "text-red-400"
                                  : "text-emerald-400"
                              }`}
                            >
                              {selectedMed.pregnancyPrecautions.isContraindicated
                                ? "Contraindicated / Caution"
                                : "Allowed Under Clinical Guidance"}
                            </span>
                          </div>
                          <p className="text-zinc-300">{selectedMed.pregnancyPrecautions.warning}</p>
                        </div>

                        {selectedMed.breastfeedingPrecautions && (
                          <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 space-y-1">
                            <div className="font-bold text-white">Breastfeeding & Lactation</div>
                            <p className="text-zinc-300">{selectedMed.breastfeedingPrecautions.warning}</p>
                          </div>
                        )}

                        {selectedMed.pediatricPrecautions && (
                          <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 space-y-1">
                            <div className="font-bold text-white">Children & Adolescents (Pediatric)</div>
                            <p className="text-zinc-300">{selectedMed.pediatricPrecautions}</p>
                          </div>
                        )}

                        {selectedMed.olderAdultPrecautions && (
                          <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 space-y-1">
                            <div className="font-bold text-white">Older Adults (Geriatric Precautions)</div>
                            <p className="text-zinc-300">{selectedMed.olderAdultPrecautions}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Storage & Handling */}
                  {(activeGuideSection === "storage" || activeGuideSection === "all") && (
                    <Card className="border-zinc-800 bg-zinc-950">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base text-white">Storage & Safe Handling</CardTitle>
                      </CardHeader>
                      <CardContent className="text-xs text-zinc-300 space-y-2">
                        <p>{selectedMed.storageAndHandling || "Store below 25°C - 30°C in a dry place. Protect from heat, direct sunlight, and moisture."}</p>
                        <p className="text-zinc-400 font-medium">
                          Always keep all medicines strictly out of reach and out of sight of children. Do not use after the expiry date printed on the packaging.
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Source & Attribution */}
                  {(activeGuideSection === "sources" || activeGuideSection === "all") && (
                    <Card className="border-zinc-800 bg-zinc-950">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base text-white">Official Regulatory Source & Traceability</CardTitle>
                      </CardHeader>
                      <CardContent className="text-xs text-zinc-400 space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <span className="font-semibold text-zinc-300">Authority / Guideline:</span>
                            <p className="text-white mt-0.5">{selectedMed.referenceSource.name}</p>
                          </div>
                          <div>
                            <span className="font-semibold text-zinc-300">Jurisdiction:</span>
                            <p className="text-white mt-0.5">{selectedMed.referenceSource.jurisdiction}</p>
                          </div>
                          <div>
                            <span className="font-semibold text-zinc-300">Last Reviewed Date:</span>
                            <p className="text-white mt-0.5">
                              {new Date(selectedMed.referenceSource.lastReviewedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div>
                            <span className="font-semibold text-zinc-300">Reviewer:</span>
                            <p className="text-white mt-0.5">{selectedMed.referenceSource.reviewedBy}</p>
                          </div>
                        </div>

                        {selectedMed.officialLabelUrl && (
                          <div className="pt-2">
                            <a
                              href={selectedMed.officialLabelUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 underline"
                            >
                              <span>View Official Regulatory Label Source</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950 p-12 text-center space-y-3">
                <FileText className="mx-auto h-8 w-8 text-zinc-500" />
                <h3 className="text-sm font-semibold text-zinc-300">No medicine selected</h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  Select a medicine from the search catalog to view its comprehensive clinical guide.
                </p>
                <Button size="sm" onClick={() => setActiveTab("search")}>
                  Open Search Catalog
                </Button>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 3: MULTI-DRUG SAFETY & INTERACTION CHECKER
        ========================================================================== */}
        {activeTab === "safety" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-6">
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-cyan-400" />
                  <span>Multi-Drug Safety & Interaction Checker</span>
                </h2>
                <p className="text-xs text-zinc-400 max-w-2xl">
                  Check for known drug-drug interactions, duplicate active ingredients (such as taking multiple products with paracetamol), and allergy/pregnancy contraindications.
                </p>
              </div>

              {/* Medicine Selector Strip */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                  1. Medicines to evaluate together:
                </label>

                {/* Selected Meds Chips */}
                <div className="flex flex-wrap items-center gap-2 min-h-[38px] p-2.5 rounded-xl border border-zinc-800 bg-zinc-900/60">
                  {safetySelectedMeds.map((medName) => (
                    <span
                      key={medName}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-1 text-xs font-semibold text-white"
                    >
                      <span>{medName}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setSafetySelectedMeds((prev) => prev.filter((m) => m !== medName))
                        }
                        className="text-zinc-400 hover:text-red-400 transition"
                        title={`Remove ${medName}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}

                  {/* Add Input */}
                  <div className="flex items-center gap-1 flex-1 min-w-[200px]">
                    <input
                      type="text"
                      placeholder="Add another medicine (e.g. Warfarin, Aspirin)..."
                      value={newMedInput}
                      onChange={(e) => setNewMedInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newMedInput.trim()) {
                          e.preventDefault();
                          if (!safetySelectedMeds.includes(newMedInput.trim())) {
                            setSafetySelectedMeds((prev) => [...prev, newMedInput.trim()]);
                          }
                          setNewMedInput("");
                        }
                      }}
                      className="w-full bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none px-2"
                    />
                    {newMedInput.trim() && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!safetySelectedMeds.includes(newMedInput.trim())) {
                            setSafetySelectedMeds((prev) => [...prev, newMedInput.trim()]);
                          }
                          setNewMedInput("");
                        }}
                        className="rounded bg-blue-600 px-2 py-0.5 text-xs text-white"
                      >
                        Add
                      </button>
                    )}
                  </div>
                </div>

                {/* Popular Pair Presets */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                  <span>Try common safety checks:</span>
                  <button
                    type="button"
                    onClick={() => setSafetySelectedMeds(["Panadol", "Febrax"])}
                    className="rounded bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300 hover:text-cyan-400"
                  >
                    Panadol + Febrax (Duplicate check)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSafetySelectedMeds(["Ibuprofen", "Warfarin"])}
                    className="rounded bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300 hover:text-cyan-400"
                  >
                    Ibuprofen + Warfarin (Bleeding check)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSafetySelectedMeds(["Metronidazole", "Alcohol"])}
                    className="rounded bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300 hover:text-cyan-400"
                  >
                    Metronidazole + Alcohol (Disulfiram check)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSafetySelectedMeds(["Ciprofloxacin", "Magnesium Trisilicate Compound"])}
                    className="rounded bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300 hover:text-cyan-400"
                  >
                    Cipro + Antacid (Chelation check)
                  </button>
                </div>
              </div>

              {/* Patient Context Options (Tri-State Logic) */}
              <div className="space-y-4 pt-4 border-t border-zinc-900">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                    2. Patient Clinical Context:
                  </label>
                  <span className="text-[11px] text-amber-400">
                    Safety Rule: Unknown fields cannot be assumed safe
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  {/* Age */}
                  <div className="space-y-1.5">
                    <label className="text-zinc-400 font-medium">Patient Age (Years):</label>
                    <Input
                      type="number"
                      placeholder="e.g. 35"
                      value={safetyAge}
                      onChange={(e) => setSafetyAge(e.target.value)}
                      className="bg-zinc-900 border-zinc-800 text-white text-xs h-9"
                    />
                  </div>

                  {/* Pregnancy */}
                  <div className="space-y-1.5">
                    <label className="text-zinc-400 font-medium">Pregnancy Status:</label>
                    <select
                      value={safetyPregnancy}
                      onChange={(e) => setSafetyPregnancy(e.target.value as PregnancyStatus)}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-2 text-xs text-zinc-300 focus:outline-none focus:border-cyan-500 h-9"
                    >
                      <option value="unknown">Unknown / Not Specified</option>
                      <option value="no">Not Pregnant (No)</option>
                      <option value="yes">Pregnant (Yes)</option>
                      <option value="not_applicable">Not Applicable</option>
                    </select>
                  </div>

                  {/* Allergies Status */}
                  <div className="space-y-1.5">
                    <label className="text-zinc-400 font-medium">Known Allergies:</label>
                    <select
                      value={safetyAllergiesStatus}
                      onChange={(e) => setSafetyAllergiesStatus(e.target.value as TriState)}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-2 text-xs text-zinc-300 focus:outline-none focus:border-cyan-500 h-9"
                    >
                      <option value="unknown">Unknown</option>
                      <option value="no">No Known Allergies</option>
                      <option value="yes">Has Known Allergies</option>
                    </select>
                  </div>

                  {/* Pre-existing Conditions Selector */}
                  <div className="space-y-1.5">
                    <label className="text-zinc-400 font-medium">Medical Conditions:</label>
                    <div className="flex flex-wrap gap-1">
                      {["Asthma", "Peptic Ulcer", "Liver Disease", "Kidney Disease"].map((cond) => {
                        const active = safetyConditions.includes(cond);
                        return (
                          <button
                            key={cond}
                            type="button"
                            onClick={() => {
                              setSafetyConditions((prev) =>
                                active ? prev.filter((c) => c !== cond) : [...prev, cond]
                              );
                            }}
                            className={`rounded px-2 py-0.5 text-[10px] transition ${
                              active
                                ? "bg-cyan-950 text-cyan-300 border border-cyan-800"
                                : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                            }`}
                          >
                            {cond}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {safetyAllergiesStatus === "yes" && (
                  <div className="space-y-1">
                    <label className="text-[11px] text-zinc-400">Specify Allergies (comma-separated):</label>
                    <Input
                      type="text"
                      placeholder="e.g. Penicillin, Amoxicillin, NSAID, Aspirin, Sulfa..."
                      value={safetyAllergiesText}
                      onChange={(e) => setSafetyAllergiesText(e.target.value)}
                      className="bg-zinc-900 border-zinc-800 text-white text-xs h-9"
                    />
                  </div>
                )}
              </div>

              {/* Evaluate Button */}
              <div className="pt-2 flex items-center justify-between">
                <Button
                  onClick={runSafetyEvaluation}
                  disabled={safetyEvaluating || safetySelectedMeds.length === 0}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs px-6 py-2.5"
                >
                  {safetyEvaluating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span>Checking Verified Safety Engine...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      <span>Evaluate Multi-Drug Safety</span>
                    </>
                  )}
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setSafetySelectedMeds(["Paracetamol"]);
                    setSafetyResult(null);
                    setSafetyError(null);
                  }}
                  className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset Check</span>
                </button>
              </div>

              {safetyError && (
                <div className="rounded-xl border border-red-900 bg-red-950/20 p-3 text-xs text-red-300">
                  {safetyError}
                </div>
              )}

              {/* Evaluation Results */}
              {safetyResult && (
                <div className="space-y-5 pt-4 border-t border-zinc-800 animate-in fade-in duration-200">
                  {/* Status Banner */}
                  <div
                    className={`rounded-2xl border p-4 flex items-start gap-3 ${
                      safetyResult.status === "contraindicated" || safetyResult.emergencyDetected
                        ? "border-red-900 bg-red-950/30 text-red-200"
                        : safetyResult.status === "caution_advised"
                        ? "border-amber-900 bg-amber-950/30 text-amber-200"
                        : safetyResult.status === "requires_consultation"
                        ? "border-amber-900/60 bg-zinc-900 text-amber-200"
                        : "border-emerald-900 bg-emerald-950/30 text-emerald-200"
                    }`}
                  >
                    {safetyResult.status === "contraindicated" || safetyResult.emergencyDetected ? (
                      <ShieldAlert className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                    ) : safetyResult.status === "caution_advised" ? (
                      <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                    )}

                    <div className="space-y-1">
                      <div className="font-bold text-sm">
                        {safetyResult.status === "contraindicated"
                          ? "CRITICAL SAFETY CONTRAINDICATION DETECTED"
                          : safetyResult.status === "caution_advised"
                          ? "CAUTION ADVISED: SIGNIFICANT INTERACTIONS FOUND"
                          : safetyResult.status === "requires_consultation"
                          ? "PHARMACIST CONSULTATION MANDATORY (UNKNOWN INFORMATION)"
                          : "NO RECORDED CRITICAL INTERACTIONS IN CONFIGURED MATRIX"}
                      </div>
                      <p className="text-xs leading-relaxed opacity-90">
                        {safetyResult.referral.reason ||
                          "Always review administration times and dosing with your dispensing pharmacist."}
                      </p>
                    </div>
                  </div>

                  {/* Duplicate Ingredients Section */}
                  {safetyResult.duplicateIngredients.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                        <AlertOctagon className="h-4 w-4 text-red-400" />
                        <span>Duplicate Active Ingredient Warnings:</span>
                      </h4>
                      <div className="space-y-2">
                        {safetyResult.duplicateIngredients.map((dup, i) => (
                          <div
                            key={i}
                            className="rounded-xl border border-red-900/60 bg-red-950/20 p-3.5 text-xs text-red-200 space-y-1"
                          >
                            <div className="font-bold text-red-300">
                              Shared Ingredient: {dup.ingredient}
                            </div>
                            <p className="leading-relaxed">{dup.warning}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pairwise Drug Interactions */}
                  {safetyResult.interactions.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                        <Layers className="h-4 w-4 text-amber-400" />
                        <span>Pairwise Drug Interactions ({safetyResult.interactions.length}):</span>
                      </h4>
                      <div className="space-y-2.5">
                        {safetyResult.interactions.map((inter, i) => (
                          <div
                            key={i}
                            className="rounded-xl border border-zinc-800 bg-zinc-900/90 p-4 text-xs space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white text-sm">
                                {inter.drugA} + {inter.drugB}
                              </span>
                              <Badge
                                variant="outline"
                                className={
                                  inter.severity === "critical"
                                    ? "text-red-400 border-red-800 bg-red-950/40"
                                    : inter.severity === "major"
                                    ? "text-amber-400 border-amber-800 bg-amber-950/40"
                                    : "text-zinc-300 border-zinc-700"
                                }
                              >
                                {inter.severity.toUpperCase()} RISK
                              </Badge>
                            </div>
                            <p className="text-zinc-300 leading-relaxed">
                              <strong className="text-zinc-200">Clinical Effect:</strong> {inter.effect}
                            </p>
                            <div className="rounded-lg bg-zinc-950 p-2.5 text-cyan-300 text-[11px]">
                              <strong>Action & Management:</strong> {inter.management}
                            </div>
                            <div className="text-[10px] text-zinc-500">
                              Evidence Source: {inter.evidenceSource}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contraindication & Allergy Alerts */}
                  {safetyResult.contraindicationAlerts.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                        Patient Safety & Allergy Alerts:
                      </h4>
                      <div className="space-y-1.5">
                        {safetyResult.contraindicationAlerts.map((alert, i) => (
                          <div
                            key={i}
                            className="rounded-lg border border-amber-900/50 bg-amber-950/20 p-2.5 text-xs text-amber-200 flex items-start gap-2"
                          >
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                            <span>{alert.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tri-State Missing Information Notice */}
                  {safetyResult.missingCriticalFields.length > 0 && (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-400 space-y-1">
                      <div className="font-bold text-zinc-300 flex items-center gap-1.5">
                        <Info className="h-3.5 w-3.5 text-cyan-400" />
                        <span>Unknown Clinical Factors:</span>
                      </div>
                      <p>
                        Clinical safety cannot be assumed without complete patient information. The following fields are unknown:{" "}
                        <strong className="text-zinc-200">{safetyResult.missingCriticalFields.join(", ")}</strong>. Please consult a registered pharmacist before taking these medicines.
                      </p>
                    </div>
                  )}

                  {/* Absence of Interaction Disclaimer */}
                  <div className="rounded-xl border border-zinc-900 bg-black p-3.5 text-[11px] text-zinc-500 space-y-1">
                    <div className="font-bold text-zinc-400">Dataset Scope & Safety Limitations:</div>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {safetyResult.limitations.map((lim, i) => (
                        <li key={i}>{lim}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: SAVED MEDICINES (PRIVATE REFERENCE LIST)
        ========================================================================== */}
        {activeTab === "saved" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-900 pb-4">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Bookmark className="h-5 w-5 text-cyan-400" />
                    <span>Your Private Saved Medicines List</span>
                  </h2>
                  <p className="text-xs text-zinc-400">
                    A private reference list of medications you want to explore, discuss with your pharmacist, or keep track of.
                  </p>
                </div>

                {!session?.user?.id && (
                  <div className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400">
                    Guest session: stored locally.{" "}
                    <Link href="/login" className="text-cyan-400 underline font-semibold">
                      Sign in
                    </Link>{" "}
                    to sync across devices.
                  </div>
                )}
              </div>

              {/* Crucial Clinical Distinction Banner */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-400 flex items-start gap-2.5">
                <Info className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-zinc-200">Personal Reference Only:</strong> This list contains educational references you bookmarked. It does <strong className="text-zinc-200">not</strong> constitute an active medical prescription, dosing schedule, or medication administration record.
                </div>
              </div>

              {/* Saved Meds Cards */}
              {savedLoading ? (
                <div className="py-8 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                  <span>Loading your saved reference medicines...</span>
                </div>
              ) : savedMeds.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center space-y-3">
                  <Bookmark className="mx-auto h-8 w-8 text-zinc-600" />
                  <h3 className="text-sm font-semibold text-zinc-300">Your reference list is currently empty</h3>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                    Search medicines in the catalog and click the bookmark icon to save references here for easy access.
                  </p>
                  <Button size="sm" onClick={() => setActiveTab("search")}>
                    Search Approved Medicines
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {savedMeds.map((saved) => (
                    <div
                      key={saved.id}
                      className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-zinc-500">
                            {saved.medicationId}
                          </span>
                          <span className="text-[10px] text-zinc-500">
                            {new Date(saved.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <div>
                          <h3 className="text-base font-bold text-white">{saved.genericName}</h3>
                          {saved.brandName && (
                            <p className="text-xs text-zinc-400">Brand: {saved.brandName}</p>
                          )}
                        </div>

                        {saved.therapeuticClass && (
                          <div className="text-xs text-zinc-400 truncate">
                            Class: <span className="text-zinc-300">{saved.therapeuticClass}</span>
                          </div>
                        )}

                        {/* Personal Notes */}
                        <div className="pt-2 border-t border-zinc-800/80 text-xs">
                          {editingNoteId === saved.id ? (
                            <div className="space-y-1.5">
                              <textarea
                                value={tempNoteText}
                                onChange={(e) => setTempNoteText(e.target.value)}
                                placeholder="Add your personal reference note (e.g. prescribed for seasonal allergies)..."
                                className="w-full rounded border border-zinc-700 bg-zinc-950 p-1.5 text-xs text-white focus:outline-none"
                                rows={2}
                              />
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => setEditingNoteId(null)}
                                  className="text-[10px] text-zinc-400 hover:text-white px-2 py-0.5"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSavedMeds((prev) => {
                                      const next = prev.map((s) =>
                                        s.id === saved.id ? { ...s, notes: tempNoteText } : s
                                      );
                                      localStorage.setItem(
                                        "clinix_local_saved_meds",
                                        JSON.stringify(next)
                                      );
                                      return next;
                                    });
                                    setEditingNoteId(null);
                                  }}
                                  className="rounded bg-blue-600 px-2 py-0.5 text-[10px] text-white"
                                >
                                  Save Note
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-start justify-between gap-2 text-zinc-400">
                              <span className="text-[11px] italic">
                                {saved.notes || "No personal notes added"}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingNoteId(saved.id);
                                  setTempNoteText(saved.notes || "");
                                }}
                                className="text-[10px] text-cyan-400 hover:underline shrink-0"
                              >
                                Edit
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs">
                        <button
                          type="button"
                          onClick={async () => {
                            const found = await defaultMedicationServiceSearch(saved.medicationId);
                            if (found) {
                              openMedicineGuide(found);
                            }
                          }}
                          className="text-cyan-400 hover:underline font-semibold"
                        >
                          View Guide
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSavedMeds((prev) => {
                              const next = prev.filter((s) => s.id !== saved.id);
                              localStorage.setItem(
                                "clinix_local_saved_meds",
                                JSON.stringify(next)
                              );
                              return next;
                            });
                            if (session?.user?.id) {
                              fetch(
                                `/api/medication/saved/${encodeURIComponent(saved.medicationId)}`,
                                { method: "DELETE" }
                              ).catch(() => {});
                            }
                          }}
                          className="text-zinc-500 hover:text-red-400 p-1"
                          title="Remove from saved references"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 5: ASK CLINIX AI (GROUNDED MEDICATION ASSISTANT)
        ========================================================================== */}
        {activeTab === "ask_ai" && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-4">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-blue-400" />
                    <span>Clinix AI Medication Assistant</span>
                  </h2>
                  <p className="text-xs text-zinc-400">
                    Ask questions grounded in verified regulatory medication labels. Clinix explains approved uses, precautions, and helps you prepare questions for your pharmacist.
                  </p>
                </div>

                {/* Medicine Scope Selector */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-400 font-medium">Topic:</span>
                  <select
                    value={aiSelectedMed?.id || "general"}
                    onChange={(e) => {
                      if (e.target.value === "general") {
                        setAiSelectedMed(null);
                      } else {
                        const pool = catalogMeds.length > 0 ? catalogMeds : searchResults;
                        const selected = pool.find((m) => m.id === e.target.value) || null;
                        setAiSelectedMed(selected);
                      }
                    }}
                    className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="general">General Medication Question</option>
                    {(catalogMeds.length > 0 ? catalogMeds : searchResults).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.genericName} ({m.classification === "prescription_only" ? "POM" : "OTC"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Chat Conversation History */}
              <div className="space-y-4 max-h-[480px] overflow-y-auto pr-2">
                {aiChatHistory.length === 0 ? (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 text-center space-y-3">
                    <Sparkles className="mx-auto h-7 w-7 text-blue-400" />
                    <h3 className="text-sm font-semibold text-zinc-200">
                      How can Clinix AI assist with your medication today?
                    </h3>
                    <p className="text-xs text-zinc-400 max-w-md mx-auto">
                      Select one of the verified question prompts below or ask any question about uses, side effects, storage, or what to ask your pharmacist.
                    </p>

                    {/* Pre-made Prompt Chips */}
                    <div className="flex flex-wrap justify-center gap-2 pt-2">
                      {[
                        `What is ${aiSelectedMed?.genericName || "Paracetamol"} used for?`,
                        `Can I take ${aiSelectedMed?.genericName || "this medicine"} with food?`,
                        `What are the most serious side effects to watch for?`,
                        `What questions should I ask my pharmacist?`,
                      ].map((prompt, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleAskMedicationAi(prompt)}
                          className="rounded-full bg-zinc-900 border border-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:border-blue-500 hover:text-white transition"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  aiChatHistory.map((item, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-3 ${
                        item.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      {item.role === "assistant" && (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-xs mt-1">
                          AI
                        </div>
                      )}

                      <div
                        className={`rounded-2xl p-4 text-xs max-w-2xl space-y-2 leading-relaxed ${
                          item.role === "user"
                            ? "bg-blue-600 text-white"
                            : "border border-zinc-800 bg-zinc-900 text-zinc-200"
                        }`}
                      >
                        <div className="whitespace-pre-line">{item.text}</div>

                        {/* If Structured Response Attached */}
                        {item.result && item.result.sourceCitations.length > 0 && (
                          <div className="mt-3 pt-2 border-t border-zinc-800 text-[10px] text-zinc-400 space-y-1">
                            <span className="font-semibold text-zinc-300">Verified Regulatory Source:</span>
                            {item.result.sourceCitations.map((src, sIdx) => (
                              <div key={sIdx} className="truncate">
                                • {src.title} ({src.jurisdiction})
                              </div>
                            ))}
                          </div>
                        )}

                        {item.result && item.result.pharmacistQuestions.length > 0 && (
                          <div className="mt-2 rounded-lg bg-zinc-950 p-2.5 text-[11px] text-cyan-300 space-y-1">
                            <span className="font-bold">Questions for your pharmacist:</span>
                            <ul className="list-disc pl-4 space-y-0.5 text-zinc-300">
                              {item.result.pharmacistQuestions.map((pq, qIdx) => (
                                <li key={qIdx}>{pq}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}

                {aiLoading && (
                  <div className="flex gap-3 items-center text-xs text-zinc-400">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                    <span>Clinix AI is reviewing verified regulatory reference data...</span>
                  </div>
                )}
              </div>

              {/* Chat Input Bar */}
              <div className="pt-2">
                <div className="relative rounded-xl border border-zinc-800 bg-zinc-900/90 p-2 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/20 transition">
                  <textarea
                    rows={2}
                    placeholder={`Ask about ${
                      aiSelectedMed?.genericName || "medications"
                    } (e.g. uses, precautions, when to see a pharmacist)...`}
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleAskMedicationAi();
                      }
                    }}
                    className="w-full resize-none bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none px-2"
                  />
                  <div className="flex items-center justify-between pt-2 px-2 border-t border-zinc-800/60">
                    <span className="text-[10px] text-zinc-500">
                      Press Enter to send • Individual dosage calculations are safely refused
                    </span>
                    <Button
                      size="sm"
                      onClick={() => handleAskMedicationAi()}
                      disabled={!aiQuestion.trim() || aiLoading}
                      className="bg-blue-600 hover:bg-blue-500 text-white h-7 px-3 text-xs"
                    >
                      <Send className="h-3 w-3 mr-1" />
                      <span>Send</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            FEEDBACK / DISCREPANCY REPORT MODAL
        ========================================================================== */}
        {feedbackOpen && feedbackMed && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                <div className="space-y-0.5">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Flag className="h-4 w-4 text-cyan-400" />
                    <span>Report Reference Discrepancy</span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {feedbackMed.genericName} ({feedbackMed.id})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFeedbackOpen(false)}
                  className="rounded-lg p-1 text-zinc-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {feedbackSuccess ? (
                <div className="rounded-xl border border-emerald-900 bg-emerald-950/40 p-4 text-center text-xs text-emerald-300 space-y-1">
                  <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-400" />
                  <p className="font-semibold">Thank you for helping keep Clinix accurate!</p>
                  <p>Your correction report has been forwarded to the clinical governance team.</p>
                </div>
              ) : (
                <form onSubmit={handleFeedbackSubmit} className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <label className="text-zinc-300 font-semibold">Feedback Type:</label>
                    <select
                      value={feedbackType}
                      onChange={(e) => setFeedbackType(e.target.value as any)}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-white"
                    >
                      <option value="general_feedback">General Feedback</option>
                      <option value="incorrect_information">Incorrect Information</option>
                      <option value="missing_warning">Missing Warning or Contraindication</option>
                      <option value="dosage_discrepancy">Label Packaging Discrepancy</option>
                      <option value="side_effect_update">Adverse Effect Update</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-zinc-300 font-semibold">Details of Discrepancy:</label>
                    <textarea
                      required
                      rows={4}
                      value={feedbackDetails}
                      onChange={(e) => setFeedbackDetails(e.target.value)}
                      placeholder="Please specify what part of the medication information appears incomplete, outdated, or discrepancies with official packaging..."
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-zinc-300 font-semibold">Your Contact Email (Optional):</label>
                    <Input
                      type="email"
                      value={feedbackEmail}
                      onChange={(e) => setFeedbackEmail(e.target.value)}
                      placeholder="To receive updates on clinical review"
                      className="bg-zinc-900 border-zinc-800 text-xs h-9"
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setFeedbackOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={feedbackSubmitting || !feedbackDetails.trim()}
                      className="bg-blue-600 hover:bg-blue-500 text-white"
                    >
                      {feedbackSubmitting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                      <span>Submit Report</span>
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            DEDICATED EMERGENCY ESCALATION MODAL
        ========================================================================== */}
        {emergencyAlertOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
            <div className="w-full max-w-md rounded-2xl border border-red-800 bg-zinc-950 p-6 space-y-4 shadow-2xl text-center">
              <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-full bg-red-600/20 text-red-500 border border-red-500/30 animate-pulse">
                <ShieldAlert className="h-6 w-6" />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-extrabold text-white">Emergency Warning Detected</h3>
                <p className="text-xs text-red-300 font-medium leading-relaxed">
                  {emergencyReason || "Possible acute overdose, toxic ingestion, or severe allergic reaction."}
                </p>
              </div>

              <div className="rounded-xl bg-red-950/40 border border-red-900/60 p-4 text-xs text-slate-200 text-left space-y-2">
                <p className="font-semibold text-white">Immediate Instructions:</p>
                <ul className="list-disc pl-4 space-y-1 text-red-200">
                  <li>Call national emergency ambulance services immediately.</li>
                  <li>Do not induce vomiting unless advised by poison control.</li>
                  <li>Keep medication bottle or packaging ready for responders.</li>
                </ul>
              </div>

              <div className="space-y-2 pt-2">
                <a
                  href="tel:112"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 py-3 text-sm font-extrabold text-white transition active:scale-95 shadow-lg"
                >
                  <PhoneCall className="h-4 w-4" />
                  <span>Call Emergency Ambulance (112)</span>
                </a>

                <button
                  type="button"
                  onClick={() => setEmergencyAlertOpen(false)}
                  className="w-full text-xs text-zinc-500 hover:text-zinc-300 py-1"
                >
                  I am safe, close this alert
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Fallback search helper for local items
async function defaultMedicationServiceSearch(id: string): Promise<ApprovedMedication | null> {
  try {
    const res = await fetch(`/api/medication/${encodeURIComponent(id)}`);
    if (res.ok) {
      const json = await res.json();
      return json.data;
    }
  } catch {
    //
  }
  return null;
}
