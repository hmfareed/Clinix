"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
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
  LayoutList,
  Map as MapIcon,
  Columns2,
  RotateCcw,
  SlidersHorizontal,
  ChevronRight,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NormalizedFacility, FacilityType } from "@/lib/healthcare-places/types";
import { formatStraightLineDistance } from "@/lib/healthcare-places/distance";
import { FacilityMap } from "@/components/clinics/facility-map";
import { FacilityDetailsModal } from "@/components/clinics/facility-details-modal";

const GHANA_POPULAR_TOWNS = [
  { name: "Accra (Central)", query: "Accra", lat: 5.556, lng: -0.1969 },
  { name: "Osu / Ridge", query: "Osu", lat: 5.5565, lng: -0.1818 },
  { name: "East Legon", query: "East Legon", lat: 5.6358, lng: -0.1601 },
  { name: "Kumasi", query: "Kumasi", lat: 6.6885, lng: -1.6244 },
  { name: "Tamale", query: "Tamale", lat: 9.4008, lng: -0.8393 },
  { name: "Takoradi", query: "Takoradi", lat: 4.8873, lng: -1.7554 },
  { name: "Tema", query: "Tema", lat: 5.6698, lng: -0.0166 },
  { name: "Cape Coast", query: "Cape Coast", lat: 5.1054, lng: -1.2466 },
];

const RADIUS_OPTIONS = [
  { label: "1 km", value: 1000 },
  { label: "5 km", value: 5000 },
  { label: "10 km", value: 10000 },
  { label: "25 km", value: 25000 },
];

