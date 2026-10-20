"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Stethoscope,
  Pill,
  MapPin,
  PhoneCall,
  Clock,
  ShieldCheck,
  X,
  Activity,
  HeartPulse,
} from "lucide-react";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  const navigationItems = [
    {
      name: "Home",
      href: "/",
      icon: Home,
      exact: true,
    },
    {
      name: "Symptom Checker",
      href: "/symptom-checker",
      icon: Stethoscope,
      exact: false,
    },
    {
      name: "Medications",
      href: "/medications",
      icon: Pill,
      exact: false,
    },
    {
      name: "Find Clinics",
      href: "/clinics",
      icon: MapPin,
      exact: false,
    },
    {
      name: "Emergency",
      href: "/emergency",
      icon: PhoneCall,
      exact: false,
      isEmergency: true,
    },
    {
      name: "History",
      href: "/history",
      icon: Clock,
      exact: false,
    },
  ];

  function isActive(item: (typeof navigationItems)[0]) {
    if (item.exact) {
      return pathname === item.href;
    }
    if (item.href === "/history") {
      return pathname === "/history" || pathname.startsWith("/dashboard");
    }
    return pathname.startsWith(item.href);
  }

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-white px-5 py-6 dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800">
      <div className="space-y-8">
        {/* Brand Header */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            onClick={onClose}
            className="flex items-center gap-3 transition-opacity hover:opacity-95 group"
          >
            {/* Custom Modern Healthcare Emblem */}
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform duration-200">
              <Activity className="h-5 w-5" />
              <div className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex h-3 w-3 rounded-full bg-blue-500"></span>
              </div>
            </div>
            <div>
              <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Clinix
              </span>
              <p className="text-[11px] font-medium text-slate-400 dark:text-slate-400 -mt-0.5">
                Clarity when every decision matters.
              </p>
            </div>
          </Link>

          {/* Close button for mobile drawer */}
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-1.5" aria-label="Main Navigation">
          {navigationItems.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={`group flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-150 ${
                  active
                    ? "bg-blue-50 text-blue-600 shadow-xs dark:bg-blue-950/40 dark:text-blue-400"
                    : item.isEmergency
                    ? "text-slate-600 hover:bg-red-50/70 hover:text-red-600 dark:text-slate-300 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white"
                }`}
              >
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                    active
                      ? "text-blue-600 dark:text-blue-400"
                      : item.isEmergency
                      ? "text-red-500 group-hover:scale-110 transition-transform"
                      : "text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span>{item.name}</span>
                {item.isEmergency && (
                  <span className="ml-auto rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:bg-red-950/60 dark:text-red-300">
                    112
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Trust & Security Card */}
      <div className="pt-6">
        <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Your data is secure
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                We use enterprise-grade security to protect your information.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden bg-slate-950/60 backdrop-blur-xs transition-opacity"
          onClick={onClose}
        >
          <div
            className="fixed inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl transition-transform animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
