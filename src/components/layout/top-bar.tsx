"use client";

import * as React from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import {
  Search,
  Bell,
  ChevronDown,
  User as UserIcon,
  PhoneCall,
  Menu,
  Shield,
  FileText,
  Clock,
  LogOut,
  LogIn,
  CheckCircle2,
} from "lucide-react";
import { GlobalSearchModal } from "@/components/search/global-search-modal";

interface TopBarProps {
  onOpenMobileMenu: () => void;
}

export function TopBar({ onOpenMobileMenu }: TopBarProps) {
  const { data: session, status } = useSession();
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);

  const notificationsRef = React.useRef<HTMLDivElement>(null);
  const profileRef = React.useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayName = session?.user?.name || (session?.user?.email ? session.user.email.split("@")[0] : "John Doe");
  const userInitials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const userRole = (session?.user as unknown as { role?: string })?.role;
  const isAdmin =
    userRole &&
    ["system_admin", "clinical_reviewer", "support_admin", "auditor"].includes(userRole);

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-zinc-900 bg-black/90 backdrop-blur-md px-4 sm:px-6 text-slate-100">
        {/* Left Side: Mobile Menu Button & Global Search Trigger */}
        <div className="flex items-center gap-2.5 sm:gap-3 flex-1 max-w-lg">
          <button
            onClick={onOpenMobileMenu}
            className="lg:hidden rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-white"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Search Bar matching screenshot */}
          <button
            onClick={() => setSearchOpen(true)}
            className="group flex w-full items-center gap-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 px-3.5 py-1.5 sm:py-2 text-left text-xs sm:text-sm text-zinc-400 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <Search className="h-3.5 w-3.5 text-zinc-400 group-hover:text-blue-400 transition-colors shrink-0" />
            <span className="truncate">Search symptoms, medications, clinics...</span>
            <kbd className="ml-auto hidden md:inline-block rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[9px] font-mono text-zinc-400">
              Ctrl K
            </kbd>
          </button>
        </div>

        {/* Right Side: Emergency Action, Notifications, User Profile */}
        <div className="flex items-center gap-2.5 sm:gap-4 ml-3 shrink-0">
          {/* Emergency 112 Fast Dial — Always accessible */}
          <a
            href="tel:112"
            className="hidden sm:flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-red-500/20 transition-all focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-black"
            title="Immediate emergency call to 112"
            aria-label="Immediate emergency call to 112 national ambulance service"
          >
            <PhoneCall className="h-3.5 w-3.5 animate-bounce" aria-hidden="true" />
            <span>Emergency: 112</span>
          </a>

          {/* Notifications Dropdown */}
          <div className="relative" ref={notificationsRef}>
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="relative rounded-xl p-2.5 text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors"
              aria-label="Open notifications"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
              </span>
            </button>

            {/* Notifications Popover */}
            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-88 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl z-50 animate-in fade-in-50 duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                    Notifications
                  </h4>
                  <span className="rounded-full bg-blue-950/80 border border-blue-800/60 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
                    3 New
                  </span>
                </div>
                <div className="mt-3 space-y-2.5">
                  <div className="rounded-xl bg-zinc-900/90 border border-zinc-800/80 p-2.5 flex items-start gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-zinc-200">
                        Assessment safety gate active
                      </p>
                      <p className="text-[11px] text-zinc-400">
                        Ghana 112 emergency routing verified and operational.
                      </p>
                    </div>
                  </div>
                  <div className="rounded-xl bg-zinc-900/90 border border-zinc-800/80 p-2.5 flex items-start gap-2.5">
                    <Shield className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-zinc-200">
                        Act 843 Privacy Standards
                      </p>
                      <p className="text-[11px] text-zinc-400">
                        Health data encryption and right-to-erasure enabled.
                      </p>
                    </div>
                  </div>
                  <div className="rounded-xl bg-zinc-900/90 border border-zinc-800/80 p-2.5 flex items-start gap-2.5">
                    <Clock className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-zinc-200">
                        Clinic Directory Freshness
                      </p>
                      <p className="text-[11px] text-zinc-400">
                        Accra and Kumasi referral centers verified for 2026.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Dropdown Pill */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2.5 rounded-2xl p-1.5 sm:px-3 hover:bg-zinc-900 transition-colors"
              aria-label="User profile options"
            >
              {/* Circular Avatar Badge with Initials */}
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 font-bold text-xs shadow-sm">
                {userInitials}
              </div>
              <span className="hidden sm:inline-block text-sm font-semibold text-zinc-200">
                {displayName}
              </span>
              <ChevronDown className="h-4 w-4 text-zinc-400" />
            </button>

            {/* Profile Menu Popover */}
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-zinc-800 bg-zinc-950 p-2 shadow-2xl z-50 animate-in fade-in-50 duration-150">
                <div className="px-3 py-2 border-b border-zinc-800 mb-1">
                  <p className="text-xs font-bold text-white truncate">
                    {displayName}
                  </p>
                  <p className="text-[11px] text-zinc-400 truncate">
                    {session?.user?.email || "Guest Session"}
                  </p>
                </div>

                <div className="space-y-0.5">
                  <Link
                    href="/dashboard/profile"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-white"
                  >
                    <UserIcon className="h-4 w-4 text-zinc-400" />
                    <span>My Health Profile</span>
                  </Link>
                  <Link
                    href="/history"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-white"
                  >
                    <FileText className="h-4 w-4 text-zinc-400" />
                    <span>My Health Records</span>
                  </Link>
                  <Link
                    href="/dashboard/reminders"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-white"
                  >
                    <Clock className="h-4 w-4 text-zinc-400" />
                    <span>Medication Reminders</span>
                  </Link>
                  <Link
                    href="/dashboard/privacy"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-900 hover:text-white"
                  >
                    <Shield className="h-4 w-4 text-zinc-400" />
                    <span>Privacy & Consents</span>
                  </Link>

                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-blue-400 bg-blue-950/40 border border-blue-900/60 hover:bg-blue-900/50"
                    >
                      <Shield className="h-4 w-4 text-blue-400" />
                      <span>Admin Governance</span>
                    </Link>
                  )}
                </div>

                <div className="border-t border-zinc-800 mt-2 pt-1">
                  {status === "authenticated" ? (
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        signOut({ callbackUrl: "/" });
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-950/30"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Sign Out</span>
                    </button>
                  ) : (
                    <Link
                      href="/login"
                      onClick={() => setProfileOpen(false)}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-blue-400 hover:bg-blue-950/30"
                    >
                      <LogIn className="h-4 w-4" />
                      <span>Sign In / Register</span>
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Global Search Dialog */}
      <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
