"use client";

import * as React from "react";
import {
  MapPin,
  Navigation,
  PhoneCall,
  ExternalLink,
  Search,
  AlertTriangle,
  Loader2,
  Building2,
  ShieldAlert,
  Stethoscope,
  Pill,
  Clock,
  RotateCcw,
} from "lucide-react";
import { NormalizedFacility, FacilityType } from "@/lib/healthcare-places/types";
import { formatDistance, formatStraightLineDistance } from "@/lib/healthcare-places/distance";

export type LocationSearchState =
  | "idle"
  | "requesting_permission"
  | "searching"
  | "results_found"
  | "no_results"
  | "permission_denied"
  | "location_unavailable"
  | "request_failed";

interface HealthcareFinderWidgetProps {
  initialFacilities?: NormalizedFacility[];
  initialLocationName?: string;
  defaultRadiusMeters?: number;
  onFacilitySelect?: (facility: NormalizedFacility) => void;
}

const POPULAR_GHANA_TOWNS = [
  { name: "Accra", query: "Accra" },
  { name: "Kumasi", query: "Kumasi" },
  { name: "Tamale", query: "Tamale" },
  { name: "Takoradi", query: "Takoradi" },
  { name: "Tema", query: "Tema" },
  { name: "Cape Coast", query: "Cape Coast" },
];

