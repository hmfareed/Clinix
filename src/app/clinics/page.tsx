"use client";

import * as React from "react";
import {
  MapPin,
  PhoneCall,
  Navigation,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Building2,
  Stethoscope,
  Pill,
  Search,
  ExternalLink,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Facility, FacilityType } from "@/lib/maps/types";

const GHANA_POPULAR_TOWNS = [
  { name: "Accra (Capital)", query: "Accra", lat: 5.556, lng: -0.1969 },
  { name: "Kumasi (Ashanti)", query: "Kumasi", lat: 6.6885, lng: -1.6244 },
  { name: "Tamale (Northern)", query: "Tamale", lat: 9.4008, lng: -0.8393 },
  { name: "Takoradi (Western)", query: "Takoradi", lat: 4.8873, lng: -1.7554 },
  { name: "Cape Coast (Central)", query: "Cape Coast", lat: 5.1054, lng: -1.2466 },
  { name: "Tema (Greater Accra)", query: "Tema", lat: 5.6698, lng: -0.0166 },
];

export default function ClinicsPage() {
  const [facilities, setFacilities] = React.useState<Facility[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [errorState, setErrorState] = React.useState<{ message: string; safeAction?: string; externalUrl?: string } | null>(null);

  // Filters
  const [selectedType, setSelectedType] = React.useState<FacilityType | "all">("all");
  const [searchQuery, setSearchQuery] = React.useState("Accra");
  const [userLocation, setUserLocation] = React.useState<{ lat: number; lng: number } | null>(null);
  const [locationPermissionState, setLocationPermissionState] = React.useState<"prompt" | "granted" | "denied">("prompt");
  const [geolocating, setGeolocating] = React.useState(false);

  // Fetch facilities
  const fetchFacilities = React.useCallback(
    async (params: { q?: string; lat?: number; lng?: number; type?: FacilityType | "all" }) => {
      setLoading(true);
      setErrorState(null);

      const urlParams = new URLSearchParams();
      if (params.lat !== undefined && params.lng !== undefined) {
        urlParams.set("lat", String(params.lat));
        urlParams.set("lng", String(params.lng));
      } else if (params.q && params.q.trim()) {
        urlParams.set("q", params.q.trim());
      }

      if (params.type && params.type !== "all") {
        urlParams.set("type", params.type);
      }

      try {
        const res = await fetch(`/api/facilities?${urlParams.toString()}`);
        const data = await res.json();

        if (!res.ok) {
          setErrorState({
            message: data.error?.message || "Could not retrieve facility directory.",
            safeAction: data.error?.safeAction,
            externalUrl: data.error?.externalSearchUrl,
          });
          setFacilities([]);
        } else {
          setFacilities(data.data || []);
        }
      } catch {
        setErrorState({
          message: "Network error loading healthcare facilities.",
          safeAction: "If you have an acute emergency, dial 112 immediately.",
          externalUrl: "https://www.google.com/maps/search/hospital+near+me",
        });
      } finally {
        setLoading(false);
      }
    },
    []
  );

  React.useEffect(() => {
    fetchFacilities({ q: searchQuery, type: selectedType });
  }, [fetchFacilities, selectedType]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setUserLocation(null);
    fetchFacilities({ q: searchQuery, type: selectedType });
  }

  function handleSelectTown(town: typeof GHANA_POPULAR_TOWNS[0]) {
    setSearchQuery(town.name);
    setUserLocation({ lat: town.lat, lng: town.lng });
    fetchFacilities({ lat: town.lat, lng: town.lng, type: selectedType });
  }

  function handleRequestGeolocation() {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setGeolocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeolocating(false);
        setLocationPermissionState("granted");
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(coords);
        setSearchQuery("Current Device Location");
        fetchFacilities({ lat: coords.lat, lng: coords.lng, type: selectedType });
      },
      (err) => {
        setGeolocating(false);
        setLocationPermissionState("denied");
        console.warn("Geolocation denied or unavailable:", err.message);
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Emergency Header Fast Call Banner */}
      <div className="mb-8 rounded-xl border border-red-200 bg-red-50 p-4 text-xs dark:border-red-950 dark:bg-red-950/40">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <PhoneCall className="h-4 w-4 text-red-600 animate-pulse shrink-0" />
            <span className="font-semibold text-red-900 dark:text-red-200">
              Medical Emergency? Call the Ghana National Ambulance Service directly.
            </span>
          </div>
          <a
            href="tel:112"
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-1.5 font-bold text-white shadow hover:bg-red-700"
          >
            <span>Call 112 Immediately</span>
          </a>
        </div>
      </div>

      {/* Main Title & Search Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-300 mb-2">
          <MapPin className="h-4 w-4" />
          <span>Verified Care Navigation</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          Find Nearby Healthcare Facilities
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Search verified hospitals, emergency departments, clinics, and 24-hour pharmacies across Ghana.
        </p>
      </div>

      {/* Search & Location Bar */}
      <Card className="mb-8 shadow-sm">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <form onSubmit={handleSearchSubmit} className="flex flex-1 items-center gap-2 w-full">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Enter city, town, or area in Ghana (e.g. Accra, Kumasi, Osu)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button type="submit" variant="default" disabled={loading}>
                Search
              </Button>
            </form>

            <Button
              variant="outline"
              onClick={handleRequestGeolocation}
              disabled={geolocating}
              className="w-full sm:w-auto flex items-center gap-2 shrink-0 text-xs"
            >
              <Navigation className="h-4 w-4 text-teal-600" />
              <span>{geolocating ? "Locating..." : "Use My GPS Location"}</span>
            </Button>
          </div>

          {locationPermissionState === "denied" && (
            <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>Location access was denied. You can select your town manually below.</span>
            </p>
          )}

          {/* Quick Town Selectors */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="text-slate-500 font-medium">Popular Regions:</span>
            {GHANA_POPULAR_TOWNS.map((t) => (
              <button
                key={t.name}
                onClick={() => handleSelectTown(t)}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-teal-50 hover:text-teal-700 transition dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-teal-950 dark:hover:text-teal-400 cursor-pointer"
              >
                {t.name}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Facility Type Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {[
          { key: "all", label: "All Facilities", icon: Building2 },
          { key: "emergency_department", label: "Emergency Departments", icon: ShieldAlert },
          { key: "hospital", label: "Hospitals", icon: Building2 },
          { key: "clinic", label: "Clinics", icon: Stethoscope },
          { key: "pharmacy", label: "Pharmacies", icon: Pill },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSelectedType(key as FacilityType | "all")}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
              selectedType === key
                ? "bg-teal-600 text-white shadow-sm"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* ERROR / DEGRADED STATE */}
      {errorState && (
        <Card className="mb-8 border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-red-600 shrink-0" />
              <div className="space-y-2">
                <h3 className="text-base font-bold text-red-900 dark:text-red-200">
                  {errorState.message}
                </h3>
                {errorState.safeAction && (
                  <p className="text-xs text-red-800 dark:text-red-300">{errorState.safeAction}</p>
                )}
                {errorState.externalUrl && (
                  <a
                    href={errorState.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700 underline hover:text-teal-800 dark:text-teal-400"
                  >
                    <span>Search on Google Maps</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* FACILITIES LIST */}
      {loading ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
          <p className="text-xs text-slate-500">Searching verified healthcare facilities...</p>
        </div>
      ) : facilities.length === 0 ? (
        <Card className="p-8 text-center text-slate-500">
          <Building2 className="mx-auto h-12 w-12 text-slate-400 mb-3" />
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">
            No facilities found matching your criteria.
          </h3>
          <p className="mt-1 text-xs">
            Try adjusting your search radius, selecting "All Facilities", or choosing another town.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {facilities.map((facility) => {
            const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${facility.location.lat},${facility.location.lng}`;

            return (
              <Card
                key={facility.providerId}
                className="flex flex-col justify-between shadow-sm hover:shadow-md transition border-slate-200 dark:border-slate-800"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <Badge
                      variant={
                        facility.type === "emergency_department"
                          ? "destructive"
                          : facility.type === "hospital"
                          ? "default"
                          : "secondary"
                      }
                      className="capitalize text-[10px]"
                    >
                      {facility.type.replace("_", " ")}
                    </Badge>

                    {facility.distanceKm !== undefined && (
                      <span className="text-xs font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1">
                        <Navigation className="h-3 w-3" />
                        {facility.distanceKm} km
                      </span>
                    )}
                  </div>

                  <CardTitle className="text-base font-bold text-slate-900 dark:text-white mt-2 leading-snug">
                    {facility.name}
                  </CardTitle>

                  {facility.address && (
                    <CardDescription className="text-xs flex items-start gap-1.5 mt-1">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400 mt-0.5" />
                      <span>{facility.address}</span>
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="space-y-2 text-xs text-slate-600 dark:text-slate-300 py-2 border-y border-slate-100 dark:border-slate-800">
                  {/* Hours */}
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>
                      {facility.hours?.known ? (
                        <span className="font-medium text-emerald-700 dark:text-emerald-400">
                          {facility.hours.text}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Opening hours unknown</span>
                      )}
                    </span>
                  </div>

                  {/* Phone */}
                  <div className="flex items-center gap-2">
                    <PhoneCall className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>
                      {facility.phone ? (
                        <span className="font-mono">{facility.phone}</span>
                      ) : (
                        <span className="text-slate-400 italic">No phone number available</span>
                      )}
                      {facility.phoneVerified && (
                        <span className="ml-1.5 text-[10px] text-teal-600 font-semibold">✓ Verified</span>
                      )}
                    </span>
                  </div>

                  {/* Services / Capabilities */}
                  {facility.services && facility.services.length > 0 && (
                    <div className="pt-1">
                      <div className="flex flex-wrap gap-1">
                        {facility.services.slice(0, 3).map((srv, idx) => (
                          <span
                            key={idx}
                            className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          >
                            {srv}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>

                <CardFooter className="pt-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 w-full">
                    {facility.phone ? (
                      <a
                        href={`tel:${facility.phone}`}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-700 transition"
                      >
                        <PhoneCall className="h-3.5 w-3.5" />
                        <span>Call</span>
                      </a>
                    ) : null}

                    <a
                      href={directionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 transition"
                    >
                      <Navigation className="h-3.5 w-3.5 text-teal-600" />
                      <span>Directions</span>
                    </a>
                  </div>
                </CardFooter>

                {/* Source Provenance Footer */}
                <div className="px-6 pb-3 text-[10px] text-slate-400 flex items-center justify-between">
                  <span>Source: {facility.source}</span>
                  {facility.lastVerifiedAt && (
                    <span>Verified: {new Date(facility.lastVerifiedAt).toLocaleDateString()}</span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
