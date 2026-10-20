"use client";

import * as React from "react";
import {
  ShieldAlert,
  AlertTriangle,
  Plus,
  CheckCircle2,
  Clock,
  Loader2,
  FileText,
  UserCheck,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-600 text-white border-red-500",
  high: "bg-amber-600 text-white border-amber-500",
  medium: "bg-blue-600 text-white border-blue-500",
  low: "bg-slate-600 text-white border-slate-500",
};

export default function AdminIncidentsPage() {
  const [incidents, setIncidents] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [showReportModal, setShowReportModal] = React.useState(false);
  const [selectedIncident, setSelectedIncident] = React.useState<any | null>(null);

  // New Incident Form State
  const [severity, setSeverity] = React.useState<"critical" | "high" | "medium" | "low">("critical");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [assessmentId, setAssessmentId] = React.useState("");

  // Update State
  const [updateStatus, setUpdateStatus] = React.useState("");
  const [rootCause, setRootCause] = React.useState("");
  const [correctiveAction, setCorrectiveAction] = React.useState("");
  const [feedbackMsg, setFeedbackMsg] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchIncidents = React.useCallback(async () => {
    try {
      const res = await fetch("/api/admin/incidents");
      const json = await res.json();
      if (json.data) {
        setIncidents(json.data);
      }
    } catch (err) {
      console.error("Error fetching incidents:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const handleReportIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedbackMsg(null);

    try {
      const res = await fetch("/api/admin/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          severity,
          title,
          description,
          assessmentId: assessmentId.trim() || undefined,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        setFeedbackMsg({ type: "error", text: json.error?.message || "Failed to file incident." });
      } else {
        setFeedbackMsg({ type: "success", text: json.message });
        setTitle("");
        setDescription("");
        setAssessmentId("");
        setShowReportModal(false);
        fetchIncidents();
      }
    } catch {
      setFeedbackMsg({ type: "error", text: "Network error reporting incident." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident) return;

    try {
      const res = await fetch(`/api/admin/incidents/${selectedIncident.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: updateStatus || undefined,
          rootCause: rootCause || undefined,
          correctiveAction: correctiveAction || undefined,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setFeedbackMsg({ type: "success", text: json.message });
        setSelectedIncident(null);
        fetchIncidents();
      }
    } catch {
      setFeedbackMsg({ type: "error", text: "Network error updating incident." });
    }
  };

  return (
    <div className="space-y-6 max-w-5xl animate-in fade-in-50 duration-200">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white">
            Clinical Safety Incident Workflow
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Tracks reported adverse events, missed emergencies, and false reassurances per clinical governance rules.
          </p>
        </div>
        <Button
          onClick={() => setShowReportModal(!showReportModal)}
          className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {showReportModal ? "Cancel" : "Report Safety Incident"}
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

      {/* Report Modal */}
      {showReportModal && (
        <Card className="border-red-500/50 bg-slate-950/90 shadow-md">
          <CardHeader className="pb-3 border-b border-slate-800">
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-red-500" />
              File Clinical Incident Report
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Note: Missed emergencies and false reassurance are classified as Critical severity.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleReportIncident} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Severity Tier</label>
                  <select
                    value={severity}
                    onChange={(e: any) => setSeverity(e.target.value)}
                    className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                  >
                    <option value="critical">Critical (Missed Emergency / False Reassurance)</option>
                    <option value="high">High (Medication/Allergy Contraindication Missed)</option>
                    <option value="medium">Medium (Incorrect Phrasing / Triage Ambiguity)</option>
                    <option value="low">Low (Minor UI / Latency Complaint)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Related Assessment ID (Optional)</label>
                  <Input
                    type="text"
                    placeholder="e.g. 660f..."
                    value={assessmentId}
                    onChange={(e) => setAssessmentId(e.target.value)}
                    className="bg-slate-900 border-slate-700 text-white text-xs font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Incident Title</label>
                <Input
                  type="text"
                  placeholder="e.g. Patient presentation with acute chest pain assigned routine floor"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="bg-slate-900 border-slate-700 text-white text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Incident Narrative & Findings</label>
                <textarea
                  rows={3}
                  placeholder="Describe the clinical presentation, what the safety engine evaluated, and where the deviation occurred..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  className="w-full rounded-md border border-slate-700 bg-slate-900 p-2.5 text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowReportModal(false)}
                  className="text-xs border-slate-700"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting}
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs"
                >
                  {submitting ? "Filing..." : "Submit Incident Report"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Incidents List */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-teal-400" />
        </div>
      ) : incidents.length === 0 ? (
        <Card className="border-slate-800 bg-slate-950/40 p-8 text-center text-slate-400">
          <ShieldAlert className="h-8 w-8 text-teal-400 mx-auto" />
          <p className="text-sm font-bold text-white mt-2">Zero Open Incidents</p>
          <p className="text-xs mt-1">No clinical safety adverse events or missed emergencies reported.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {incidents.map((inc) => (
            <Card
              key={inc.id}
              className={`border transition shadow-sm ${
                inc.severity === "critical"
                  ? "border-red-600/70 bg-red-950/20"
                  : "border-slate-800 bg-slate-950/40"
              }`}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge className={`${SEVERITY_COLORS[inc.severity]} text-[10px] uppercase font-bold`}>
                      {inc.severity}
                    </Badge>
                    <span className="font-mono text-xs text-slate-400">{inc.incidentNumber}</span>
                    <Badge variant="outline" className="text-[10px] uppercase border-slate-700 text-slate-300">
                      Status: {inc.status}
                    </Badge>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {new Date(inc.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <p className="text-sm font-bold text-white">{inc.title}</p>
                <p className="text-xs text-slate-300">{inc.description}</p>

                {inc.rootCause && (
                  <p className="text-xs text-amber-300">
                    <strong>Root Cause:</strong> {inc.rootCause}
                  </p>
                )}
                {inc.correctiveAction && (
                  <p className="text-xs text-teal-300">
                    <strong>Corrective Action:</strong> {inc.correctiveAction}
                  </p>
                )}

                <div className="flex justify-between items-center pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                  <span>Reported by: <strong className="text-slate-300">{inc.reportedBy}</strong></span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSelectedIncident(inc);
                      setUpdateStatus(inc.status);
                      setRootCause(inc.rootCause || "");
                      setCorrectiveAction(inc.correctiveAction || "");
                    }}
                    className="text-xs text-teal-400 hover:text-teal-300"
                  >
                    Update Corrective Action →
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Incident Review / Corrective Action Modal */}
      {selectedIncident && (
        <Card className="border-teal-500/50 bg-slate-950 p-5 space-y-4">
          <CardTitle className="text-sm font-bold text-white flex items-center justify-between">
            <span>Review & Corrective Action: {selectedIncident.incidentNumber}</span>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIncident(null)}>✕</Button>
          </CardTitle>
          <form onSubmit={handleUpdateIncident} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Workflow Status</label>
              <select
                value={updateStatus}
                onChange={(e) => setUpdateStatus(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white"
              >
                <option value="reported">Reported</option>
                <option value="in_review">In Review (Clinical Reviewer Assigned)</option>
                <option value="action_taken">Action Taken (Rule/Prompt Updated)</option>
                <option value="resolved">Resolved (Post-Incident Review Complete)</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Root Cause Analysis</label>
              <Input
                value={rootCause}
                onChange={(e) => setRootCause(e.target.value)}
                placeholder="e.g. Rule pattern lacked local colloquialism phrasing"
                className="bg-slate-900 border-slate-700 text-white text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">Corrective Action Taken</label>
              <Input
                value={correctiveAction}
                onChange={(e) => setCorrectiveAction(e.target.value)}
                placeholder="e.g. Added pattern to EM-RESP-001 in reviewed rule set v2"
                className="bg-slate-900 border-slate-700 text-white text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" size="sm" variant="outline" onClick={() => setSelectedIncident(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="bg-teal-600 text-white text-xs font-semibold">
                Save Review
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