export function HealthcareFinderWidget({
  initialFacilities = [],
  initialLocationName,
  defaultRadiusMeters = 5000,
}: HealthcareFinderWidgetProps) {
  const [state, setState] = React.useState<LocationSearchState>(
    initialFacilities.length > 0 ? "results_found" : "idle"
  );
  const [facilities, setFacilities] = React.useState<NormalizedFacility[]>(initialFacilities);
  const [currentCoords, setCurrentCoords] = React.useState<{ lat: number; lng: number } | null>(null);
  const [selectedRadiusMeters, setSelectedRadiusMeters] = React.useState<number>(defaultRadiusMeters);
  const [selectedType, setSelectedType] = React.useState<FacilityType | "all">("all");
  const [manualQuery, setManualQuery] = React.useState("");
  const [locationLabel, setLocationLabel] = React.useState<string>(initialLocationName || "");
  const [errorMessage, setErrorMessage] = React.useState<string>("");

  // Request browser GPS location
  function handleUseMyLocation() {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setState("location_unavailable");
      setErrorMessage("Geolocation is not supported by your browser. Please enter your town manually.");
      return;
    }

    setState("requesting_permission");
    setErrorMessage("");
    setFacilities([]);

    const onSuccess = async (pos: GeolocationPosition) => {
      const accuracy = Math.round(pos.coords.accuracy);
      const coords = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      };
      setCurrentCoords(coords);
      const label = accuracy <= 200 ? `Your Current Location (±${accuracy}m)` : "Your Current Location";
      setLocationLabel(label);
      await executeNearbySearch(coords.lat, coords.lng, selectedRadiusMeters, selectedType);
    };

    const onError = (err: GeolocationPositionError) => {
      console.warn("[GEOLOCATION PERMISSION ERROR]", err);
      if (err.code === err.PERMISSION_DENIED) {
        setState("permission_denied");
        setErrorMessage("Location permission was denied. You can search by town or neighbourhood below.");
      } else if (err.code === err.TIMEOUT) {
        setState("location_unavailable");
        setErrorMessage("Location request timed out. Please enter your town or landmark below.");
      } else {
        setState("location_unavailable");
        setErrorMessage("Unable to retrieve device coordinates. Please enter your location manually.");
      }
    };

    // Attempt high accuracy GPS first
    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (err) => {
        if (err.code === err.TIMEOUT) {
          navigator.geolocation.getCurrentPosition(onSuccess, onError, {
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 30000,
          });
        } else {
          onError(err);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }

  // Execute backend search with coordinates
  async function executeNearbySearch(
    lat: number,
    lng: number,
    radius: number,
    type: FacilityType | "all"
  ) {
    setState("searching");
    setErrorMessage("");

    try {
      const res = await fetch("/api/v1/healthcare/nearby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: lat,
          longitude: lng,
          radiusMeters: radius,
          facilityTypes: type === "all" ? undefined : type,
          limit: 10,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Search failed.");
      }

      const results: NormalizedFacility[] = json.data || [];
      setFacilities(results);
      if (results.length > 0) {
        setState("results_found");
      } else {
        setState("no_results");
      }
    } catch (err: unknown) {
      setState("request_failed");
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Unable to find nearby facilities right now. If in an emergency, dial 112 immediately."
      );
    }
  }

  // Handle manual location geocoding & search
  async function handleManualSearch(queryToSearch?: string) {
    const q = (queryToSearch || manualQuery).trim();
    if (!q) return;

    setState("searching");
    setErrorMessage("");

    try {
      const geocodeRes = await fetch("/api/v1/healthcare/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });

      const geocodeJson = await geocodeRes.json();
      if (!geocodeRes.ok || !geocodeJson.success) {
        throw new Error(geocodeJson.error?.message || `Could not find "${q}". Try a major city like Accra or Kumasi.`);
      }

      const coords = {
        lat: geocodeJson.data.latitude,
        lng: geocodeJson.data.longitude,
      };

      setCurrentCoords(coords);
      setLocationLabel(geocodeJson.data.displayName);
      await executeNearbySearch(coords.lat, coords.lng, selectedRadiusMeters, selectedType);
    } catch (err: unknown) {
      setState("request_failed");
      setErrorMessage(err instanceof Error ? err.message : "Geocoding failed. Please check the spelling.");
    }
  }

  // Handle changing radius
  async function handleRadiusChange(newRadius: number) {
    setSelectedRadiusMeters(newRadius);
    if (currentCoords) {
      await executeNearbySearch(currentCoords.lat, currentCoords.lng, newRadius, selectedType);
    }
  }

  // Handle changing type filter
  async function handleTypeFilterChange(newType: FacilityType | "all") {
    setSelectedType(newType);
    if (currentCoords) {
      await executeNearbySearch(currentCoords.lat, currentCoords.lng, selectedRadiusMeters, newType);
    }
  }

  return (
    <div className="w-full my-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3 sm:p-4 text-zinc-100 shadow-md">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-950/80 border border-teal-800/60 text-teal-400">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Nearby Healthcare Facility Finder
            </h4>
            <p className="text-[11px] text-zinc-400">
              {locationLabel ? `Showing care near ${locationLabel}` : "Real-time verified facilities ranked by proximity"}
            </p>
          </div>
        </div>

        {state === "results_found" && (
          <button
            type="button"
            onClick={() => {
              setState("idle");
              setFacilities([]);
              setCurrentCoords(null);
            }}
            className="text-[11px] font-medium text-teal-400 hover:text-teal-300 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Search New Location</span>
          </button>
        )}
      </div>

      {/* State: Prompt to use location or manual search */}
      {(state === "idle" || state === "permission_denied" || state === "location_unavailable") && (
        <div className="space-y-3">
          <div className="rounded-lg bg-zinc-900/90 border border-zinc-800 p-3 text-xs space-y-2">
            <div className="flex items-start gap-2.5">
              <Navigation className="h-4 w-4 text-teal-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-zinc-200 font-medium">
                  Clinix needs access to your device location to discover nearby verified hospitals and clinics.
                </p>
                <p className="text-[11px] text-zinc-400">
                  Your coordinates are used strictly for this search and are never stored or shared without consent.
                </p>
              </div>
            </div>

            <div className="pt-1 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleUseMyLocation}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white px-3.5 py-1.5 text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <Navigation className="h-3.5 w-3.5" />
                <span>Use My Location</span>
              </button>
            </div>
          </div>

          {/* Feedback if permission denied or unavailable */}
          {(state === "permission_denied" || state === "location_unavailable") && (
            <div className="rounded-lg bg-amber-950/40 border border-amber-800/60 p-2.5 text-xs text-amber-300 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Manual Location Fallback Input */}
          <div className="pt-1 space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
              Or Search by City, Town, or Landmark:
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="e.g. Accra, Kumasi, Osu, Tamale, Takoradi..."
                  value={manualQuery}
                  onChange={(e) => setManualQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleManualSearch()}
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-800 pl-8 pr-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <button
                type="button"
                onClick={() => handleManualSearch()}
                className="rounded-lg bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 text-zinc-200 px-3 py-1.5 text-xs font-semibold border border-zinc-700 transition cursor-pointer"
              >
                Find
              </button>
            </div>

            {/* Popular Ghana Town Pills */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-zinc-500 font-medium">Quick:</span>
              {POPULAR_GHANA_TOWNS.map((town) => (
                <button
                  key={town.name}
                  type="button"
                  onClick={() => {
                    setManualQuery(town.name);
                    handleManualSearch(town.query);
                  }}
                  className="rounded-full bg-zinc-900 hover:bg-teal-950/80 hover:border-teal-700/60 text-zinc-300 hover:text-teal-300 border border-zinc-800 px-2.5 py-0.5 text-[10px] font-medium transition cursor-pointer"
                >
                  {town.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* State: Requesting permission or Searching spinner */}
      {(state === "requesting_permission" || state === "searching") && (
        <div className="flex flex-col items-center justify-center p-6 space-y-2 text-center animate-in fade-in">
          <Loader2 className="h-6 w-6 animate-spin text-teal-400" />
          <p className="text-xs font-semibold text-zinc-200">
            {state === "requesting_permission"
              ? "Waiting for location permission in your browser..."
              : `Searching verified facilities within ${(selectedRadiusMeters / 1000).toFixed(0)} km...`}
          </p>
          <p className="text-[11px] text-zinc-500">
            Connecting to verified healthcare places provider
          </p>
        </div>
      )}

      {/* State: Error / Request failed */}
      {state === "request_failed" && (
        <div className="rounded-lg bg-red-950/40 border border-red-800/60 p-3 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-red-300 font-bold">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <span>Search Could Not Complete</span>
          </div>
          <p className="text-red-200 text-[11px]">{errorMessage}</p>
          <button
            type="button"
            onClick={() => setState("idle")}
            className="inline-flex items-center gap-1 rounded bg-zinc-900 hover:bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-200 border border-zinc-700 cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* State: No results found */}
      {state === "no_results" && (
        <div className="rounded-lg bg-zinc-900/60 border border-zinc-800 p-4 text-center space-y-3">
          <Building2 className="h-8 w-8 text-zinc-600 mx-auto" />
          <div className="space-y-1">
            <h5 className="text-xs font-bold text-zinc-200">
              No healthcare facilities found within {(selectedRadiusMeters / 1000).toFixed(0)} km
            </h5>
            <p className="text-[11px] text-zinc-400">
              Try expanding your search radius up to 25 km or search a neighboring city.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => handleRadiusChange(25000)}
              className="rounded-lg bg-teal-600 hover:bg-teal-500 text-white px-3 py-1 text-xs font-semibold cursor-pointer"
            >
              Expand to 25 km Radius
            </button>
            <button
              type="button"
              onClick={() => setState("idle")}
              className="rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1 text-xs font-medium cursor-pointer"
            >
              Search Another Town
            </button>
          </div>
        </div>
      )}

      {/* State: Results Found — Render Filter Bar + Facility Cards */}
      {state === "results_found" && facilities.length > 0 && (
        <div className="space-y-3">
          {/* Controls: Radius & Type Filter */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800/60 pb-2.5 text-xs">
            {/* Facility Type Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1">
              {[
                { key: "all", label: "All" },
                { key: "hospital", label: "Hospitals" },
                { key: "clinic", label: "Clinics" },
                { key: "emergency_department", label: "Emergency" },
                { key: "pharmacy", label: "Pharmacies" },
                { key: "specialist", label: "Specialists" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleTypeFilterChange(key as FacilityType | "all")}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                    selectedType === key
                      ? "bg-teal-600 text-white shadow-xs"
                      : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 border border-zinc-800"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Radius Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-zinc-500">Radius:</span>
              {[1000, 5000, 10000, 25000].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleRadiusChange(r)}
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                    selectedRadiusMeters === r
                      ? "bg-zinc-700 text-white"
                      : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 border border-zinc-800"
                  }`}
                >
                  {r >= 1000 ? `${r / 1000} km` : `${r} m`}
                </button>
              ))}
            </div>
          </div>

          {/* Cards List */}
          <div className="space-y-2.5">
            {facilities.map((facility) => {
              const badgeStyle =
                facility.facilityType === "emergency_department"
                  ? "bg-red-950/80 text-red-300 border-red-800/80"
                  : facility.facilityType === "hospital"
                  ? "bg-blue-950/80 text-blue-300 border-blue-800/80"
                  : facility.facilityType === "pharmacy"
                  ? "bg-amber-950/80 text-amber-300 border-amber-800/80"
                  : facility.facilityType === "specialist"
                  ? "bg-purple-950/80 text-purple-300 border-purple-800/80"
                  : "bg-teal-950/80 text-teal-300 border-teal-800/80";

              const badgeLabel =
                facility.facilityType === "emergency_department"
                  ? "Emergency Department"
                  : facility.facilityType === "hospital"
                  ? "Hospital"
                  : facility.facilityType === "pharmacy"
                  ? "Pharmacy"
                  : facility.facilityType === "specialist"
                  ? "Specialist Facility"
                  : "Clinic / Center";

              return (
                <div
                  key={facility.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/90 p-3 text-xs space-y-2 hover:border-zinc-700 transition"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className={`inline-block rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider mb-1 ${badgeStyle}`}>
                        {badgeLabel}
                      </span>
                      <h5 className="text-sm font-bold text-white leading-snug">
                        {facility.name}
                      </h5>
                    </div>

                    {facility.distanceMeters !== undefined && (
                      <span
                        title="Approximate straight-line distance. Road distance and travel time will vary depending on route and traffic."
                        className="shrink-0 text-[11px] font-bold text-teal-400 bg-teal-950/50 border border-teal-800/60 rounded px-2 py-0.5 flex items-center gap-1"
                      >
                        <Navigation className="h-3 w-3" />
                        {formatStraightLineDistance(facility.distanceMeters)}
                      </span>
                    )}
                  </div>

                  {/* Address */}
                  {facility.formattedAddress && (
                    <div className="flex items-start gap-1.5 text-zinc-300 text-[11px]">
                      <MapPin className="h-3.5 w-3.5 text-zinc-500 shrink-0 mt-0.5" />
                      <span>{facility.formattedAddress}</span>
                    </div>
                  )}

                  {/* Verified Opening Status */}
                  {facility.openingHours && (
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <Clock className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                      <span className="text-emerald-400 font-medium">
                        {facility.openingHours}
                      </span>
                    </div>
                  )}

                  {/* Action Buttons: Call & Directions */}
                  <div className="flex items-center gap-2 pt-1 border-t border-zinc-800/60">
                    {facility.phoneNumber && (
                      <a
                        href={`tel:${facility.phoneNumber}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white px-3 py-1.5 text-[11px] font-bold shadow-xs transition"
                      >
                        <PhoneCall className="h-3 w-3" />
                        <span>Call ({facility.phoneNumber})</span>
                      </a>
                    )}

                    <a
                      href={facility.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 text-[11px] font-semibold border border-zinc-700 transition"
                    >
                      <Navigation className="h-3 w-3 text-teal-400" />
                      <span>Directions</span>
                      <ExternalLink className="h-2.5 w-2.5 text-zinc-500" />
                    </a>

                    {facility.websiteUrl && (
                      <a
                        href={facility.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 px-2 py-1.5 text-[11px] border border-zinc-700"
                        title="Official Website"
                      >
                        <span>Website</span>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
