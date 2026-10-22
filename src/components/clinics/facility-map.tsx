"use client";

import * as React from "react";
import {
  MapPin,
  Navigation,
  PhoneCall,
  ExternalLink,
  Plus,
  Minus,
  RotateCcw,
  Building2,
  Stethoscope,
  Pill,
  ShieldAlert,
  Info,
} from "lucide-react";
import { NormalizedFacility, FacilityType } from "@/lib/healthcare-places/types";
import { formatStraightLineDistance } from "@/lib/healthcare-places/distance";

interface FacilityMapProps {
  facilities: NormalizedFacility[];
  center: { lat: number; lng: number };
  radiusMeters: number;
  selectedFacilityId?: string | null;
  onSelectFacility?: (facility: NormalizedFacility) => void;
  onOpenDetails?: (facility: NormalizedFacility) => void;
}

export function FacilityMap({
  facilities,
  center,
  radiusMeters,
  selectedFacilityId,
  onSelectFacility,
  onOpenDetails,
}: FacilityMapProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = React.useState<number>(() => {
    if (radiusMeters <= 2000) return 14;
    if (radiusMeters <= 6000) return 13;
    if (radiusMeters <= 12000) return 12;
    return 11;
  });

  const [panOffset, setPanOffset] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const dragStart = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [activePopupFacility, setActivePopupFacility] = React.useState<NormalizedFacility | null>(null);

  // Update zoom when radius changes
  React.useEffect(() => {
    if (radiusMeters <= 2000) setZoom(14);
    else if (radiusMeters <= 6000) setZoom(13);
    else if (radiusMeters <= 12000) setZoom(12);
    else setZoom(11);
    setPanOffset({ x: 0, y: 0 });
  }, [radiusMeters]);

  // Sync selected facility from parent
  React.useEffect(() => {
    if (selectedFacilityId) {
      const match = facilities.find((f) => f.id === selectedFacilityId);
      if (match) {
        setActivePopupFacility(match);
      }
    }
  }, [selectedFacilityId, facilities]);

  // Coordinate projection from (lat, lng) to pixel offset relative to map center
  const projectToPixels = React.useCallback(
    (lat: number, lng: number, width: number, height: number) => {
      // Standard Web Mercator projection formulas
      const latRad = (lat * Math.PI) / 180;
      const centerLatRad = (center.lat * Math.PI) / 180;

      const scale = (256 * Math.pow(2, zoom)) / (2 * Math.PI);

      const x = (lng - center.lng) * (Math.PI / 180) * scale;
      const y =
        (Math.log(Math.tan(Math.PI / 4 + centerLatRad / 2)) -
          Math.log(Math.tan(Math.PI / 4 + latRad / 2))) *
        scale;

      return {
        left: width / 2 + x + panOffset.x,
        top: height / 2 + y + panOffset.y,
      };
    },
    [center, zoom, panOffset]
  );

  // Mouse pan drag handlers
  function handleMouseDown(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest(".map-interactive-control")) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  }

  function handleMouseUp() {
    setIsDragging(false);
  }

  function handleResetView() {
    setPanOffset({ x: 0, y: 0 });
    if (radiusMeters <= 2000) setZoom(14);
    else if (radiusMeters <= 6000) setZoom(13);
    else if (radiusMeters <= 12000) setZoom(12);
    else setZoom(11);
    setActivePopupFacility(null);
  }

  // Facility pin colors & icons
  function getMarkerDetails(type: FacilityType) {
    switch (type) {
      case "emergency_department":
        return {
          bg: "bg-red-600",
          border: "border-red-400",
          text: "text-red-400",
          ring: "ring-red-500/50",
          label: "Emergency",
          Icon: ShieldAlert,
        };
      case "hospital":
        return {
          bg: "bg-blue-600",
          border: "border-blue-400",
          text: "text-blue-400",
          ring: "ring-blue-500/50",
          label: "Hospital",
          Icon: Building2,
        };
      case "pharmacy":
        return {
          bg: "bg-amber-600",
          border: "border-amber-400",
          text: "text-amber-400",
          ring: "ring-amber-500/50",
          label: "Pharmacy",
          Icon: Pill,
        };
      case "specialist":
        return {
          bg: "bg-purple-600",
          border: "border-purple-400",
          text: "text-purple-400",
          ring: "ring-purple-500/50",
          label: "Specialist",
          Icon: Stethoscope,
        };
      case "clinic":
      default:
        return {
          bg: "bg-teal-600",
          border: "border-teal-400",
          text: "text-teal-400",
          ring: "ring-teal-500/50",
          label: "Clinic",
          Icon: Stethoscope,
        };
    }
  }

  // Radius circle approximate pixel radius
  const radiusPixelRadius = React.useMemo(() => {
    // 1 degree latitude ~= 111,000 meters
    const metersPerPixel = (156543.03392 * Math.cos((center.lat * Math.PI) / 180)) / Math.pow(2, zoom);
    return Math.max(radiusMeters / metersPerPixel, 20);
  }, [center.lat, zoom, radiusMeters]);

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className={`relative w-full h-[520px] rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden select-none cursor-${
        isDragging ? "grabbing" : "grab"
      }`}
      aria-label="Interactive healthcare facility map"
    >
      {/* Dark Theme Grid Base */}
      <div className="absolute inset-0 bg-radial from-zinc-900 to-zinc-950 opacity-90" />
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="dark-map-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#3f3f46" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dark-map-grid)" />
      </svg>

      {/* Search Radius Ring around Center */}
      <div
        style={{
          left: `calc(50% + ${panOffset.x}px)`,
          top: `calc(50% + ${panOffset.y}px)`,
          width: `${radiusPixelRadius * 2}px`,
          height: `${radiusPixelRadius * 2}px`,
          transform: "translate(-50%, -50%)",
        }}
        className="absolute pointer-events-none rounded-full border border-teal-500/30 bg-teal-500/5 transition-all duration-300"
      >
        <div className="absolute right-2 top-2 text-[10px] font-mono text-teal-400/80 bg-zinc-950/80 px-1.5 py-0.5 rounded border border-teal-500/20">
          Radius: {(radiusMeters / 1000).toFixed(0)} km
        </div>
      </div>

      {/* User Search Center Marker */}
      <div
        style={{
          left: `calc(50% + ${panOffset.x}px)`,
          top: `calc(50% + ${panOffset.y}px)`,
          transform: "translate(-50%, -50%)",
        }}
        className="absolute pointer-events-none z-10 flex flex-col items-center"
      >
        <div className="relative flex h-6 w-6 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-60" />
          <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-teal-500 border-2 border-white shadow-lg" />
        </div>
        <span className="mt-1 rounded-md bg-zinc-900/95 border border-zinc-700/80 px-2 py-0.5 text-[10px] font-bold text-teal-300 shadow-md">
          Search Center
        </span>
      </div>

      {/* Facility Pins */}
      {facilities.map((fac) => {
        const marker = getMarkerDetails(fac.facilityType);
        const MarkerIcon = marker.Icon;
        const isSelected = fac.id === activePopupFacility?.id || fac.id === selectedFacilityId;

        // Container dimensions fallback for pixel projection
        const containerWidth = containerRef.current?.clientWidth || 800;
        const containerHeight = containerRef.current?.clientHeight || 520;
        const coords = projectToPixels(fac.latitude, fac.longitude, containerWidth, containerHeight);

        return (
          <div
            key={fac.id}
            style={{
              left: `${coords.left}px`,
              top: `${coords.top}px`,
              transform: "translate(-50%, -100%)",
            }}
            className={`map-interactive-control absolute z-20 transition-transform ${
              isSelected ? "scale-125 z-30" : "hover:scale-110"
            }`}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActivePopupFacility(fac);
                onSelectFacility?.(fac);
              }}
              title={`${fac.name} (${marker.label})`}
              className={`group flex items-center justify-center h-8 w-8 rounded-full shadow-xl border-2 ${
                marker.bg
              } ${marker.border} text-white transition-all cursor-pointer ${
                isSelected ? `ring-4 ${marker.ring} animate-pulse` : ""
              }`}
            >
              <MarkerIcon className="h-4 w-4" />
            </button>
            <div className="w-1.5 h-1.5 bg-zinc-900 mx-auto rotate-45 -mt-1 border-r border-b border-zinc-700" />
          </div>
        );
      })}

      {/* Active Marker Info Popup */}
      {activePopupFacility && (
        <div
          className="map-interactive-control absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-40 rounded-xl border border-zinc-700 bg-zinc-950/95 p-4 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-2 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-2">
            <span
              className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                getMarkerDetails(activePopupFacility.facilityType).text
              } bg-zinc-900 border border-zinc-800`}
            >
              {getMarkerDetails(activePopupFacility.facilityType).label}
            </span>
            <button
              type="button"
              onClick={() => setActivePopupFacility(null)}
              className="text-zinc-500 hover:text-white text-xs font-bold px-1"
            >
              ✕
            </button>
          </div>

          <h4 className="mt-1 text-sm font-bold text-white leading-tight">
            {activePopupFacility.name}
          </h4>

          {activePopupFacility.distanceMeters !== undefined && (
            <p className="mt-1 text-[11px] font-semibold text-teal-400 flex items-center gap-1">
              <Navigation className="h-3 w-3" />
              <span>{formatStraightLineDistance(activePopupFacility.distanceMeters)}</span>
            </p>
          )}

          {activePopupFacility.formattedAddress && (
            <p className="mt-1 text-[11px] text-zinc-400 line-clamp-2">
              {activePopupFacility.formattedAddress}
            </p>
          )}

          <div className="mt-3 flex items-center gap-2 pt-2 border-t border-zinc-800">
            {activePopupFacility.phoneNumber && (
              <a
                href={`tel:${activePopupFacility.phoneNumber}`}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-teal-600 hover:bg-teal-500 text-white py-1.5 text-xs font-bold transition"
              >
                <PhoneCall className="h-3 w-3" />
                <span>Call</span>
              </a>
            )}

            <a
              href={activePopupFacility.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white py-1.5 text-xs font-bold transition"
            >
              <Navigation className="h-3 w-3" />
              <span>Directions</span>
            </a>

            <button
              type="button"
              onClick={() => {
                onOpenDetails?.(activePopupFacility);
              }}
              className="rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:text-white transition cursor-pointer"
            >
              Details
            </button>
          </div>
        </div>
      )}

      {/* Floating Map Controls (+ / - / Reset) */}
      <div className="map-interactive-control absolute top-4 right-4 z-30 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(z + 1, 16))}
          title="Zoom in"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900/90 border border-zinc-700/80 text-zinc-200 hover:bg-zinc-800 hover:text-white shadow-lg transition cursor-pointer"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(z - 1, 9))}
          title="Zoom out"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900/90 border border-zinc-700/80 text-zinc-200 hover:bg-zinc-800 hover:text-white shadow-lg transition cursor-pointer"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleResetView}
          title="Recenter map"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900/90 border border-zinc-700/80 text-zinc-200 hover:bg-zinc-800 hover:text-white shadow-lg transition cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Map Attribution & Distance Guidance Banner */}
      <div className="map-interactive-control absolute bottom-2 left-2 z-10 hidden sm:flex items-center gap-1.5 text-[10px] text-zinc-500 bg-zinc-950/80 px-2 py-1 rounded border border-zinc-800/80">
        <Info className="h-3 w-3 text-teal-400" />
        <span>Distances are approximate straight-line estimates. Use Directions for live routing.</span>
      </div>

      {/* External Map Action Pill */}
      <div className="map-interactive-control absolute top-4 left-4 z-30">
        <a
          href={`https://www.google.com/maps/search/hospitals+clinics/@${center.lat},${center.lng},13z`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900/90 border border-zinc-700/80 px-3 py-1.5 text-[11px] font-semibold text-zinc-200 hover:bg-zinc-800 hover:text-white shadow-lg transition"
        >
          <span>Open Full Area Map</span>
          <ExternalLink className="h-3 w-3 text-zinc-400" />
        </a>
      </div>

      {/* Accessible Screen-Reader Summary */}
      <div className="sr-only">
        <h5>Healthcare Facility Pins</h5>
        <ul>
          {facilities.map((f) => (
            <li key={f.id}>
              {f.name} ({f.facilityType}), located at {f.formattedAddress}, approximately{" "}
              {formatStraightLineDistance(f.distanceMeters)}.
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
