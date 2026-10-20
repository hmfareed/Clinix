"use client";

import * as React from "react";
import {
  GitBranch,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Play,
  Clock,
  Loader2,
  FileCheck,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function AdminRulesPage() {
  const [ruleSets, setRuleSets] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [showCreateModal, setShowCreateModal] = React.useState(false);

  // New Draft State
  const [version, setVersion] = React.useState("");
  const [name, setName] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [feedbackMsg, setFeedbackMsg] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchRuleSets = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/rules");
      const json = await res.json();
      if (json.data) {
        setRuleSets(json.data);
      }
    } catch (err) {
      console.error("Error fetching rules:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchRuleSets();
  }, [fetchRuleSets]);

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedbackMsg(null);

    try {
      const res = await fetch("/api/admin/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version, name, notes }),
      });
      const json = await res.json();

      if (!res.ok) {
        setFeedbackMsg({ type: "error", text: json.error?.message || "Failed to create draft." });
      } else {
        setFeedbackMsg({ type: "success", text: json.message });
        setVersion("");
        setName("");
        setNotes("");
        setShowCreateModal(false);
        fetchRuleSets();
      }
    } catch {
      setFeedbackMsg({ type: "error", text: "Network error creating draft." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/rules/${id}/approve`, { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setFeedbackMsg({ type: "success", text: json.message });
        fetchRuleSets();
      } else {
        setFeedbackMsg({ type: "error", text: json.error?.message || "Approval failed." });
      }
    } catch {
      setFeedbackMsg({ type: "error", text: "Network error approving rule set." });
    }
  };

  const handleActivate = async (id: string) => {
    if (!confirm("Are you sure you want to activate this rule set? It will immediately govern all patient triage checks.")) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/rules/${id}/activate`, { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setFeedbackMsg({ type: "success", text: json.message });
        fetchRuleSets();
      } else {
        setFeedbackMsg({ type: "error", text: json.error?.message || "Activation failed." });
      }
    } catch {
      setFeedbackMsg({ type: "error", text: "Network error activating rule set." });
    }
  };

  return (
    <div className="space-y-6 max-w-5xl animate-in fade-in-50 duration-200">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">
            Triage Rule Sets & Clinical Governance
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Rule changes follow a strict approval workflow. Only approved versions can be activated.
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(!showCreateModal)}
          className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {showCreateModal ? "Cancel" : "New Rule Set Draft"}
        </Button>
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

      {/* Create Draft Modal */}
      {showCreateModal && (
        <Card className="border-teal-500/50 bg-slate-950/80 shadow-md">
          <CardHeader className="pb-3 border-b border-slate-800">
            <CardTitle className="text-base font-bold text-white">
              Create New Triage Rule Set Draft
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Clones the active rule catalog into a versioned draft requiring clinical reviewer approval
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleCreateDraft} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Version Identifier (e.g. reviewed-rules-v2)
                  </label>
                  <Input
                    type="text"
                    placeholder="reviewed-rules-v2"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    required
                    className="bg-slate-900 border-slate-700 text-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    Rule Set Display Name
                  </label>
                  <Input
                    type="text"
                    placeholder="Ghana Emergency & Pediatric Update 2026"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="bg-slate-900 border-slate-700 text-white"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Clinical Change Notes
                </label>
                <Input
                  type="text"
                  placeholder="Summary of adjusted respiratory emergency patterns and reviewer comments"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="bg-slate-900 border-slate-700 text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateModal(false)}
                  className="text-xs border-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs"
                >
                  {submitting ? "Creating Draft..." : "Create Draft"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Rule Sets List */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-teal-400" />
        </div>
      ) : (
        <div className="space-y-3">
          {ruleSets.map((rs) => (
            <Card
              key={rs.id}
              className={`border transition shadow-sm ${
                rs.isActive
                  ? "border-teal-500 bg-slate-950/80 shadow-teal-950/20"
                  : "border-slate-800 bg-slate-950/40"
              }`}
            >
              <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1.5 max-w-xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-white">
                      {rs.name}
                    </span>
                    <Badge
                      className={`text-[10px] font-mono ${
                        rs.isActive ? "bg-teal-600 text-white" : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {rs.version}
                    </Badge>
                    {rs.isActive && (
                      <Badge className="bg-teal-500/20 text-teal-400 border border-teal-500/40 text-[10px]">
                        ACTIVE IN PRODUCTION
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className={`text-[10px] capitalize ${
                        rs.approvalStatus === "approved"
                          ? "border-teal-500/40 text-teal-300 bg-teal-950/30"
                          : "border-amber-500/40 text-amber-300 bg-amber-950/30"
                      }`}
                    >
                      Status: {rs.approvalStatus}
                    </Badge>
                  </div>

                  {rs.notes && (
                    <p className="text-xs text-slate-400">
                      {rs.notes}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-4 text-[11px] text-slate-400 pt-1">
                    <span>Rules Count: <strong className="text-white">{rs.ruleCount}</strong></span>
                    <span>Reviewed by: <strong className="text-slate-300">{rs.reviewedBy}</strong></span>
                    {rs.approvedBy && (
                      <span>Approved by: <strong className="text-teal-300">{rs.approvedBy}</strong></span>
                    )}
                  </div>
                </div>

                {/* Workflow Actions */}
                <div className="flex items-center gap-2">
                  {rs.approvalStatus === "draft" && (
                    <Button
                      size="sm"
                      onClick={() => handleApprove(rs.id)}
                      className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
                    >
                      <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                      Approve (Clinical Review)
                    </Button>
                  )}

                  {rs.approvalStatus === "approved" && !rs.isActive && (
                    <Button
                      size="sm"
                      onClick={() => handleActivate(rs.id)}
                      className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold"
                    >
                      <Play className="mr-1.5 h-3.5 w-3.5" />
                      Activate
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
