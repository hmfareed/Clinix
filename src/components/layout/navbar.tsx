"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { PhoneCall, ShieldAlert, HeartPulse, User as UserIcon, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const { data: session, status } = useSession();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-white shadow-sm">
              <HeartPulse className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Clinix
              </span>
              <span className="ml-1.5 hidden text-xs font-medium text-teal-600 dark:text-teal-400 sm:inline-block">
                Health Assistant
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-4 text-sm font-medium text-slate-600 dark:text-slate-300">
            <Link href="/" className="transition hover:text-teal-600 dark:hover:text-teal-400">
              Home
            </Link>
            <Link href="/symptom-checker" className="transition hover:text-teal-600 dark:hover:text-teal-400 font-semibold">
              Symptom Checker
            </Link>
            <Link href="/medications" className="transition hover:text-teal-600 dark:hover:text-teal-400">
              Medications
            </Link>
            <Link href="/clinics" className="transition hover:text-teal-600 dark:hover:text-teal-400">
              Nearby Care
            </Link>
            <Link href="/about" className="transition hover:text-teal-600 dark:hover:text-teal-400">
              About & Safety
            </Link>
            <Link href="/privacy" className="transition hover:text-teal-600 dark:hover:text-teal-400">
              Privacy & Consent
            </Link>
          </nav>
        </div>

        {/* Actions & Emergency Button */}
        <div className="flex items-center gap-3">
          {/* Emergency Fast Dial - Always accessible */}
          <a
            href="tel:112"
            className="flex items-center gap-2 rounded-lg bg-red-600 px-3.5 py-2 text-xs sm:text-sm font-bold text-white shadow transition hover:bg-red-700 active:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2"
            title="Immediate emergency call to 112"
            aria-label="Immediate emergency call to 112 national ambulance service"
          >
            <PhoneCall className="h-4 w-4 animate-bounce" aria-hidden="true" />
            <span>Emergency: 112</span>
          </a>

          {/* User Auth Controls */}
          {status === "authenticated" ? (
            <div className="flex items-center gap-2">
              <Link href="/dashboard">
                <Button size="sm" className="bg-teal-600 text-white hover:bg-teal-700 text-xs font-semibold">
                  Dashboard
                </Button>
              </Link>
              <div className="hidden lg:flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {session.user?.name || session.user?.email}
                </span>
                <span className="text-[10px] text-teal-600 dark:text-teal-400 capitalize">
                  {(session.user as unknown as { role?: string }).role || "Patient"}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex items-center gap-1.5 text-xs"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" size="sm" className="text-xs font-medium">
                  Sign In
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="default" size="sm" className="text-xs font-medium">
                  Register
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
