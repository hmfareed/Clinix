"use client";

import * as React from "react";
import {
  Cpu,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  Activity,
  Loader2,
  Save,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function AdminAiGovernancePage() {
  const [config, setConfig] = React.useState<any>(null);
  const [availableModels, setAvailableModels] = React.useState<any[]>([]);
  const [availablePrompts, setAvailablePrompts] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const [selectedModel, setSelectedModel] = React.useState("");
  const [selectedPrompt, setSelectedPrompt] = React.useState("");
  const [temperature, setTemperature] = React.useState<number>(0);
  const [feedbackMsg, setFeedbackMsg] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchAiConfig = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/ai-config");
      const json = await res.json();
      if (json.data) {
        setConfig(json.data);
        setSelectedModel(json.data.activeModelId);
        setSelectedPrompt(json.data.activePromptVersion);
        setTemperature(json.data.temperature ?? 0);
      }
      if (json.availableModels) setAvailableModels(json.availableModels);
      if (json.availablePrompts) setAvailablePrompts(json.availablePrompts);
    } catch (err) {
      console.error("Error loading AI config:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchAiConfig();
  }, [fetchAiConfig]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedbackMsg(null);

    try {
      const res = await fetch("/api/admin/ai-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activeModelId: selectedModel,
          activePromptVersion: selectedPrompt,
          temperature,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFeedbackMsg({ type: "error", text: json.error?.message || "Failed to update configuration." });
      } else {
        setFeedbackMsg({ type: "success", text: json.message });
        fetchAiConfig();
      }
    } catch {
      setFeedbackMsg({ type: "error", text: "Network error saving AI configuration." });
    } finally {
      setSaving(false);
    }
  };

  const handleRollback = async () => {
    if (!confirm("Rollback active model to default stable Llama 3.1 70B Instruct?")) return;
    try {
      const res = await fetch("/api/admin/ai-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          activeModelId: "meta/llama-3.1-70b-instruct",
          activePromptVersion: "assessment-v1",
          temperature: 0,
        }),
      });
      if (res.ok) {
        setFeedbackMsg({ type: "success", text: "Successfully rolled back to baseline model & prompt." });
        fetchAiConfig();
      }
    } catch {
      setFeedbackMsg({ type: "error", text: "Rollback failed." });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in-50 duration-200">
      <div>
        <h1 className="text-2xl font-extrabold text-white">
          AI Model & Prompt Governance
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Model rollout controls, prompt versioning, and golden-case evaluation metrics per file 23.
        </p>
      </div>

      {feedbackMsg && (
        <div
          className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
            feedbackMsg.type === "success"
              ? "bg-teal-950/60 border border-teal-500 text-teal-300"
              : "bg-red-950/60 border border-red-500 text-red-300"
          }`}
        >
          {feedbackMsg.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 text-teal-400" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-400" />
          )}
          {feedbackMsg.text}
        </div>
      )}

      {/* Evaluation Metrics Card */}
      <Card className="border-teal-500/40 bg-slate-950/60">
        <CardHeader className="pb-3 border-b border-slate-800">
          <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
            <Activity className="h-4 w-4 text-teal-400" />
            Golden-Case Clinical Evaluation Results
          </CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Automated evaluation suite testing pre-AI rules, inference outputs, and post-generation gate
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
            <p className="text-slate-400 font-semibold uppercase text-[10px]">Missed Emergencies</p>
            <p className="text-2xl font-extrabold text-teal-400">
              {config?.missedEmergenciesCount ?? 0}
            </p>
            <p className="text-[10px] text-slate-500">Target: Strictly 0</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
            <p className="text-slate-400 font-semibold uppercase text-[10px]">Eval Suite Pass Rate</p>
            <p className="text-2xl font-extrabold text-teal-400">
              {config?.evalPassRate ?? 100}%
            </p>
            <p className="text-[10px] text-slate-500">Schema & safety verified</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
            <p className="text-slate-400 font-semibold uppercase text-[10px]">Clinical Temperature</p>
            <p className="text-2xl font-extrabold text-white">
              {config?.temperature ?? 0}
            </p>
            <p className="text-[10px] text-slate-500">Deterministic clinical output</p>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Form */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-teal-400" />
        </div>
      ) : (
        <Card className="border-slate-800 bg-slate-950/40">
          <CardHeader className="pb-3 border-b border-slate-800">
            <CardTitle className="text-base font-bold text-white flex items-center justify-between">
              <span>Production Model Configuration</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRollback}
                className="text-xs border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Rollback to Baseline
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Active NVIDIA NIM Model ID
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                >
                  {availableModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.id})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500">
                  Never swap models in production without running the golden-case evaluation suite first.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Active System Prompt Version
                </label>
                <select
                  value={selectedPrompt}
                  onChange={(e) => setSelectedPrompt(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                >
                  {availablePrompts.map((p) => (
                    <option key={p.version} value={p.version}>
                      {p.version} ({p.status.replace(/_/g, " ")})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-1.5 h-3.5 w-3.5" />
                      Update Model Config
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
