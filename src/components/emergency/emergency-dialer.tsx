"use client";

import * as React from "react";
import { PhoneCall, Globe, AlertCircle } from "lucide-react";
import fallbackConfigurations from "@/data/emergency-configurations.json";

export function EmergencyDialer() {
  const [selectedCountryCode, setSelectedCountryCode] = React.useState("GH");

  const currentConfig =
    fallbackConfigurations.find((c) => c.countryCode === selectedCountryCode) ||
    fallbackConfigurations[0];

  function handleCallInitiated() {
    // Non-blocking telemetry audit call
    fetch("/api/emergency/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actionType: "call_button_clicked",
        country: currentConfig.countryCode,
      }),
    }).catch(() => {});
  }

  return (
    <div className="rounded-2xl border-2 border-red-500 bg-red-600 p-6 sm:p-10 text-white shadow-xl text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 mb-4 backdrop-blur-sm">
        <PhoneCall className="h-10 w-10 animate-bounce text-white" />
      </div>

      <h1 className="text-3xl sm:text-5xl font-black tracking-tight">
        EMERGENCY NUMBER: {currentConfig.emergencyNumber}
      </h1>

      <p className="mt-3 text-sm sm:text-base font-semibold text-red-100">
        {currentConfig.serviceName} ({currentConfig.countryName})
      </p>

      {/* Country Selector */}
      <div className="mt-5 flex items-center justify-center gap-2 text-xs">
        <Globe className="h-4 w-4 text-red-200" />
        <span className="text-red-200">Country:</span>
        <select
          value={selectedCountryCode}
          onChange={(e) => setSelectedCountryCode(e.target.value)}
          className="rounded-md bg-red-700/80 px-2.5 py-1 text-xs font-semibold text-white border border-red-400 focus:outline-none focus:ring-2 focus:ring-white"
        >
          {fallbackConfigurations.map((c) => (
            <option key={c.countryCode} value={c.countryCode} className="bg-slate-900 text-white">
              {c.countryName} ({c.emergencyNumber})
            </option>
          ))}
        </select>
      </div>

      {/* Call Button */}
      <div className="mt-7">
        <a
          href={`tel:${currentConfig.emergencyNumber}`}
          onClick={handleCallInitiated}
          className="inline-flex items-center gap-3 rounded-xl bg-white px-8 py-4 text-xl font-black text-red-600 shadow-2xl transition hover:bg-red-50 active:scale-95"
        >
          <PhoneCall className="h-6 w-6" />
          <span>Call {currentConfig.emergencyNumber} Now</span>
        </a>
      </div>

      <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-red-200">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        <span>
          Clicking connects directly to your phone dialer. Clinix does not claim an ambulance was
          dispatched until verified through emergency services.
        </span>
      </div>
    </div>
  );
}
