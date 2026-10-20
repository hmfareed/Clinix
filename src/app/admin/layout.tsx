"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  LayoutDashboard,
  ShieldAlert,
  GitBranch,
  Cpu,
  ToggleLeft,
  KeyRound,
  LogOut,
  AlertTriangle,
  Menu,
  X,
  Lock,
  Loader2,
  FileText,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const ADMIN_NAV = [
  { name: "Overview & Health", href: "/admin", icon: LayoutDashboard },
  { name: "Triage Rules Governance", href: "/admin/rules", icon: GitBranch },
  { name: "Safety Incidents", href: "/admin/incidents", icon: ShieldAlert },
  { name: "AI & Model Governance", href: "/admin/ai-governance", icon: Cpu },
  { name: "Kill Switches (Flags)", href: "/admin/feature-flags", icon: ToggleLeft },
  { name: "Break-Glass & Audits", href: "/admin/audit-logs", icon: KeyRound },
];

function AdminLayoutInner({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const role = (session?.user as unknown as { role?: string })?.role || "patient";
  const isAuthorizedAdmin = role !== "patient";

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between border-b border-slate-800 bg-slate-950 p-4">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded bg-red-600 text-white flex items-center justify-center text-xs font-bold">
            ADM
          </div>
          <span className="font-bold text-sm">Clinix Administration</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded-lg border border-slate-800 text-slate-400"
          aria-label="Toggle navigation"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Desktop Sidebar */}
      <aside
        className={`w-full md:w-64 border-r border-slate-800 bg-slate-950 flex flex-col justify-between shrink-0 ${
          mobileMenuOpen ? "block" : "hidden md:flex"
        }`}
      >
        <div className="p-5 space-y-6">
          <div className="space-y-1">
            <Link
              href="/"
              className="text-xs font-semibold text-teal-400 hover:underline flex items-center gap-1"
            >
              ← Public Platform
            </Link>
            <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <Lock className="h-4 w-4 text-red-500" />
              Admin Portal
            </h2>
            <div className="pt-1">
              <Badge
                variant="outline"
                className="text-[10px] font-bold uppercase tracking-wider border-red-500/40 text-red-400 bg-red-950/40"
              >
                Role: {role.replace(/_/g, " ")}
              </Badge>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-3 pb-1">
              Clinical & System Governance
            </p>
            {ADMIN_NAV.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition ${
                    isActive
                      ? "bg-slate-800 text-teal-400 font-bold border-l-2 border-teal-500"
                      : "text-slate-400 hover:bg-slate-900 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Status Footer */}
        <div className="p-4 border-t border-slate-800/80 space-y-3 bg-slate-950/60">
          {session?.user && (
            <div className="flex items-center justify-between text-xs">
              <div className="truncate pr-2">
                <p className="font-semibold text-slate-200 truncate">
                  {session.user.name || session.user.email}
                </p>
                <p className="text-slate-500 truncate text-[10px]">
                  MFA Protected
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="h-8 w-8 p-0 text-slate-400 hover:text-red-400"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full">
        {/* Governance Notice */}
        <div className="mb-6 rounded-lg border border-slate-700 bg-slate-800/60 p-3 text-xs text-slate-300 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-teal-400 shrink-0" />
            <span>
              <strong>Clinical Privacy Guard:</strong> Patient health records and identifiable transcripts are masked by default. Access requires temporary audited <em>Break-Glass</em> authorization.
            </span>
          </div>
          <Link href="/admin/feature-flags">
            <span className="text-[11px] font-semibold text-red-400 hover:underline shrink-0">
              Emergency Kill Switches →
            </span>
          </Link>
        </div>

        {children}
      </main>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
        </div>
      }
    >
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </React.Suspense>
  );
}