function FindClinicContent() {
  const searchParams = useSearchParams();

  // State
  const [facilities, setFacilities] = React.useState<NormalizedFacility[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [errorState, setErrorState] = React.useState<{ message: string; safeAction?: string; externalUrl?: string } | null>(null);

  // Search Controls
  const [locationQuery, setLocationQuery] = React.useState(() => searchParams.get("area") || "Accra");
  const [keywordQuery, setKeywordQuery] = React.useState(() => searchParams.get("q") || "");
  const [centerCoords, setCenterCoords] = React.useState<{ lat: number; lng: number }>({
    lat: 5.556,
    lng: -0.1969,
  });
  const [locationLabel, setLocationLabel] = React.useState("Accra, Greater Accra Region");

  const [selectedType, setSelectedType] = React.useState<FacilityType | "all">(() => {
    const t = searchParams.get("type");
    if (t === "emergency_department" || t === "hospital" || t === "clinic" || t === "pharmacy" || t === "specialist") {
      return t;
    }
    return "all";
  });

  const [selectedRadius, setSelectedRadius] = React.useState<number>(5000);
  const [sortBy, setSortBy] = React.useState<"distance" | "name">("distance");
  const [viewLayout, setViewLayout] = React.useState<"split" | "list" | "map">("split");

  // Geolocation
  const [geolocating, setGeolocating] = React.useState(false);
  const [locationPermissionState, setLocationPermissionState] = React.useState<"prompt" | "granted" | "denied">("prompt");
  const [locationAccuracy, setLocationAccuracy] = React.useState<number | null>(null);
  const [locationTimestamp, setLocationTimestamp] = React.useState<number | null>(null);
  const [rememberArea, setRememberArea] = React.useState(false);

  // Selected facility for map focus & details modal
  const [selectedFacilityId, setSelectedFacilityId] = React.useState<string | null>(null);
  const [modalFacility, setModalFacility] = React.useState<NormalizedFacility | null>(null);

  // Load remembered area if present in localStorage
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("clinix_saved_search_area");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.lat && parsed.lng && parsed.label) {
          setCenterCoords({ lat: parsed.lat, lng: parsed.lng });
          setLocationLabel(parsed.label);
          setLocationQuery(parsed.label);
          setRememberArea(true);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Primary search function using unified backend endpoint
  const executeSearch = React.useCallback(
    async (
      coords: { lat: number; lng: number },
      radius: number,
      type: FacilityType | "all",
      kw?: string
    ) => {
      setLoading(true);
      setErrorState(null);

      try {
        const res = await fetch("/api/v1/healthcare/nearby", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: coords.lat,
            longitude: coords.lng,
            radiusMeters: radius,
            facilityTypes: type === "all" ? undefined : type,
            query: kw?.trim() || undefined,
            limit: 30,
          }),
        });

        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || "Could not retrieve facility directory.");
        }

        const returned: NormalizedFacility[] = json.data || [];
        setFacilities(returned);

        // If a specific facility was linked in query, open details
        const initialFacilityId = searchParams.get("facilityId");
        if (initialFacilityId) {
          const match = returned.find((f) => f.id === initialFacilityId);
          if (match) {
            setSelectedFacilityId(match.id);
            setModalFacility(match);
          }
        }
      } catch (err: unknown) {
        console.error("[FIND CLINIC SEARCH ERROR]", err);
        setErrorState({
          message: err instanceof Error ? err.message : "Healthcare facility search is temporarily degraded.",
          safeAction: "If you have an acute emergency, dial 112 immediately.",
          externalUrl: `https://www.google.com/maps/search/hospital+near+me/@${coords.lat},${coords.lng},13z`,
        });
        setFacilities([]);
      } finally {
        setLoading(false);
      }
    },
    [searchParams]
  );

  // Trigger search when parameters change
  React.useEffect(() => {
    executeSearch(centerCoords, selectedRadius, selectedType, keywordQuery);
  }, [executeSearch, centerCoords, selectedRadius, selectedType]);

  // Handle Location Geocoding on Manual Form Submit
  async function handleManualSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = locationQuery.trim();
    if (!q) return;

    setLoading(true);
    setErrorState(null);

    try {
      const geoRes = await fetch("/api/v1/healthcare/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });

      const geoJson = await geoRes.json();
      if (!geoRes.ok || !geoJson.success) {
        throw new Error(
          geoJson.error?.message || `Could not resolve area "${q}". Please choose a major town or enter your suburb.`
        );
      }

      const newCoords = {
        lat: geoJson.data.latitude,
        lng: geoJson.data.longitude,
      };

      setCenterCoords(newCoords);
      setLocationLabel(geoJson.data.displayName);

      if (rememberArea) {
        try {
          localStorage.setItem(
            "clinix_saved_search_area",
            JSON.stringify({
              lat: newCoords.lat,
              lng: newCoords.lng,
              label: geoJson.data.displayName,
            })
          );
        } catch {
          // Ignore
        }
      }

      await executeSearch(newCoords, selectedRadius, selectedType, keywordQuery);
    } catch (err: unknown) {
      setErrorState({
        message: err instanceof Error ? err.message : "Geocoding failed.",
        safeAction: "You can select one of the popular regions below.",
      });
      setLoading(false);
    }
  }

  // Handle Browser Geolocation with high accuracy and fallback
  function handleUseMyLocation() {
    if (typeof window === "undefined" || !navigator.geolocation) {
      alert("Geolocation is not supported by your browser. Please search by town or area manually.");
      return;
    }

    setGeolocating(true);
    setErrorState(null);
    setFacilities([]);
    setLoading(true);

    const onLocationSuccess = (pos: GeolocationPosition) => {
      setGeolocating(false);
      setLocationPermissionState("granted");

      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const accuracy = Math.round(pos.coords.accuracy);
      const timestamp = pos.timestamp;

      setLocationAccuracy(accuracy);
      setLocationTimestamp(timestamp);

      const coords = { lat, lng };
      setCenterCoords(coords);

      let label = "Your Current Location";
      if (accuracy <= 100) {
        label = `Your Current Location (GPS ±${accuracy}m)`;
      } else if (accuracy <= 1000) {
        label = `Your Current Location (±${accuracy}m)`;
      } else {
        label = `Your Current Location (Network ±${(accuracy / 1000).toFixed(1)} km)`;
      }

      setLocationLabel(label);
      setLocationQuery("Current Device Location");
      executeSearch(coords, selectedRadius, selectedType, keywordQuery);
    };

    const onLocationError = (err: GeolocationPositionError) => {
      setGeolocating(false);
      setLoading(false);
      if (err.code === err.PERMISSION_DENIED) {
        setLocationPermissionState("denied");
      } else if (err.code === err.TIMEOUT) {
        setErrorState({
          message: "Location request timed out waiting for device coordinates.",
          safeAction: "Please enter your suburb, town, or landmark manually above.",
        });
      } else {
        setErrorState({
          message: "Unable to retrieve device coordinates from your browser.",
          safeAction: "Please enter your area or town manually in the search box.",
        });
      }
    };

    // First attempt GPS / high accuracy
    navigator.geolocation.getCurrentPosition(
      onLocationSuccess,
      (err) => {
        // If high accuracy timed out, retry once with standard network positioning
        if (err.code === err.TIMEOUT) {
          navigator.geolocation.getCurrentPosition(
            onLocationSuccess,
            onLocationError,
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 }
          );
        } else {
          onLocationError(err);
        }
      },
      { timeout: 10000, enableHighAccuracy: true, maximumAge: 0 }
    );
  }

  // Handle Quick Town Select
  function handleSelectTown(town: (typeof GHANA_POPULAR_TOWNS)[0]) {
    setLocationQuery(town.name);
    setLocationLabel(town.name);
    const coords = { lat: town.lat, lng: town.lng };
    setCenterCoords(coords);
    executeSearch(coords, selectedRadius, selectedType, keywordQuery);
  }

  // Handle Remember Area Checkbox change
  function handleRememberAreaChange(checked: boolean) {
    setRememberArea(checked);
    if (!checked) {
      try {
        localStorage.removeItem("clinix_saved_search_area");
      } catch {
        // Ignore
      }
    } else if (centerCoords && locationLabel) {
      try {
        localStorage.setItem(
          "clinix_saved_search_area",
          JSON.stringify({
            lat: centerCoords.lat,
            lng: centerCoords.lng,
            label: locationLabel,
          })
        );
      } catch {
        // Ignore
      }
    }
  }

  // Sorted facilities
  const sortedFacilities = React.useMemo(() => {
    const list = [...facilities];
    if (sortBy === "distance") {
      list.sort((a, b) => (a.distanceMeters ?? 999999) - (b.distanceMeters ?? 999999));
    } else if (sortBy === "name") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [facilities, sortBy]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 text-zinc-100">
      {/* Emergency Fast-Call Header */}
      <div className="mb-8 rounded-xl border border-red-900/60 bg-red-950/40 p-4 text-xs shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <PhoneCall className="h-4 w-4 text-red-500 animate-pulse shrink-0" />
            <span className="font-semibold text-red-200">
              Immediate Medical Emergency? Call the Ghana National Ambulance Service directly.
            </span>
          </div>
          <a
            href="tel:112"
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-1.5 font-bold text-white shadow-sm hover:bg-red-500 transition cursor-pointer shrink-0"
          >
            <span>Call 112 Immediately</span>
          </a>
        </div>
      </div>

      {/* Main Title Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-teal-500/30 bg-teal-950/60 px-3 py-1 text-xs font-semibold text-teal-300 mb-2">
          <MapPin className="h-3.5 w-3.5 text-teal-400" />
          <span>Verified Healthcare Discovery</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Find Healthcare Facilities
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Discover verified hospitals, emergency departments, clinics, pharmacies, and specialist facilities near
          you.
        </p>
      </div>

      {/* Unified Search Control Panel */}
      <Card className="mb-8 border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-sm">
        <CardContent className="p-4 sm:p-6 space-y-4">
          {/* Location & Specialty Search Row */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Manual Location Input */}
            <form onSubmit={handleManualSearchSubmit} className="md:col-span-6 flex items-center gap-2">
              <div className="relative flex-1">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                <Input
                  type="text"
                  placeholder="Enter city, suburb, or landmark in Ghana (e.g. Accra, Kumasi, Osu)..."
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  className="pl-9 bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-teal-500"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="bg-teal-600 hover:bg-teal-500 text-white font-semibold cursor-pointer shrink-0"
              >
                Search Area
              </Button>
            </form>

            {/* Keyword / Specialty Filter Input */}
            <div className="md:col-span-4 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
              <Input
                type="text"
                placeholder="Search facility name or specialty (e.g. Cardiology, Eye)..."
                value={keywordQuery}
                onChange={(e) => setKeywordQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    executeSearch(centerCoords, selectedRadius, selectedType, keywordQuery);
                  }
                }}
                className="pl-9 bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-teal-500"
              />
            </div>

            {/* Geolocation Button */}
            <div className="md:col-span-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleUseMyLocation}
                disabled={geolocating}
                className="w-full flex items-center justify-center gap-2 text-xs border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 cursor-pointer h-10"
              >
                <Navigation className="h-4 w-4 text-teal-400" />
                <span>{geolocating ? "Locating..." : "Use My Location"}</span>
              </Button>
            </div>
          </div>

          {/* Permission Denied Notice */}
          {locationPermissionState === "denied" && (
            <div className="rounded-lg bg-amber-950/40 border border-amber-800/60 p-2.5 text-xs text-amber-300 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
              <span>
                Location access was denied in your browser. You can select your town or search manually below.
              </span>
            </div>
          )}

          {/* Coarse Location Accuracy Notice */}
          {locationAccuracy !== null && locationAccuracy > 1500 && (
            <div className="rounded-lg bg-blue-950/40 border border-blue-800/60 p-2.5 text-xs text-blue-300 flex items-start gap-2">
              <Info className="h-4 w-4 shrink-0 text-blue-400 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold">
                  Device coordinates are approximate (±{(locationAccuracy / 1000).toFixed(1)} km from cell/network tower).
                </p>
                <p className="text-[11px] text-blue-300/80">
                  If you are looking for local walk-in clinics in your immediate neighborhood, try entering your suburb or landmark in the search box above.
                </p>
              </div>
            </div>
          )}

          {/* Quick Town Selectors & Remember Consent */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-800/80 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-zinc-400 font-medium mr-1">Popular Regions:</span>
              {GHANA_POPULAR_TOWNS.map((t) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => handleSelectTown(t)}
                  className="rounded-full bg-zinc-900 border border-zinc-800 px-3 py-1 text-xs font-medium text-zinc-300 hover:bg-teal-950/70 hover:border-teal-700/60 hover:text-teal-300 transition cursor-pointer"
                >
                  {t.name}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 text-zinc-400 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberArea}
                onChange={(e) => handleRememberAreaChange(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-900 text-teal-500 focus:ring-teal-500"
              />
              <span>Remember this search area on this device</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Filter Tabs & Radius / Layout Bar */}
      <div className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Facility Type Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { key: "all", label: "All Facilities", icon: Building2 },
            { key: "hospital", label: "Hospitals", icon: Building2 },
            { key: "clinic", label: "Clinics", icon: Stethoscope },
            { key: "pharmacy", label: "Pharmacies", icon: Pill },
            { key: "specialist", label: "Specialists", icon: Stethoscope },
            { key: "emergency_department", label: "Emergency", icon: ShieldAlert },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedType(key as FacilityType | "all")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                selectedType === key
                  ? "bg-teal-600 text-white shadow-sm"
                  : "bg-zinc-900 text-zinc-300 border border-zinc-800 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Secondary Controls: Radius, Sort & Layout Switch */}
        <div className="flex flex-wrap items-center gap-3 text-xs w-full md:w-auto justify-between md:justify-end">
          {/* Radius Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Radius:</span>
            <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
              {RADIUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSelectedRadius(opt.value)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                    selectedRadius === opt.value
                      ? "bg-zinc-700 text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "distance" | "name")}
              aria-label="Sort facilities by"
              className="rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-1 text-xs text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-teal-500 cursor-pointer"
            >
              <option value="distance">Proximity (Closest First)</option>
              <option value="name">Facility Name (A-Z)</option>
            </select>
          </div>

          {/* View Layout Toggle */}
          <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
            <button
              type="button"
              onClick={() => setViewLayout("split")}
              title="Split view (Map & List)"
              className={`rounded-md px-2 py-1 transition cursor-pointer ${
                viewLayout === "split" ? "bg-teal-600 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              <Columns2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewLayout("list")}
              title="List view only"
              className={`rounded-md px-2 py-1 transition cursor-pointer ${
                viewLayout === "list" ? "bg-teal-600 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              <LayoutList className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewLayout("map")}
              title="Map view only"
              className={`rounded-md px-2 py-1 transition cursor-pointer ${
                viewLayout === "map" ? "bg-teal-600 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              <MapIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Results Header Indicator */}
      <div className="mb-4 flex items-center justify-between text-xs text-zinc-400 border-b border-zinc-800/60 pb-2">
        <div>
          Showing <strong className="text-white">{sortedFacilities.length}</strong> verified facilities within{" "}
          <strong className="text-white">{(selectedRadius / 1000).toFixed(0)} km</strong> of{" "}
          <strong className="text-teal-400">{locationLabel}</strong>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-zinc-500 text-[11px]">
          <Info className="h-3.5 w-3.5 text-zinc-400" />
          <span>Straight-line distance shown. Driving routes may vary.</span>
        </div>
      </div>

      {/* ERROR STATE */}
      {errorState && (
        <Card className="mb-8 border-red-900/60 bg-red-950/30 text-zinc-100">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 text-red-500 shrink-0" />
              <div className="space-y-2">
                <h3 className="text-base font-bold text-red-200">{errorState.message}</h3>
                {errorState.safeAction && <p className="text-xs text-red-300">{errorState.safeAction}</p>}
                <div className="flex items-center gap-3 pt-1">
                  <Button
                    type="button"
                    onClick={() => executeSearch(centerCoords, selectedRadius, selectedType, keywordQuery)}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3 mr-1.5" />
                    Retry Search
                  </Button>
                  {errorState.externalUrl && (
                    <a
                      href={errorState.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-400 underline hover:text-teal-300"
                    >
                      <span>Search on Google Maps</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* MAIN CONTENT AREA */}
      {loading ? (
        <div className="flex min-h-[350px] flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
          <p className="text-xs text-zinc-400 font-medium">Searching verified healthcare facilities...</p>
        </div>
      ) : sortedFacilities.length === 0 ? (
        <Card className="p-8 text-center border-zinc-800 bg-zinc-950 text-zinc-400">
          <Building2 className="mx-auto h-12 w-12 text-zinc-600 mb-3" />
          <h3 className="text-base font-bold text-zinc-200">No healthcare facilities found matching your criteria.</h3>
          <p className="mt-1 text-xs text-zinc-400 max-w-md mx-auto">
            Try expanding your search radius to 10 km or 25 km, selecting &quot;All Facilities&quot;, or searching another town.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              onClick={() => setSelectedRadius(25000)}
              className="bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold cursor-pointer"
            >
              Expand to 25 km
            </Button>
            <Button
              type="button"
              onClick={() => {
                setSelectedType("all");
                setKeywordQuery("");
              }}
              variant="outline"
              className="border-zinc-800 bg-zinc-900 text-zinc-300 text-xs font-semibold cursor-pointer"
            >
              Reset Filters
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Layout Mode: Split (Side-by-Side), List only, or Map only */}
          <div
            className={
              viewLayout === "split"
                ? "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
                : viewLayout === "map"
                ? "w-full"
                : "w-full"
            }
          >
            {/* Interactive Map Pane (Displayed in 'split' or 'map' layout) */}
            {(viewLayout === "split" || viewLayout === "map") && (
              <div
                className={
                  viewLayout === "split"
                    ? "lg:col-span-5 lg:sticky lg:top-20 order-2 lg:order-1"
                    : "w-full mb-6"
                }
              >
                <FacilityMap
                  facilities={sortedFacilities}
                  center={centerCoords}
                  radiusMeters={selectedRadius}
                  selectedFacilityId={selectedFacilityId}
                  onSelectFacility={(fac) => {
                    setSelectedFacilityId(fac.id);
                  }}
                  onOpenDetails={(fac) => {
                    setModalFacility(fac);
                  }}
                />
              </div>
            )}

            {/* Facility Cards Pane (Displayed in 'split' or 'list' layout) */}
            {(viewLayout === "split" || viewLayout === "list") && (
              <div
                className={
                  viewLayout === "split"
                    ? "lg:col-span-7 order-1 lg:order-2 space-y-4"
                    : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                }
              >
                {sortedFacilities.map((facility) => {
                  const isSelected = facility.id === selectedFacilityId;

                  return (
                    <Card
                      key={facility.id}
                      className={`flex flex-col justify-between shadow-sm transition border bg-zinc-950 text-zinc-100 ${
                        isSelected
                          ? "border-teal-500 ring-2 ring-teal-500/30"
                          : "border-zinc-800/80 hover:border-zinc-700"
                      }`}
                    >
                      <CardHeader className="pb-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <Badge
                            variant={
                              facility.facilityType === "emergency_department"
                                ? "destructive"
                                : facility.facilityType === "hospital"
                                ? "default"
                                : facility.facilityType === "specialist"
                                ? "outline"
                                : "secondary"
                            }
                            className="capitalize text-[10px]"
                          >
                            {facility.facilityType.replace("_", " ")}
                          </Badge>

                          {facility.distanceMeters !== undefined && (
                            <span
                              title="Approximate straight-line distance. Driving distance and travel time may vary based on route."
                              className="text-xs font-bold text-teal-400 flex items-center gap-1 bg-teal-950/60 border border-teal-800/60 px-2 py-0.5 rounded"
                            >
                              <Navigation className="h-3 w-3" />
                              {formatStraightLineDistance(facility.distanceMeters)}
                            </span>
                          )}
                        </div>

                        <CardTitle className="text-base font-bold text-white mt-2 leading-snug">
                          {facility.name}
                        </CardTitle>

                        {facility.formattedAddress && (
                          <CardDescription className="text-xs flex items-start gap-1.5 mt-1 text-zinc-400">
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-zinc-500 mt-0.5" />
                            <span className="line-clamp-2">{facility.formattedAddress}</span>
                          </CardDescription>
                        )}
                      </CardHeader>

                      <CardContent className="space-y-2 text-xs text-zinc-300 py-2.5 border-y border-zinc-800/80">
                        {/* Hours */}
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                          <span>
                            {facility.openNow !== undefined && facility.openNow !== null ? (
                              <span
                                className={`font-semibold mr-1.5 ${
                                  facility.openNow ? "text-emerald-400" : "text-amber-400"
                                }`}
                              >
                                {facility.openNow ? "• Open Now" : "• Currently Closed"}
                              </span>
                            ) : null}
                            {facility.openingHours ? (
                              <span className="text-zinc-300">{facility.openingHours}</span>
                            ) : (
                              <span className="text-zinc-500 italic">Opening hours unknown</span>
                            )}
                          </span>
                        </div>

                        {/* Phone */}
                        <div className="flex items-center gap-2">
                          <PhoneCall className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                          <span>
                            {facility.phoneNumber ? (
                              <span className="font-mono text-zinc-200">{facility.phoneNumber}</span>
                            ) : (
                              <span className="text-zinc-500 italic">No phone number available</span>
                            )}
                            {facility.phoneVerified && (
                              <span className="ml-1.5 text-[10px] text-teal-400 font-semibold">✓ Verified</span>
                            )}
                          </span>
                        </div>

                        {/* Services / Specialties */}
                        {facility.services && facility.services.length > 0 && (
                          <div className="pt-1 flex flex-wrap gap-1">
                            {facility.services.slice(0, 3).map((srv, idx) => (
                              <span
                                key={idx}
                                className="rounded bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400"
                              >
                                {srv}
                              </span>
                            ))}
                            {facility.services.length > 3 && (
                              <span className="text-[10px] text-zinc-500 pt-0.5">
                                +{facility.services.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </CardContent>

                      <CardFooter className="pt-3 pb-2 flex flex-col gap-2">
                        {/* Primary Action Buttons */}
                        <div className="flex items-center gap-2 w-full">
                          {facility.phoneNumber && (
                            <a
                              href={`tel:${facility.phoneNumber}`}
                              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-teal-500 transition cursor-pointer"
                            >
                              <PhoneCall className="h-3.5 w-3.5" />
                              <span>Call</span>
                            </a>
                          )}

                          <a
                            href={facility.mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-bold text-zinc-200 shadow-xs hover:bg-zinc-800 hover:text-white transition cursor-pointer"
                          >
                            <Navigation className="h-3.5 w-3.5 text-teal-400" />
                            <span>Directions</span>
                          </a>

                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                              setSelectedFacilityId(facility.id);
                              setModalFacility(facility);
                            }}
                            className="text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 px-2.5 py-1.5 cursor-pointer"
                          >
                            Details
                          </Button>
                        </div>

                        {/* Provenance Footer */}
                        <div className="w-full pt-1 text-[10px] text-zinc-500 flex items-center justify-between">
                          <span>Source: {facility.provider}</span>
                          {facility.lastVerifiedAt && (
                            <span>Verified: {new Date(facility.lastVerifiedAt).toLocaleDateString()}</span>
                          )}
                        </div>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Facility Details Modal / Drawer */}
      <FacilityDetailsModal facility={modalFacility} onClose={() => setModalFacility(null)} />
    </div>
  );
}

export default function ClinicsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
        </div>
      }
    >
      <FindClinicContent />
    </React.Suspense>
  );
}
