"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import {
  UserCheck,
  ShieldCheck,
  AlertTriangle,
  Save,
  CheckCircle2,
  Info,
  Loader2,
  Phone,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TriState } from "@/lib/safety/types";
import { PregnancyStatus } from "@/lib/medication/types";

export default function HealthProfilePage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Profile Fields (Tri-State Defaults)
  const [ageInput, setAgeInput] = React.useState<string>("");
  const [pregnancy, setPregnancy] = React.useState<PregnancyStatus>("unknown");
  const [allergiesStatus, setAllergiesStatus] = React.useState<TriState>("unknown");
  const [allergiesText, setAllergiesText] = React.useState<string>("");
  const [medsStatus, setMedsStatus] = React.useState<TriState>("unknown");
  const [medsText, setMedsText] = React.useState<string>("");
  const [contactName, setContactName] = React.useState<string>("");
  const [contactPhone, setContactPhone] = React.useState<string>("");
  const [contactRel, setContactRel] = React.useState<string>("");

  React.useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/patients/me")
        .then((res) => res.json())
        .then((json) => {
          if (json.data) {
            const d = json.data;
            if (d.ageYears !== null && d.ageYears !== undefined) {
              setAgeInput(String(d.ageYears));
            }
            if (d.pregnancy) setPregnancy(d.pregnancy);
            if (d.allergies) {
              setAllergiesStatus(d.allergies.status || "unknown");
              setAllergiesText((d.allergies.items || []).join(", "));
            }
            if (d.currentMedicines) {
              setMedsStatus(d.currentMedicines.status || "unknown");
              setMedsText((d.currentMedicines.items || []).join(", "));
            }
            if (d.emergencyContact) {
              setContactName(d.emergencyContact.name || "");
              setContactPhone(d.emergencyContact.phone || "");
              setContactRel(d.emergencyContact.relationship || "");
            }
          }
        })
        .catch((err) => console.error("Error loading profile:", err))
        .finally(() => setLoading(false));
    } else if (status === "unauthenticated") {
      setLoading(false);
    }
  }, [status]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    const parsedAge = ageInput.trim() !== "" ? Number(ageInput) : null;
    const allergyItems =
      allergiesStatus === "yes" && allergiesText.trim()
        ? allergiesText.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
    const medItems =
      medsStatus === "yes" && medsText.trim()
        ? medsText.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

    try {
      const res = await fetch("/api/patients/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
          emergencyContact: contactName || contactPhone
            ? {
                name: contactName,
                phone: contactPhone,
                relationship: contactRel,
              }
            : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error?.message || "Failed to update profile.");
      } else {
        setSuccessMsg("Health profile updated successfully.");
      }
    } catch {
      setErrorMsg("Network error saving profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl animate-in fade-in-50 duration-200">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
          Personal Health Profile
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Optional health background used to evaluate contraindications and medication interactions.
        </p>
      </div>

      {/* Safety Notice */}
      <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-3.5 text-xs text-teal-900 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-200 flex items-start gap-2.5">
        <Info className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
        <div>
          <strong>Tri-State Clinical Model:</strong> Clinix treats unanswered or unknown fields as{" "}
          <em>"unknown"</em>, never as negative. Providing your age and known allergies prevents unnecessary clinical referral blockers during assessments and medication queries.
        </div>
      </div>

      {successMsg && (
        <div className="rounded-lg border border-teal-300 bg-teal-50 p-3 text-xs font-semibold text-teal-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-teal-600" />
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs font-semibold text-red-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <Card className="border-slate-200 shadow-sm dark:border-slate-800">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
              Clinical Baseline Details
            </CardTitle>
            <CardDescription className="text-xs">
              Basic physiological details for medication safety and age-based triage
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-4">
            {/* Age */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex justify-between">
                <span>Age in Years</span>
                <span className="text-[11px] text-slate-500 font-normal">Optional</span>
              </label>
              <Input
                type="number"
                min="0"
                max="125"
                placeholder="e.g. 29"
                value={ageInput}
                onChange={(e) => setAgeInput(e.target.value)}
              />
            </div>

            {/* Pregnancy */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Pregnancy Status
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(["no", "yes", "unknown", "not_applicable"] as PregnancyStatus[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setPregnancy(st)}
                    className={`rounded-md py-2 text-xs font-medium capitalize border transition ${
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

            {/* Allergies */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Known Drug Allergies
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["no", "yes", "unknown"] as TriState[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setAllergiesStatus(st)}
                    className={`rounded-md py-2 text-xs font-medium capitalize border transition ${
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
                <div className="pt-1.5 space-y-1">
                  <Input
                    type="text"
                    placeholder="Enter allergies separated by commas (e.g. Penicillin, Aspirin, Sulfa)"
                    value={allergiesText}
                    onChange={(e) => setAllergiesText(e.target.value)}
                    className="text-xs"
                  />
                  <p className="text-[11px] text-slate-500">
                    Separate multiple allergies with commas.
                  </p>
                </div>
              )}
            </div>

            {/* Current Medicines */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Current Medications
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["no", "yes", "unknown"] as TriState[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setMedsStatus(st)}
                    className={`rounded-md py-2 text-xs font-medium capitalize border transition ${
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
                <div className="pt-1.5 space-y-1">
                  <Input
                    type="text"
                    placeholder="Enter regular medicines separated by commas (e.g. Warfarin, Lisinopril, Metformin)"
                    value={medsText}
                    onChange={(e) => setMedsText(e.target.value)}
                    className="text-xs"
                  />
                  <p className="text-[11px] text-slate-500">
                    Used to detect potential drug-drug interactions.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Emergency Contact Card */}
        <Card className="border-slate-200 shadow-sm dark:border-slate-800">
          <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Phone className="h-4 w-4 text-teal-600" />
              Optional Emergency Contact
            </CardTitle>
            <CardDescription className="text-xs">
              Trusted contact for emergency escalation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Contact Name
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Kwame Mensah"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Phone Number
                </label>
                <Input
                  type="tel"
                  placeholder="e.g. +233 24 123 4567"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Relationship
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Spouse / Sibling"
                  value={contactRel}
                  onChange={(e) => setContactRel(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={saving}
            className="bg-teal-600 hover:bg-teal-700 text-white font-semibold"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving Profile...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Health Profile
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
