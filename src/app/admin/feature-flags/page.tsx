"use client";

import * as React from "react";
import {
  ToggleLeft,
  ToggleRight,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function AdminFeatureFlagsPage() {
  const [flags, setFlags] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [togglingKey, setTogglingKey] = React.useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchFlags = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/feature-flags");
      const json = await res.json();
      if (json.data) {
        setFlags(json.data);
      }
    } catch (err) {
      console.error("Error loading flags:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const handleToggle = async (key: string, currentEnabled: boolean) => {
    const actionDesc = currentEnabled ? "ENGAGE KILL SWITCH (DISABLE)" : "RE-ENABLE";
    if (!confirm(`Are you sure you want to ${actionDesc} for '${key}'? This will immediately affect live production traffic.`)) {
      return;
    }

    setTogglingKey(key);
    setFeedbackMsg(null);

    try {
      const res = await fetch(`/api/admin/feature-flags/${key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !currentEnabled }),
      });
      const json = await res.json();

      if (!res.ok) {
        setFeedbackMsg({ type: "error", text: json.error?.message || "Failed to toggle flag." });
      } else {
        setFeedbackMsg({ type: "success", text: json.message });
        fetchFlags();
      }
    } catch {
      setFeedbackMsg({ type: "error", text: "Network error toggling feature flag." });
    } finally {
      setTogglingKey(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in-50 duration-200">
      <div>
        <h1 className="text-2xl font-extrabold text-white">
          Emergency Kill Switches & Feature Flags
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Safety circuit breakers. Disabling an unsafe model, medication module, or facility search takes effect immediately across all endpoints without application redeployment.
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

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-teal-400" />
        </div>
      ) : (
        <div className="space-y-4">
          {flags.map((f) => (
            <Card
              key={f.key}
              className={`border transition shadow-sm ${
                !f.enabled
                  ? "border-red-600 bg-red-950/30"
                  : "border-slate-800 bg-slate-950/50"
              }`}
            >
              <CardContent className="p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1.5 max-w-lg">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white">{f.name}</span>
                    <Badge
                      className={`text-[10px] font-mono ${
                        f.enabled
                          ? "bg-teal-950 text-teal-300 border border-teal-500/40"
                          : "bg-red-950 text-red-300 border border-red-500"
                      }`}
                    >
                      {f.enabled ? "ACTIVE (ENABLED)" : "KILL SWITCH ENGAGED (DISABLED)"}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400">{f.description}</p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Flag Key: {f.key} • Updated by: {f.updatedBy}
                  </p>
                </div>

                <div>
                  <Button
                    size="sm"
                    onClick={() => handleToggle(f.key, f.enabled)}
                    disabled={togglingKey === f.key}
                    className={`text-xs font-bold transition ${
                      f.enabled
                        ? "bg-red-600 hover:bg-red-700 text-white"
                        : "bg-teal-600 hover:bg-teal-700 text-white"
                    }`}
                  >
                    {togglingKey === f.key ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : f.enabled ? (
                      <ToggleLeft className="mr-1.5 h-4 w-4" />
                    ) : (
                      <ToggleRight className="mr-1.5 h-4 w-4" />
                    )}
                    {f.enabled ? "Trigger Kill Switch" : "Re-Enable Module"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
