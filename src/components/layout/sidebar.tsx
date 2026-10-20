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
    <div className="flex h-full flex-col justify-between bg-black px-4 py-5 border-r border-zinc-900/90 text-slate-100">
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            onClick={onClose}
            className="flex items-center gap-2.5 transition-opacity hover:opacity-95 group"
          >
            {/* Custom Modern Healthcare Emblem */}
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-md shadow-blue-500/30 group-hover:scale-105 transition-transform duration-200">
              <Activity className="h-4.5 w-4.5" />
              <div className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500"></span>
              </div>
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-white">
                Clinix
              </span>
              <p className="text-[10px] font-medium text-zinc-400 -mt-0.5">
                Clarity when every decision matters.
              </p>
            </div>
          </Link>

          {/* Close button for mobile drawer */}
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-white"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-1" aria-label="Main Navigation">
          {navigationItems.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onClose}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-150 ${
                  active
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-xs shadow-blue-500/10"
                    : item.isEmergency
                    ? "text-zinc-400 hover:bg-red-950/40 hover:text-red-400 hover:border hover:border-red-900/40"
                    : "text-zinc-400 hover:bg-zinc-900/80 hover:text-white"
                }`}
              >
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                    active
                      ? "text-blue-400"
                      : item.isEmergency
                      ? "text-red-500 group-hover:scale-110 transition-transform"
                      : "text-zinc-500 group-hover:text-zinc-200"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span>{item.name}</span>
                {item.isEmergency && (
                  <span className="ml-auto rounded-full bg-red-950/70 border border-red-800/60 px-1.5 py-0.2 text-[9px] font-bold text-red-400">
                    112
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom Trust & Security Card */}
      <div className="pt-4">
        <div className="rounded-xl border border-zinc-900 bg-zinc-950/90 p-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-950/80 border border-emerald-800/40 text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-zinc-200">
                Your data is secure
              </p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-zinc-500">
                Enterprise security protecting your health privacy.
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
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden bg-black/80 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        >
          <div
            className="fixed inset-y-0 left-0 w-64 max-w-[85vw] shadow-2xl transition-transform animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
