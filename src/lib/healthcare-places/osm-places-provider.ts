import {
  FacilityType,
  IHealthcarePlacesProvider,
  NearbySearchRequest,
  NormalizedFacility,
} from "./types";
import { calculateHaversineDistanceMeters } from "./distance";

interface OSMElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OSMElement[];
}

// In-memory cache for Overpass responses with 15-minute TTL to respect public server limits
const osmCache = new Map<string, { data: NormalizedFacility[]; expiry: number }>();

export class OpenStreetMapPlacesProvider implements IHealthcarePlacesProvider {
  public readonly name = "openstreetmap";
  private readonly overpassEndpoint: string;
  private readonly timeoutMs: number;

  constructor(
    overpassEndpoint = process.env.OVERPASS_API_ENDPOINT || "https://overpass-api.de/api/interpreter",
    timeoutMs = 5000
  ) {
    this.overpassEndpoint = overpassEndpoint;
    this.timeoutMs = timeoutMs;
  }

  async searchNearby(request: NearbySearchRequest): Promise<NormalizedFacility[]> {
    const { latitude, longitude, radiusMeters = 5000, facilityTypes, query, limit = 20 } = request;

    // In automated test environments without explicit live flag, bypass external network calls
    if (process.env.NODE_ENV === "test" && !process.env.ENABLE_LIVE_OSM_TESTS) {
      return [];
    }

    // Check cache (keyed by 2-decimal rounded lat/lng and radius)
    const cacheKey = `osm_${latitude.toFixed(2)}_${longitude.toFixed(2)}_${radiusMeters}_${JSON.stringify(
      facilityTypes || "all"
    )}`;
    const cached = osmCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
      return this.filterAndRank(cached.data, latitude, longitude, radiusMeters, query, limit);
    }

    // Map internal types to OSM amenity/healthcare tags
    const targetTypes = Array.isArray(facilityTypes)
      ? facilityTypes
      : facilityTypes && facilityTypes !== "all"
      ? [facilityTypes]
      : ["all"];

    const amenityFilters: string[] = [];
    if (targetTypes.includes("all")) {
      amenityFilters.push("hospital", "clinic", "pharmacy", "doctors");
    } else {
      if (targetTypes.includes("hospital") || targetTypes.includes("emergency_department")) {
        amenityFilters.push("hospital");
      }
      if (targetTypes.includes("clinic")) {
        amenityFilters.push("clinic", "doctors");
      }
      if (targetTypes.includes("pharmacy")) {
        amenityFilters.push("pharmacy");
      }
      if (targetTypes.includes("specialist")) {
        amenityFilters.push("clinic", "doctors", "hospital");
      }
    }

    const amenityRegex = amenityFilters.join("|");
    const radius = Math.min(Math.max(radiusMeters, 500), 25000);

    const overpassQuery = `[out:json][timeout:5];(node["amenity"~"${amenityRegex}"](around:${radius},${latitude},${longitude});way["amenity"~"${amenityRegex}"](around:${radius},${latitude},${longitude}););out center 30;`;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const res = await fetch(`${this.overpassEndpoint}?data=${encodeURIComponent(overpassQuery)}`, {
        method: "GET",
        headers: {
          "User-Agent": "ClinixHealthcareApp/1.0 (Ghana Healthcare Directory Search)",
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        return [];
      }

      const json: OverpassResponse = await res.json();
      if (!json.elements || !Array.isArray(json.elements)) {
        return [];
      }

      const facilities = this.normalizeElements(json.elements, latitude, longitude);

      // Cache raw results for 15 minutes
      osmCache.set(cacheKey, { data: facilities, expiry: Date.now() + 15 * 60 * 1000 });

      return this.filterAndRank(facilities, latitude, longitude, radiusMeters, query, limit);
    } catch {
      // Overpass failure must never break the search pipeline; return empty so primary/verified can serve
      return [];
    }
  }

