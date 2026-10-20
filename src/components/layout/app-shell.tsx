"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const pathname = usePathname();

  // If on pure authentication screens, give full-page focus
  const isAuthPage =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/verify-email";

  if (isAuthPage) {
    return (
      <main id="main-content" className="flex-1 flex items-center justify-center p-4 bg-black text-slate-100">
        {children}
      </main>
    );
  }

  return (
    <div className="min-h-screen flex bg-black text-slate-100 font-sans">
      {/* Persistent Left Sidebar (Desktop + Mobile Drawer) */}
      <Sidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Main App Container (Shifted right on desktop by sidebar width lg:pl-72) */}
      <div className="flex flex-1 flex-col lg:pl-72 min-w-0 bg-black">
        {/* Sticky Top Bar Header */}
        <TopBar onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        {/* Dynamic Page Content */}
        <main
          id="main-content"
          className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 focus:outline-none bg-black text-slate-100"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
