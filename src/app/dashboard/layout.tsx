"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  FileText,
  UserCheck,
  Bell,
  ShieldCheck,
  Stethoscope,
  Pill,
  MapPin,
  LogOut,
  AlertTriangle,
  ChevronRight,
  Menu,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const NAV_ITEMS = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "My Assessments", href: "/dashboard/assessments", icon: FileText },
  { name: "Health Profile", href: "/dashboard/profile", icon: UserCheck },
  { name: "Reminders", href: "/dashboard/reminders", icon: Bell },
  { name: "Privacy & Consents", href: "/dashboard/privacy", icon: ShieldCheck },
];

const CARE_TOOLS = [
  { name: "Symptom Checker", href: "/symptom-checker", icon: Stethoscope },
  { name: "Find Care (Clinics)", href: "/clinics", icon: MapPin },
  { name: "Medication Guide", href: "/medications", icon: Pill },
];

function DashboardLayoutInner({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between border-b border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <Link href="/dashboard" className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-teal-600 text-white flex items-center justify-center text-xs font-bold">
            CX
          </div>
          <span>Patient Portal</span>
        </Link>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
          aria-label="Toggle navigation"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Sidebar for Desktop */}
      <aside
        className={`w-full md:w-64 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between shrink-0 ${
          mobileMenuOpen ? "block" : "hidden md:flex"
        }`}
      >
        <div className="p-5 space-y-6">
          {/* Brand & Portal Title */}
          <div className="space-y-1">
            <Link href="/" className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1">
              ← Return to Clinix
            </Link>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
              Patient Portal
            </h2>
            <div className="flex items-center gap-1.5 pt-1">
              <Badge variant="outline" className="text-[10px] uppercase font-bold border-amber-300 text-amber-800 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                AI Records Unverified
              </Badge>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 pb-1">
              Dashboard
            </p>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300 font-semibold"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? "text-teal-600 dark:text-teal-400" : "text-slate-400"}`} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Quick Care Tools */}
          <nav className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 pb-1">
              Care Tools
            </p>
            {CARE_TOOLS.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link
                  key={tool.href}
                  href={tool.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition"
                >
                  <Icon className="h-4 w-4 text-slate-400" />
                  <span>{tool.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Footer & Logout */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          {session?.user && (
            <div className="flex items-center justify-between text-xs">
              <div className="truncate pr-2">
                <p className="font-semibold text-slate-900 dark:text-white truncate">
                  {session.user.name || "Patient"}
                </p>
                <p className="text-slate-500 truncate text-[11px]">
                  {session.user.email}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="h-8 w-8 p-0 text-slate-500 hover:text-red-600"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
          {!session?.user && status !== "loading" && (
            <Link href="/login">
              <Button size="sm" variant="outline" className="w-full text-xs">
                Sign In to Save Records
              </Button>
            </Link>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full">
        {/* Universal Clinical Safety Banner */}
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900 flex items-center justify-between gap-3 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              <strong>Clinical Notice:</strong> Assessments stored in Clinix are AI-generated and clinically unverified. They provide informational triage guidance, not official diagnostic medical records.
            </span>
          </div>
          <a
            href="tel:112"
            className="shrink-0 font-bold text-red-600 hover:underline hidden sm:inline"
          >
            Emergency? Call 112
          </a>
        </div>

        {children}
      </main>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center dark:bg-slate-950">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      }
    >
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </React.Suspense>
  );
}