  private normalizeElements(
    elements: OSMElement[],
    searchLat: number,
    searchLng: number
  ): NormalizedFacility[] {
    const results: NormalizedFacility[] = [];

    for (const el of elements) {
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      if (lat === undefined || lng === undefined) continue;

      const tags = el.tags || {};
      const rawName = tags["name"] || tags["name:en"] || tags["operator"];
      if (!rawName) continue; // Skip unnamed geographic nodes

      const amenity = tags["amenity"] || "";
      const healthcare = tags["healthcare"] || "";

      let facilityType: FacilityType = "clinic";
      if (amenity === "hospital" || healthcare === "hospital") {
        if (tags["emergency"] === "yes" || tags["emergency"] === "designated") {
          facilityType = "emergency_department";
        } else {
          facilityType = "hospital";
        }
      } else if (amenity === "pharmacy" || healthcare === "pharmacy") {
        facilityType = "pharmacy";
      } else if (amenity === "doctors" || tags["speciality"]) {
        facilityType = "specialist";
      }

      // Address extraction from OSM tags
      const addressParts = [
        tags["addr:housenumber"],
        tags["addr:street"],
        tags["addr:suburb"] || tags["addr:neighbourhood"],
        tags["addr:city"] || tags["addr:town"] || "Ghana",
      ].filter(Boolean);

      const formattedAddress = addressParts.length > 0 ? addressParts.join(", ") : "Ghana";
      const distanceMeters = calculateHaversineDistanceMeters(searchLat, searchLng, lat, lng);
      const phone = tags["phone"] || tags["contact:phone"] || null;
      const website = tags["website"] || tags["contact:website"] || null;
      const openingHours = tags["opening_hours"] || null;

      const services: string[] = [];
      if (tags["speciality"]) {
        services.push(...tags["speciality"].split(";").map((s) => s.trim()));
      }
      if (tags["healthcare:speciality"]) {
        services.push(...tags["healthcare:speciality"].split(";").map((s) => s.trim()));
      }

      results.push({
        id: `osm_${el.type}_${el.id}`,
        name: rawName,
        facilityType,
        formattedAddress,
        latitude: lat,
        longitude: lng,
        distanceMeters,
        phoneNumber: phone,
        phoneVerified: false,
        websiteUrl: website,
        mapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
        openingHours,
        openNow: openingHours ? openingHours.includes("24/7") : null,
        provider: "OpenStreetMap Contributors",
        lastVerifiedAt: new Date().toISOString(),
        services: services.length > 0 ? services : undefined,
        accessibility: {
          wheelchairAccessible: tags["wheelchair"] === "yes",
          parking: tags["parking"] === "yes",
        },
        appointmentBooking: {
          available: false,
          note: "Online appointment booking not verified in OpenStreetMap registry.",
        },
      });
    }

    return results;
  }

  private filterAndRank(
    facilities: NormalizedFacility[],
    searchLat: number,
    searchLng: number,
    radiusMeters: number,
    query?: string,
    limit = 20
  ): NormalizedFacility[] {
    const q = query?.trim().toLowerCase();

    const filtered = facilities
      .map((f) => ({
        ...f,
        distanceMeters: calculateHaversineDistanceMeters(searchLat, searchLng, f.latitude, f.longitude),
      }))
      .filter((f) => {
        if (f.distanceMeters > radiusMeters) return false;
        if (!q) return true;
        return (
          f.name.toLowerCase().includes(q) ||
          f.formattedAddress.toLowerCase().includes(q) ||
          f.facilityType.toLowerCase().includes(q) ||
          f.services?.some((s) => s.toLowerCase().includes(q))
        );
      });

    filtered.sort((a, b) => (a.distanceMeters ?? 999999) - (b.distanceMeters ?? 999999));
    return filtered.slice(0, limit);
  }
}

export const defaultOpenStreetMapProvider = new OpenStreetMapPlacesProvider();
