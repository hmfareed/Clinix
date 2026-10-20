"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  ShieldAlert,
  GitBranch,
  Cpu,
  ToggleLeft,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Loader2,
  Server,
  Lock,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function AdminOverviewPage() {
  const [metrics, setMetrics] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/admin/metrics")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          setErrorMsg(json.error?.message || "Failed to load admin metrics.");
        } else {
          setMetrics(json.data);
        }
      })
      .catch(() => setErrorMsg("Network error connecting to admin metrics API."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
      </div>
    );
  }

  if (errorMsg || !metrics) {
    return (
      <Card className="border-red-900 bg-red-950/30 p-8 text-center text-slate-200">
        <AlertTriangle className="h-10 w-10 text-red-500 mx-auto" />
        <h2 className="text-lg font-bold text-white mt-3">Access Restriced or Error</h2>
        <p className="text-sm text-red-300 mt-1">{errorMsg}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/login">
            <Button variant="outline" className="text-xs">Re-authenticate</Button>
          </Link>
          <Link href="/admin/mfa">
            <Button className="bg-teal-600 text-white text-xs">Verify Admin MFA</Button>
          </Link>
        </div>
      </Card>
    );
  }

  const { serviceHealth, usage, incidents, featureFlags } = metrics;
  const disabledFlags = featureFlags?.filter((f: any) => !f.enabled) || [];

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-200">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            System & Clinical Governance Overview
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Aggregate clinical metrics, active model status, and kill switches. No identifiable patient data is displayed.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/feature-flags">
            <Button size="sm" variant="outline" className="text-xs border-slate-700 text-slate-300 hover:bg-slate-800">
              <ToggleLeft className="mr-1.5 h-4 w-4" />
              Kill Switches ({disabledFlags.length} active)
            </Button>
          </Link>
          <Link href="/admin/rules">
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold">
              <GitBranch className="mr-1.5 h-4 w-4" />
              Triage Rules
            </Button>
          </Link>
        </div>
      </div>

      {/* Kill Switch Warning Banner if any active */}
      {disabledFlags.length > 0 && (
        <div className="rounded-xl border-2 border-red-500 bg-red-950/40 p-4 text-xs text-red-200 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-red-100 uppercase tracking-wider">
              Kill Switch Engaged ({disabledFlags.length} Module Disabled)
            </p>
            <p>
              The following modules are currently disabled:{" "}
              <strong>{disabledFlags.map((f: any) => f.name).join(", ")}</strong>.
            </p>
          </div>
        </div>
      )}

      {/* System Health Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-800 bg-slate-950/50 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-[11px] font-bold uppercase text-slate-400">
              Active Triage Rule Set
            </CardDescription>
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-teal-400" />
              {serviceHealth.activeRuleSetVersion}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-teal-400 font-semibold">
            Clinician Approved Baseline
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/50 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-[11px] font-bold uppercase text-slate-400">
              Active AI Model
            </CardDescription>
            <CardTitle className="text-sm font-bold text-white flex items-center gap-2 truncate">
              <Cpu className="h-4 w-4 text-teal-400 shrink-0" />
              <span className="truncate">{serviceHealth.activeAiModel}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-slate-400">
            Prompt: <span className="text-white font-mono">{serviceHealth.promptVersion}</span>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/50 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-[11px] font-bold uppercase text-slate-400">
              Today's Assessments
            </CardDescription>
            <CardTitle className="text-2xl font-extrabold text-white">
              {usage.todayAssessments}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-slate-400">
            Total lifetime: <span className="text-white font-bold">{usage.totalAssessments}</span>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-950/50 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-[11px] font-bold uppercase text-slate-400">
              Open Safety Incidents
            </CardDescription>
            <CardTitle className="text-2xl font-extrabold text-white flex items-center gap-2">
              <ShieldAlert className={`h-5 w-5 ${incidents.totalOpen > 0 ? "text-amber-400" : "text-teal-400"}`} />
              {incidents.totalOpen}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-[11px] text-slate-400">
            <Link href="/admin/incidents" className="text-teal-400 hover:underline">
              Review incident workflow →
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Main Two-Column Governance Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Triage Urgency Distribution */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="border-slate-800 bg-slate-950/40">
            <CardHeader className="border-b border-slate-800/80 pb-3">
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="h-4 w-4 text-teal-400" />
                Urgency Distribution (Aggregate)
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Breakdown of triage urgency floors assigned across all patient assessments
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {Object.entries(usage.urgencyBreakdown || {}).map(([tier, count]: [string, any]) => {
                const total = usage.totalAssessments || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={tier} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="capitalize text-slate-300">{tier.replace(/_/g, " ")}</span>
                      <span className="text-slate-400">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          tier === "emergency"
                            ? "bg-red-500"
                            : tier === "urgent"
                            ? "bg-amber-500"
                            : tier === "routine"
                            ? "bg-blue-500"
                            : "bg-teal-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Quick Governance Links */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-slate-800 bg-slate-950/40">
            <CardHeader className="border-b border-slate-800/80 pb-3">
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <Lock className="h-4 w-4 text-teal-400" />
                Administrative Controls
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Governance, review, and incident mitigation actions
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              <Link href="/admin/feature-flags">
                <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800/60 transition flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-white">Feature Flags & Kill Switches</p>
                    <p className="text-[11px] text-slate-400">Instantly disable AI, medication, or care navigation</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </div>
              </Link>

              <Link href="/admin/rules">
                <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800/60 transition flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-white">Triage Rules Approval</p>
                    <p className="text-[11px] text-slate-400">Clinical reviewer sign-off for safety rule sets</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </div>
              </Link>

              <Link href="/admin/incidents">
                <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800/60 transition flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-white">Incident Response Workflow</p>
                    <p className="text-[11px] text-slate-400">Manage reported false reassurances or missed emergencies</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </div>
              </Link>

              <Link href="/admin/audit-logs">
                <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60 hover:bg-slate-800/60 transition flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-white">Audited Break-Glass Access</p>
                    <p className="text-[11px] text-slate-400">Request time-limited access to identifiable transcripts</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
