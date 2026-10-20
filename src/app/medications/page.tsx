"use client";

import * as React from "react";
import Link from "next/link";
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
} from "@/lib/medication/types";
import { TriState } from "@/lib/safety/types";

const FEATURED_MEDICATIONS = [
  { name: "Paracetamol", tag: "OTC Analgesic" },
  { name: "Oral Rehydration Salts (ORS)", tag: "OTC Hydration" },
  { name: "Ibuprofen", tag: "OTC / Caution" },
  { name: "Cetirizine", tag: "OTC Antihistamine" },
  { name: "Artemether + Lumefantrine", tag: "POM Antimalarial" },
  { name: "Amoxicillin", tag: "POM Antibiotic" },
  { name: "Magnesium Trisilicate", tag: "OTC Antacid" },
  { name: "Aspirin", tag: "Age Restricted" },
];

export default function MedicationsPage() {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [userQuestion, setUserQuestion] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<MedicationEvaluationResult | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Patient Clinical Context (Tri-State Default is "unknown" to guarantee safety)
  const [ageInput, setAgeInput] = React.useState<string>("");
  const [pregnancy, setPregnancy] = React.useState<PregnancyStatus>("unknown");
  const [allergiesStatus, setAllergiesStatus] = React.useState<TriState>("unknown");
  const [allergiesText, setAllergiesText] = React.useState<string>("");
  const [medsStatus, setMedsStatus] = React.useState<TriState>("unknown");
  const [medsText, setMedsText] = React.useState<string>("");
  const [symptomsText, setSymptomsText] = React.useState<string>("");

  // Autocomplete / Search list
  const [catalog, setCatalog] = React.useState<Array<{ genericName: string; brandNames: string[] }>>([]);

  React.useEffect(() => {
    // Pre-fetch search list for quick chips
    fetch("/api/medication/search")
      .then((res) => res.json())
      .then((data) => {
        if (data.data) {
          setCatalog(data.data);
        }
      })
      .catch(() => {});
  }, []);

  const handleQuery = async (medicineToSearch?: string) => {
    const medName = medicineToSearch || searchTerm;
    if (!medName.trim()) {
      setErrorMsg("Please enter a medicine or active ingredient name.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const parsedAge = ageInput.trim() !== "" ? Number(ageInput) : undefined;

    const allergyItems =
      allergiesStatus === "yes" && allergiesText.trim()
        ? allergiesText.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

    const medItems =
      medsStatus === "yes" && medsText.trim()
        ? medsText.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

    try {
      const response = await fetch("/api/medication/info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medicationName: medName,
          patientContext: {
            ageYears: parsedAge,
            pregnancy,
            allergies: {
              status: allergiesStatus,
              items: allergyItems,
            },
            currentMedicines: {
              status: medsStatus,
              items: medItems,
            },
            symptomsOrComplaint: symptomsText.trim() || undefined,
            userQuestion: userQuestion.trim() || undefined,
          },
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        setErrorMsg(json.error?.message || "Failed to retrieve medication information.");
        setResult(null);
      } else {
        setResult(json.data);
      }
    } catch {
      setErrorMsg("Network error connecting to medication safety service. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8 dark:bg-slate-950">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3.5 py-1 text-xs font-semibold text-teal-700 ring-1 ring-inset ring-teal-600/20 dark:bg-teal-950/40 dark:text-teal-300">
            <Pill className="h-4 w-4" />
            <span>Ghana Approved Medication Reference</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
            Medication Safety & Reference Guide
          </h1>
          <p className="mx-auto max-w-2xl text-base text-slate-600 dark:text-slate-400">
            Search approved medicines, check contraindications, and review clinical safety notes.
            Clinix operates under strict clinical rules: <strong className="font-semibold text-slate-800 dark:text-slate-200">zero dosage calculations</strong>, <strong className="font-semibold text-slate-800 dark:text-slate-200">no automatic prescriptions</strong>, and <strong className="font-semibold text-slate-800 dark:text-slate-200">mandatory pharmacist referral</strong> when clinical details are unknown.
          </p>
        </div>

        {/* Search & Patient Safety Context Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Search & Context Inputs */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="border-slate-200 shadow-sm dark:border-slate-800">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2 text-slate-900 dark:text-white">
                  <Search className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                  1. Search Medication
                </CardTitle>
                <CardDescription>
                  Enter an active ingredient or brand name registered in Ghana
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Medicine / Brand Name
                  </label>
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="e.g. Paracetamol, Panadol, Ibuprofen, Coartem..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleQuery();
                        }
                      }}
                      className="pr-10"
                    />
                    <Pill className="absolute right-3 top-2.5 h-5 w-5 text-slate-400" />
                  </div>
                </div>

                {/* Popular Quick Chips */}
                <div className="space-y-1.5">
                  <span className="text-xs text-slate-500 font-medium">Common Ghanaian Medicines:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {FEATURED_MEDICATIONS.map((med) => (
                      <button
                        key={med.name}
                        type="button"
                        onClick={() => {
                          setSearchTerm(med.name);
                          handleQuery(med.name);
                        }}
                        className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-teal-50 hover:text-teal-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-teal-950 dark:hover:text-teal-300"
                      >
                        {med.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Specific Question (Optional)
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. Can I take this with food?"
                    value={userQuestion}
                    onChange={(e) => setUserQuestion(e.target.value)}
                  />
                  <p className="text-[11px] text-slate-500">
                    Note: Requests for specific doses or weight calculations will be refused for safety.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Tri-State Safety Context Form */}
            <Card className="border-teal-200 bg-teal-50/20 shadow-sm dark:border-teal-900/50 dark:bg-teal-950/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between text-slate-900 dark:text-white">
                  <span className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-teal-600" />
                    2. Patient Safety Context
                  </span>
                  <Badge variant="outline" className="text-xs border-teal-300 text-teal-800 dark:border-teal-700 dark:text-teal-300">
                    Tri-State Logic
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  Ghanaian clinical safety rules require checking age, pregnancy, allergies, and existing medicines before suitability can be confirmed.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Age Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex justify-between">
                    <span>Patient Age (Years)</span>
                    <span className="text-[11px] text-amber-700 dark:text-amber-400">Required for suitability</span>
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="120"
                    placeholder="e.g. 28 (Leave blank if unknown)"
                    value={ageInput}
                    onChange={(e) => setAgeInput(e.target.value)}
                  />
                </div>

                {/* Pregnancy Status (Tri-State) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Pregnancy Status
                  </label>
                  <div className="grid grid-cols-4 gap-1">
                    {(["no", "yes", "unknown", "not_applicable"] as PregnancyStatus[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setPregnancy(st)}
                        className={`rounded-md py-1.5 text-xs font-medium capitalize border transition ${
                          pregnancy === st
                            ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                        }`}
                      >
                        {st === "not_applicable" ? "N / A" : st}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Allergies (Tri-State) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Known Drug Allergies
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {(["no", "yes", "unknown"] as TriState[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setAllergiesStatus(st)}
                        className={`rounded-md py-1.5 text-xs font-medium capitalize border transition ${
                          allergiesStatus === st
                            ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                  {allergiesStatus === "yes" && (
                    <Input
                      type="text"
                      placeholder="e.g. Penicillin, Aspirin, Sulfa drugs"
                      value={allergiesText}
                      onChange={(e) => setAllergiesText(e.target.value)}
                      className="mt-1.5 text-xs"
                    />
                  )}
                </div>

                {/* Current Medicines (Tri-State) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Currently Taking Other Medications?
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {(["no", "yes", "unknown"] as TriState[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setMedsStatus(st)}
                        className={`rounded-md py-1.5 text-xs font-medium capitalize border transition ${
                          medsStatus === st
                            ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                  {medsStatus === "yes" && (
                    <Input
                      type="text"
                      placeholder="e.g. Warfarin, Ciprofloxacin, Lisinopril"
                      value={medsText}
                      onChange={(e) => setMedsText(e.target.value)}
                      className="mt-1.5 text-xs"
                    />
                  )}
                </div>

                {/* Acute Symptoms or Complaint (For emergency red flags) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Current Symptoms (To check emergency warning signs)
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. Mild headache, fever (optional)"
                    value={symptomsText}
                    onChange={(e) => setSymptomsText(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </CardContent>
              <CardFooter className="pt-2">
                <Button
                  onClick={() => handleQuery()}
                  disabled={loading || !searchTerm.trim()}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Evaluating Safety...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="mr-2 h-4 w-4" />
                      Check Medication & Safety
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Right Column: Guidance & Results */}
          <div className="lg:col-span-7 space-y-6">
            {errorMsg && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
                <div>
                  <p className="font-semibold">Query Error</p>
                  <p>{errorMsg}</p>
                </div>
              </div>
            )}

            {!result && !loading && (
              <Card className="border-dashed border-slate-300 bg-white/50 p-8 text-center dark:border-slate-800 dark:bg-slate-900/30">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400">
                  <Pill className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
                  No Medication Evaluated Yet
                </h3>
                <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto dark:text-slate-400">
                  Select a medicine from the left or type any brand/generic name to view approved Ghanaian clinical indications, precautions, and contraindication checks.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchTerm("Paracetamol");
                      handleQuery("Paracetamol");
                    }}
                  >
                    View Paracetamol Guide
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchTerm("Oral Rehydration Salts (ORS)");
                      handleQuery("Oral Rehydration Salts (ORS)");
                    }}
                  >
                    View ORS Guide
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchTerm("Coartem");
                      handleQuery("Coartem");
                    }}
                  >
                    View Coartem (POM)
                  </Button>
                </div>
              </Card>
            )}

            {/* RESULTS VIEW */}
            {result && (
              <div className="space-y-6 animate-in fade-in-50 duration-200">
                {/* 1. EMERGENCY ESCALATION BANNER (If Emergency Detected) */}
                {result.status === "emergency_blocked" && (
                  <div className="rounded-xl border-2 border-red-600 bg-red-50 p-6 shadow-md dark:bg-red-950/40">
                    <div className="flex items-start gap-4">
                      <div className="rounded-full bg-red-600 p-2 text-white">
                        <AlertOctagon className="h-6 w-6 animate-pulse" />
                      </div>
                      <div className="space-y-3">
                        <h3 className="text-xl font-extrabold text-red-900 dark:text-red-200">
                          Emergency Warning Signs Detected
                        </h3>
                        <p className="text-sm font-semibold text-red-800 dark:text-red-300">
                          {result.referral.reason}
                        </p>
                        <p className="text-xs text-red-700 dark:text-red-400">
                          Do not delay emergency medical care to seek or administer medication. Immediate hospital evaluation is required.
                        </p>
                        <div className="flex flex-wrap gap-3 pt-2">
                          <a
                            href="tel:112"
                            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-red-700"
                          >
                            <PhoneCall className="h-4 w-4" />
                            Call Ghana Emergency 112
                          </a>
                          <Link href="/clinics">
                            <Button variant="outline" className="border-red-300 text-red-800 hover:bg-red-100">
                              Find Nearest Emergency Clinic
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. PRESCRIPTION-ONLY MEDICINE WARNING (If POM) */}
                {result.status === "prescription_only_blocked" && (
                  <div className="rounded-xl border-2 border-purple-500 bg-purple-50 p-5 shadow-sm dark:bg-purple-950/30">
                    <div className="flex items-start gap-3">
                      <ShieldAlert className="h-6 w-6 text-purple-600 shrink-0 mt-0.5" />
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-purple-900 dark:text-purple-200">
                            Prescription-Only Medicine (POM)
                          </h3>
                          <Badge className="bg-purple-700 text-white">Doctor Prescription Required</Badge>
                        </div>
                        <p className="text-sm text-purple-800 dark:text-purple-300">
                          {result.medication?.genericName} is classified as a Prescription-Only Medicine under Ghana FDA regulations.
                          Clinix strictly does not recommend initiating, dispensing, or self-administering prescription medicines.
                        </p>
                        <div className="pt-1">
                          <Link href="/clinics">
                            <Button size="sm" className="bg-purple-700 hover:bg-purple-800 text-white text-xs">
                              Find a Medical Clinic for Prescription
                              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. MISSING INFORMATION / TRI-STATE REFERRAL BANNER */}
                {result.status === "requires_consultation" && result.missingCriticalFields.length > 0 && (
                  <div className="rounded-xl border-2 border-amber-500 bg-amber-50 p-5 shadow-sm dark:bg-amber-950/30">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-amber-900 dark:text-amber-200">
                            Consultation Required: Missing Clinical Information
                          </h3>
                          <Badge variant="outline" className="border-amber-400 text-amber-800">
                            Safety Bounded
                          </Badge>
                        </div>
                        <p className="text-sm text-amber-800 dark:text-amber-300">
                          {result.referral.reason}
                        </p>
                        <div className="rounded-md bg-amber-100/70 p-2.5 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                          <strong>Missing or Unknown Fields:</strong>{" "}
                          <span className="font-mono">{result.missingCriticalFields.join(", ").replace(/_/g, " ")}</span>.
                          In clinical safety, missing details are never assumed to be safe or negative.
                        </div>
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                          Please consult a licensed pharmacist or clinic officer with your complete health profile.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. DOSAGE REFUSAL NOTICE (If user asked about dosage) */}
                {result.dosageRefusalNotice && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200 flex items-start gap-3">
                    <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-blue-950 dark:text-blue-100">Dosage Policy Notice</p>
                      <p className="text-xs mt-1 text-blue-800 dark:text-blue-300">
                        {result.dosageRefusalNotice}
                      </p>
                    </div>
                  </div>
                )}

                {/* 5. CONTRAINDICATION / INTERACTION ALERTS */}
                {result.contraindicationAlerts.length > 0 && (
                  <div className="space-y-2">
                    {result.contraindicationAlerts.map((alert, idx) => (
                      <div
                        key={idx}
                        className={`rounded-xl border p-4 text-sm flex items-start gap-3 ${
                          alert.severity === "critical"
                            ? "border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
                            : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                        }`}
                      >
                        <ShieldAlert
                          className={`h-5 w-5 shrink-0 mt-0.5 ${
                            alert.severity === "critical" ? "text-red-600" : "text-amber-600"
                          }`}
                        />
                        <div>
                          <p className="font-bold capitalize">{alert.type.replace(/_/g, " ")} Alert</p>
                          <p className="text-xs mt-0.5">{alert.message}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 6. APPROVED REFERENCE CONTENT CARD */}
                {result.medication && (
                  <Card className="border-slate-200 shadow-sm dark:border-slate-800">
                    <CardHeader className="border-b border-slate-100 pb-4 dark:border-slate-800">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <CardTitle className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            {result.medication.genericName}
                          </CardTitle>
                          <CardDescription className="text-xs mt-1">
                            Therapeutic Class: <strong className="text-slate-700 dark:text-slate-300">{result.medication.therapeuticClass}</strong>
                          </CardDescription>
                        </div>
                        <Badge
                          className={`capitalize text-xs px-3 py-1 ${
                            result.medication.classification === "over_the_counter"
                              ? "bg-teal-600 text-white"
                              : "bg-purple-700 text-white"
                          }`}
                        >
                          {result.medication.classification.replace(/_/g, " ")}
                        </Badge>
                      </div>

                      {/* Brand Names */}
                      <div className="pt-2 flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="font-semibold text-slate-500">Registered Ghanaian Brands:</span>
                        {result.medication.brandNames.map((b) => (
                          <span
                            key={b}
                            className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-5 pt-5 text-sm">
                      {/* Approved Indications */}
                      <div className="space-y-1.5">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                          Approved Indications (Ghana MoH)
                        </h4>
                        <ul className="list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-300 text-xs">
                          {result.medication.approvedIndications.map((ind, i) => (
                            <li key={i}>{ind}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Administration & Packaging Warnings */}
                      <div className="space-y-1.5">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                          Safety & Administration Precautions
                        </h4>
                        <ul className="list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-300 text-xs">
                          {result.medication.administrationWarnings.map((warn, i) => (
                            <li key={i}>{warn}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Common Side Effects */}
                      <div className="space-y-1.5">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                          Common Known Side Effects
                        </h4>
                        <ul className="list-disc pl-5 space-y-1 text-slate-700 dark:text-slate-300 text-xs">
                          {result.medication.commonSideEffects.map((se, i) => (
                            <li key={i}>{se}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Known Interactions */}
                      {result.medication.interactions.length > 0 && (
                        <div className="space-y-1.5">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                            Key Drug Interactions (Maintained Dataset)
                          </h4>
                          <div className="space-y-1.5">
                            {result.medication.interactions.map((inter, i) => (
                              <div
                                key={i}
                                className="rounded-md bg-slate-50 p-2.5 text-xs dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                              >
                                <span className="font-semibold text-slate-900 dark:text-slate-100">
                                  {inter.medicineOrClass}:
                                </span>{" "}
                                <span className="text-slate-600 dark:text-slate-400">{inter.effect}</span>{" "}
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ml-1.5 uppercase ${
                                    inter.severity === "major" ? "border-red-400 text-red-700" : "border-amber-400 text-amber-700"
                                  }`}
                                >
                                  {inter.severity}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Mandatory Dosing Disclaimer */}
                      <div className="rounded-lg bg-slate-100/80 p-3 text-xs text-slate-600 dark:bg-slate-800/80 dark:text-slate-400 flex items-start gap-2.5">
                        <Info className="h-4 w-4 shrink-0 mt-0.5 text-slate-500" />
                        <div>
                          <strong>Dosing Notice:</strong> {result.medication.dosageDisclaimer}
                        </div>
                      </div>
                    </CardContent>

                    <CardFooter className="border-t border-slate-100 bg-slate-50/50 px-6 py-3 text-[11px] text-slate-500 flex flex-wrap justify-between items-center gap-2 dark:border-slate-800 dark:bg-slate-900/50">
                      <div>
                        Reference: <span className="font-medium text-slate-700 dark:text-slate-300">{result.medication.referenceSource.name}</span> ({result.medication.referenceSource.version})
                      </div>
                      <div>
                        Reviewed by: <span className="font-medium text-slate-700 dark:text-slate-300">{result.medication.referenceSource.reviewedBy}</span>
                      </div>
                    </CardFooter>
                  </Card>
                )}

                {/* Care Navigation Links */}
                <div className="flex flex-wrap gap-3 items-center justify-between p-4 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      Need a clinical consultation or pharmacy?
                    </p>
                    <p className="text-xs text-slate-500">
                      Find licensed pharmacies, clinics, and health centers near you across Ghana.
                    </p>
                  </div>
                  <Link href="/clinics">
                    <Button variant="outline" size="sm" className="border-teal-600 text-teal-700 hover:bg-teal-50">
                      Find Nearby Pharmacies & Clinics
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
