"use client";

import * as React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  FileText,
  Bell,
  UserCheck,
  Stethoscope,
  ArrowRight,
  Plus,
  Clock,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const URGENCY_COLORS: Record<string, string> = {
  emergency: "bg-red-600 text-white",
  urgent: "bg-amber-600 text-white",
  routine: "bg-blue-600 text-white",
  self_care_eligible: "bg-teal-600 text-white",
  insufficient_information: "bg-slate-600 text-white",
};

export default function DashboardOverviewPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = React.useState(true);
  const [assessments, setAssessments] = React.useState<any[]>([]);
  const [reminders, setReminders] = React.useState<any[]>([]);
  const [profile, setProfile] = React.useState<any>(null);

  React.useEffect(() => {
    if (status === "authenticated") {
      Promise.all([
        fetch("/api/assessments").then((r) => r.json()),
        fetch("/api/reminders").then((r) => r.json()),
        fetch("/api/patients/me").then((r) => r.json()),
      ])
        .then(([assData, remData, profData]) => {
          if (assData?.data) setAssessments(assData.data.slice(0, 4));
          if (remData?.data) setReminders(remData.data.slice(0, 4));
          if (profData?.data) setProfile(profData.data);
        })
        .catch((err) => console.error("Error loading dashboard data:", err))
        .finally(() => setLoading(false));
    } else if (status === "unauthenticated") {
      setLoading(false);
    }
  }, [status]);

  if (status === "loading" || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <Card className="p-8 text-center border-slate-200">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Sign In Required</h2>
        <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
          Please sign in or create an account to access your personal assessment history, follow-up reminders, and health profile.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/login">
            <Button className="bg-teal-600 text-white hover:bg-teal-700">Sign In</Button>
          </Link>
          <Link href="/register">
            <Button variant="outline">Create Free Account</Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-200">
      {/* Welcome & Quick Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Welcome back, {session?.user?.name || "Patient"}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Manage your AI assessments, triage history, and care follow-ups.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/symptom-checker">
            <Button className="bg-teal-600 hover:bg-teal-700 text-white font-semibold">
              <Stethoscope className="mr-2 h-4 w-4" />
              New Symptom Check
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics & Profile Completeness Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200 shadow-sm dark:border-slate-800">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase text-slate-500">
              Total Assessments
            </CardDescription>
            <CardTitle className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {assessments.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">
            Past triage assessments stored
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm dark:border-slate-800">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase text-slate-500">
              Pending Reminders
            </CardDescription>
            <CardTitle className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {reminders.filter((r) => r.status === "pending").length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">
            Follow-up check-ins and appointments
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm dark:border-slate-800">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase text-slate-500">
              Health Profile
            </CardDescription>
            <CardTitle className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              {profile?.ageYears ? (
                <span className="text-teal-600 flex items-center gap-1">
                  <CheckCircle2 className="h-5 w-5" /> Configured
                </span>
              ) : (
                <span className="text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-5 w-5" /> Incomplete
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">
            <Link href="/dashboard/profile" className="text-teal-600 hover:underline">
              {profile?.ageYears ? "Update clinical profile →" : "Add age & allergies →"}
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Recent Assessments */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-teal-600" />
              Recent Assessments
            </h2>
            <Link
              href="/dashboard/assessments"
              className="text-xs font-semibold text-teal-600 hover:underline"
            >
              View all ({assessments.length}) →
            </Link>
          </div>

          {assessments.length === 0 ? (
            <Card className="p-8 text-center border-dashed border-slate-300 dark:border-slate-800">
              <p className="text-sm text-slate-500">You haven't run any symptom assessments yet.</p>
              <div className="mt-4">
                <Link href="/symptom-checker">
                  <Button size="sm" variant="outline">
                    Start Your First Assessment
                  </Button>
                </Link>
              </div>
            </Card>
          ) : (
            <div className="space-y-3">
              {assessments.map((a) => (
                <Card key={a.id} className="border-slate-200 hover:border-slate-300 transition shadow-sm dark:border-slate-800">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge className={`${URGENCY_COLORS[a.urgency] || "bg-slate-600 text-white"} capitalize text-[11px]`}>
                          {a.urgency.replace(/_/g, " ")}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 bg-amber-50">
                          AI Unverified
                        </Badge>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {new Date(a.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2">
                      {a.summary}
                    </p>
                    {a.symptoms?.[0]?.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                        Reported symptoms: {a.symptoms[0].description}
                      </p>
                    )}
                  </CardContent>
                  <CardFooter className="p-4 pt-0 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                    <Link href={`/dashboard/assessments/${a.id}`}>
                      <Button variant="ghost" size="sm" className="text-xs text-teal-600 hover:text-teal-700">
                        View Assessment Details →
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Reminders & Quick Links */}
        <div className="lg:col-span-5 space-y-6">
          {/* Reminders Card */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Bell className="h-5 w-5 text-teal-600" />
                Follow-Up Reminders
              </h2>
              <Link
                href="/dashboard/reminders"
                className="text-xs font-semibold text-teal-600 hover:underline"
              >
                Manage →
              </Link>
            </div>

            {reminders.length === 0 ? (
              <Card className="p-6 text-center border-slate-200 dark:border-slate-800">
                <p className="text-xs text-slate-500">No active follow-up reminders.</p>
                <Link href="/dashboard/reminders" className="mt-3 inline-block">
                  <Button size="sm" variant="outline" className="text-xs">
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add Check-in Reminder
                  </Button>
                </Link>
              </Card>
            ) : (
              <div className="space-y-2">
                {reminders.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-start justify-between p-3 rounded-lg border border-slate-200 bg-white text-xs dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div className="space-y-0.5">
                      <p className="font-semibold text-slate-900 dark:text-white">{r.title}</p>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Due: {new Date(r.dueDate).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] capitalize ${
                        r.status === "completed"
                          ? "border-teal-400 text-teal-700"
                          : "border-slate-300 text-slate-600"
                      }`}
                    >
                      {r.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Access Card */}
          <Card className="border-teal-200 bg-teal-50/20 shadow-sm dark:border-teal-900/50 dark:bg-teal-950/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">
                Data Privacy & Export
              </CardTitle>
              <CardDescription className="text-xs">
                In compliance with Ghana's Data Protection Act, 2012 (Act 843), you have complete control over your health records.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/dashboard/privacy">
                <Button size="sm" variant="outline" className="w-full text-xs justify-between">
                  <span>Manage Consents & Download Data</span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
