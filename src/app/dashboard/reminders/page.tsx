"use client";

import * as React from "react";
import {
  Bell,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Trash2,
  Calendar,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function RemindersPage() {
  const [reminders, setReminders] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [showAddForm, setShowAddForm] = React.useState(false);

  // New Reminder Form State
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [reminderType, setReminderType] = React.useState("follow_up");
  const [dueDate, setDueDate] = React.useState("");
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const fetchReminders = React.useCallback(async () => {
    try {
      const res = await fetch("/api/reminders");
      const json = await res.json();
      if (json.data) {
        setReminders(json.data);
      }
    } catch (err) {
      console.error("Error fetching reminders:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) {
      setErrorMsg("Please provide a reminder title and due date.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          reminderType,
          dueDate: new Date(dueDate).toISOString(),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error?.message || "Failed to create reminder.");
      } else {
        setTitle("");
        setDescription("");
        setDueDate("");
        setShowAddForm(false);
        fetchReminders();
      }
    } catch {
      setErrorMsg("Network error creating reminder.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: "completed" | "dismissed") => {
    try {
      const res = await fetch(`/api/reminders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setReminders((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status } : r))
        );
      }
    } catch (err) {
      console.error("Error updating reminder:", err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/reminders/${id}`, { method: "DELETE" });
      if (res.ok) {
        setReminders((prev) => prev.filter((r) => r.id !== id));
      }
    } catch (err) {
      console.error("Error deleting reminder:", err);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in-50 duration-200">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
            Care Reminders & Check-Ins
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Manage your personal follow-up check-ins, medical appointments, and review alerts.
          </p>
        </div>
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {showAddForm ? "Cancel" : "Add Reminder"}
        </Button>
      </div>

      {/* Add Reminder Form */}
      {showAddForm && (
        <Card className="border-teal-300 bg-teal-50/20 shadow-md dark:border-teal-900 dark:bg-teal-950/20 animate-in slide-in-from-top-4 duration-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
              Schedule New Reminder
            </CardTitle>
            <CardDescription className="text-xs">
              Remind yourself to re-check symptoms or attend a healthcare visit
            </CardDescription>
          </CardHeader>
          <CardContent>
            {errorMsg && (
              <div className="mb-4 rounded-lg bg-red-50 p-2.5 text-xs text-red-700">
                {errorMsg}
              </div>
            )}
            <form onSubmit={handleCreateReminder} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Title
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. Follow-up symptom re-evaluation"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Due Date & Time
                  </label>
                  <Input
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Reminder Type
                  </label>
                  <select
                    value={reminderType}
                    onChange={(e) => setReminderType(e.target.value)}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-slate-800 dark:bg-slate-900"
                  >
                    <option value="follow_up">Symptom Follow-Up Check</option>
                    <option value="appointment">Clinic / Doctor Appointment</option>
                    <option value="medication_review">Medication Review</option>
                    <option value="custom">General Care Reminder</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Notes (Optional)
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. Check temperature and fever reduction"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-semibold"
                >
                  {submitting ? "Saving..." : "Save Reminder"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Reminders List */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-teal-600" />
        </div>
      ) : reminders.length === 0 ? (
        <Card className="p-8 text-center border-dashed border-slate-300 dark:border-slate-800">
          <Bell className="h-8 w-8 text-slate-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-900 mt-2 dark:text-white">
            No Reminders Scheduled
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            You can set follow-up reminders after completing a symptom assessment or to track upcoming clinic visits.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {reminders.map((r) => {
            const isPast = new Date(r.dueDate) < new Date() && r.status === "pending";
            return (
              <Card
                key={r.id}
                className={`border transition shadow-sm ${
                  r.status === "completed"
                    ? "border-slate-200 bg-slate-50/50 opacity-75 dark:border-slate-800 dark:bg-slate-900/40"
                    : isPast
                    ? "border-amber-300 bg-amber-50/30 dark:border-amber-900"
                    : "border-slate-200 dark:border-slate-800"
                }`}
              >
                <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {r.title}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] capitalize ${
                          r.status === "completed"
                            ? "border-teal-400 text-teal-700"
                            : isPast
                            ? "border-amber-400 text-amber-800 bg-amber-50"
                            : "border-slate-300 text-slate-600"
                        }`}
                      >
                        {r.status === "pending" && isPast ? "Due / Overdue" : r.status}
                      </Badge>
                      <span className="text-[10px] rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400 capitalize">
                        {r.reminderType.replace(/_/g, " ")}
                      </span>
                    </div>

                    {r.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {r.description}
                      </p>
                    )}

                    <p className="text-xs text-slate-400 flex items-center gap-1 pt-0.5">
                      <Calendar className="h-3 w-3" />
                      Due: {new Date(r.dueDate).toLocaleDateString()} at{" "}
                      {new Date(r.dueDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {r.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(r.id, "completed")}
                        className="text-xs text-teal-700 border-teal-300 hover:bg-teal-50"
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                        Complete
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(r.id)}
                      className="text-xs text-slate-400 hover:text-red-600"
                      title="Delete reminder"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
