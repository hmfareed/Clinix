"use client";

import * as React from "react";
import {
  MapPin,
  PhoneCall,
  Navigation,
  Clock,
  Globe,
  ShieldCheck,
  Building2,
  Stethoscope,
  Pill,
  ShieldAlert,
  CalendarCheck2,
  Accessibility,
  Car,
  AlertCircle,
  X,
  Copy,
  Check,
} from "lucide-react";
import { NormalizedFacility, FacilityType } from "@/lib/healthcare-places/types";
import { formatStraightLineDistance } from "@/lib/healthcare-places/distance";

interface FacilityDetailsModalProps {
  facility: NormalizedFacility | null;
  onClose: () => void;
}

export function FacilityDetailsModal({ facility, onClose }: FacilityDetailsModalProps) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!facility) return null;

  const typeConfig: Record<
    FacilityType,
    { label: string; icon: React.ComponentType<{ className?: string }>; badgeClass: string }
  > = {
    emergency_department: {
      label: "Emergency Department",
      icon: ShieldAlert,
      badgeClass: "bg-red-950/80 text-red-300 border-red-800/80",
    },
    hospital: {
      label: "Hospital",
      icon: Building2,
      badgeClass: "bg-blue-950/80 text-blue-300 border-blue-800/80",
    },
    clinic: {
      label: "Clinic / Health Centre",
      icon: Stethoscope,
      badgeClass: "bg-teal-950/80 text-teal-300 border-teal-800/80",
    },
    pharmacy: {
      label: "Pharmacy",
      icon: Pill,
      badgeClass: "bg-amber-950/80 text-amber-300 border-amber-800/80",
    },
    specialist: {
      label: "Specialist Facility",
      icon: Stethoscope,
      badgeClass: "bg-purple-950/80 text-purple-300 border-purple-800/80",
    },
  };

  const currentType = typeConfig[facility.facilityType] || typeConfig.clinic;
  const TypeIcon = currentType.icon;

  function copyAddress() {
    if (!facility?.formattedAddress) return;
    navigator.clipboard.writeText(facility.formattedAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="facility-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-zinc-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="absolute right-4 top-4 rounded-lg bg-zinc-900 border border-zinc-800 p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="space-y-2 pr-8">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${currentType.badgeClass}`}
            >
              <TypeIcon className="h-3.5 w-3.5" />
              <span>{currentType.label}</span>
            </span>

            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 text-[11px] text-zinc-400">
              <ShieldCheck className="h-3 w-3 text-teal-400" />
              <span>Verified Facility</span>
            </span>
          </div>

          <h2 id="facility-modal-title" className="text-2xl font-extrabold text-white tracking-tight">
            {facility.name}
          </h2>

          {facility.formattedAddress && (
            <div className="flex items-start gap-2 text-xs text-zinc-400 pt-1">
              <MapPin className="h-4 w-4 shrink-0 text-zinc-500 mt-0.5" />
              <span className="flex-1">{facility.formattedAddress}</span>
              <button
                type="button"
                onClick={copyAddress}
                title="Copy address to clipboard"
                className="inline-flex items-center gap-1 text-[11px] text-teal-400 hover:text-teal-300 font-medium cursor-pointer"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
          )}
        </div>

        {/* Primary Action Buttons */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-zinc-800/80">
          {facility.phoneNumber ? (
            <a
              href={`tel:${facility.phoneNumber}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white px-4 py-2.5 text-xs font-bold shadow-md transition cursor-pointer"
            >
              <PhoneCall className="h-4 w-4" />
              <span>Call Facility ({facility.phoneNumber})</span>
            </a>
          ) : (
            <button
              disabled
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-500 px-4 py-2.5 text-xs font-medium cursor-not-allowed"
            >
              <PhoneCall className="h-4 w-4" />
              <span>Phone Unlisted</span>
            </button>
          )}

          <a
            href={facility.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white px-4 py-2.5 text-xs font-bold shadow-md transition cursor-pointer"
          >
            <Navigation className="h-4 w-4" />
            <span>Open in Directions Map</span>
          </a>
        </div>

        {/* Distance & Travel Time Notice */}
        {facility.distanceMeters !== undefined && (
          <div className="mt-4 rounded-xl bg-zinc-900/80 border border-zinc-800 p-3 text-xs space-y-1">
            <div className="flex items-center justify-between text-zinc-300 font-semibold">
              <span className="flex items-center gap-1.5 text-teal-400">
                <Navigation className="h-3.5 w-3.5" />
                <span>{formatStraightLineDistance(facility.distanceMeters)}</span>
              </span>
              <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-mono">
                Straight-line flight distance
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Driving road distance and estimated travel time may be longer depending on route choices, road
              surfaces, and real-time traffic conditions. Use the Directions button for turn-by-turn navigation.
            </p>
          </div>
        )}

        {/* Operating Hours & Verification */}
        <div className="mt-5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Operating Hours & Availability
          </h3>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5 space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-zinc-500 shrink-0" />
              <div className="flex-1">
                {facility.openNow !== undefined && facility.openNow !== null ? (
                  <span
                    className={`font-semibold inline-flex items-center gap-1 ${
                      facility.openNow ? "text-emerald-400" : "text-amber-400"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${facility.openNow ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                    {facility.openNow ? "Currently Open" : "Currently Closed"}
                  </span>
                ) : (
                  <span className="text-zinc-400">Opening status unverified</span>
                )}
              </div>
            </div>

            {facility.openingHours ? (
              <p className="text-zinc-300 font-medium pl-6">{facility.openingHours}</p>
            ) : (
              <p className="text-zinc-500 italic pl-6">
                Detailed weekly operating hours are not listed in the public directory. Please phone the facility
                before travelling for non-emergency visits.
              </p>
            )}
          </div>
        </div>

        {/* Services & Verified Specialties */}
        {facility.services && facility.services.length > 0 && (
          <div className="mt-5 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Verified Services & Clinical Specialties
            </h3>
            <div className="flex flex-wrap gap-2">
              {facility.services.map((service, idx) => (
                <span
                  key={idx}
                  className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200"
                >
                  {service}
                </span>
              ))}
            </div>
            <p className="text-[10px] text-zinc-500 italic pt-1">
              * Specialty capabilities are confirmed from the official healthcare provider registry. Clinix does
              not infer emergency care or specialty capabilities from facility names alone.
            </p>
          </div>
        )}

        {/* Accessibility & Logistics */}
        <div className="mt-5 space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Accessibility & Facility Access
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 flex items-center gap-2.5">
              <Accessibility className="h-4 w-4 text-teal-400 shrink-0" />
              <div>
                <p className="font-semibold text-zinc-200">Wheelchair Accessible</p>
                <p className="text-[11px] text-zinc-400">
                  {facility.accessibility?.wheelchairAccessible ? "Step-free or ramped access verified" : "Access details unconfirmed"}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 flex items-center gap-2.5">
              <Car className="h-4 w-4 text-teal-400 shrink-0" />
              <div>
                <p className="font-semibold text-zinc-200">Patient Parking</p>
                <p className="text-[11px] text-zinc-400">
                  {facility.accessibility?.parking ? "On-site or adjacent parking available" : "Parking space varies"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Appointment Booking Status */}
        <div className="mt-5 space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Appointment Booking Status
          </h3>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5 flex items-start gap-3 text-xs">
            <CalendarCheck2 className="h-4 w-4 text-zinc-400 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="font-semibold text-zinc-200">
                {facility.appointmentBooking?.available ? "Online Booking Available" : "Direct Phone Scheduling"}
              </p>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                {facility.appointmentBooking?.note ||
                  "Direct online booking integration is not available for this facility. Please call directly using the verified telephone number to schedule consultations."}
              </p>
              {facility.appointmentBooking?.url && (
                <a
                  href={facility.appointmentBooking.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-teal-400 hover:underline pt-1 text-[11px] font-semibold"
                >
                  <span>Book on Provider Website</span>
                  <Globe className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Website Link (if verified) */}
        {facility.websiteUrl && (
          <div className="mt-4 pt-2">
            <a
              href={facility.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 font-semibold underline"
            >
              <Globe className="h-3.5 w-3.5" />
              <span>Visit Official Website</span>
            </a>
          </div>
        )}

        {/* Provenance & Disclaimer Footer */}
        <div className="mt-6 rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-3.5 text-[11px] text-zinc-500 space-y-1">
          <div className="flex items-center justify-between">
            <span>Data Source: <strong className="text-zinc-400">{facility.provider}</strong></span>
            {facility.lastVerifiedAt && (
              <span>Last verified: {new Date(facility.lastVerifiedAt).toLocaleDateString()}</span>
            )}
          </div>
          <div className="flex items-start gap-1.5 pt-1 text-amber-500/80">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <p>
              Clinix strictly prohibits fabricating ratings, opening hours, or appointment slots. If you suspect an
              immediate medical emergency, do not wait—call 112 immediately.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
