"use client";

import * as React from "react";
import Link from "next/link";
import {
  FileText,
  AlertTriangle,
  Trash2,
  ExternalLink,
  Loader2,
  Calendar,
  Search,
  Filter,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

const URGENCY_COLORS: Record<string, string> = {
  emergency: "bg-red-600 text-white",
  urgent: "bg-amber-600 text-white",
  routine: "bg-blue-600 text-white",
  self_care_eligible: "bg-teal-600 text-white",
  insufficient_information: "bg-slate-600 text-white",
};

export default function MyAssessmentsPage() {
  const [assessments, setAssessments] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [urgencyFilter, setUrgencyFilter] = React.useState<string>("all");
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const fetchAssessments = React.useCallback(async () => {
    try {
      const res = await fetch("/api/assessments");
      const json = await res.json();
      if (json.data) {
        setAssessments(json.data);
      }
    } catch (err) {
      console.error("Error fetching assessments:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this assessment record?")) {
      return;
    }
    setDeletingId(id);
    try {
      const res = await fetch(`/api/assessments/${id}`, { method: "DELETE" });
      if (res.ok) {
        setAssessments((prev) => prev.filter((a) => a.id !== id));
      } else {
        alert("Failed to delete assessment.");
      }
    } catch {
      alert("Network error deleting assessment.");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredAssessments = assessments.filter((a) => {
    const matchesSearch =
      a.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.symptoms?.some((s: any) => s.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesUrgency = urgencyFilter === "all" || a.urgency === urgencyFilter;
    return matchesSearch && matchesUrgency;
  });

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-200">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            My Symptom Assessments
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Historical records of triage checks. All records are unverified algorithmic assessments.
          </p>
        </div>
        <Link href="/symptom-checker">
          <Button className="bg-teal-600 hover:bg-teal-700 text-white font-semibold">
            New Assessment
          </Button>
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Input
            placeholder="Search symptoms or summary..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="text-xs"
          />
        </div>
        <select
          value={urgencyFilter}
          onChange={(e) => setUrgencyFilter(e.target.value)}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
        >
          <option value="all">All Urgency Tiers</option>
          <option value="emergency">Emergency</option>
          <option value="urgent">Urgent</option>
          <option value="routine">Routine</option>
          <option value="self_care_eligible">Self-Care Eligible</option>
          <option value="insufficient_information">Insufficient Information</option>
        </select>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-teal-600" />
        </div>
      ) : filteredAssessments.length === 0 ? (
        <Card className="p-8 text-center border-dashed border-slate-300 dark:border-slate-800">
          <p className="text-sm text-slate-500">No matching assessment records found.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredAssessments.map((a) => (
            <Card key={a.id} className="border-slate-200 shadow-sm hover:border-slate-300 transition dark:border-slate-800">
              <CardHeader className="p-4 pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge className={`${URGENCY_COLORS[a.urgency] || "bg-slate-600 text-white"} capitalize text-xs`}>
                      {a.urgency.replace(/_/g, " ")}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 bg-amber-50">
                      AI Generated & Unverified
                    </Badge>
                  </div>
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(a.createdAt).toLocaleDateString()} at{" "}
                    {new Date(a.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-2">
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {a.summary}
                </p>
                {a.symptoms?.[0]?.description && (
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    <strong>Reported Symptoms:</strong> {a.symptoms[0].description}
                  </p>
                )}
                {a.possibleConditions?.length > 0 && (
                  <div className="pt-1 flex flex-wrap gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-500">Considered Possibilities:</span>
                    {a.possibleConditions.map((c: any, i: number) => (
                      <span
                        key={i}
                        className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {c.name}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
              <CardFooter className="p-4 pt-0 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(a.id)}
                  disabled={deletingId === a.id}
                  className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  {deletingId === a.id ? "Deleting..." : "Delete"}
                </Button>
                <Link href={`/dashboard/assessments/${a.id}`}>
                  <Button variant="outline" size="sm" className="text-xs text-teal-700 border-teal-300 hover:bg-teal-50">
                    Full Details & Summary →
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
