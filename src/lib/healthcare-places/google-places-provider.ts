import {
  FacilityType,
  IHealthcarePlacesProvider,
  NearbySearchRequest,
  NormalizedFacility,
} from "./types";
import { calculateHaversineDistanceMeters } from "./distance";

export class GooglePlacesNewProvider implements IHealthcarePlacesProvider {
  public readonly name = "google_places_new";
  private readonly apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || "";
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim() !== "");
  }

  async searchNearby(request: NearbySearchRequest): Promise<NormalizedFacility[]> {
    if (!this.isConfigured()) {
      throw new Error("Google Places API key is not configured.");
    }

    const { latitude, longitude, radiusMeters = 5000, facilityTypes, limit = 10, pageToken } = request;

    // Map internal types to Google Places (New) includedTypes
    const includedTypes: string[] = [];
    const targetTypes = Array.isArray(facilityTypes)
      ? facilityTypes
      : facilityTypes && facilityTypes !== "all"
      ? [facilityTypes]
      : ["all"];

    if (targetTypes.includes("all")) {
      includedTypes.push("hospital", "medical_clinic", "pharmacy", "doctor");
    } else {
      if (targetTypes.includes("hospital") || targetTypes.includes("emergency_department")) {
        includedTypes.push("hospital");
      }
      if (targetTypes.includes("clinic")) {
        includedTypes.push("medical_clinic", "doctor");
      }
      if (targetTypes.includes("pharmacy")) {
        includedTypes.push("pharmacy");
      }
    }

    const requestBody: Record<string, unknown> = {
      includedTypes,
      maxResultCount: Math.min(limit, 20),
      locationRestriction: {
        circle: {
          center: {
            latitude,
            longitude,
          },
          radius: Number(radiusMeters),
        },
      },
      rankPreference: "DISTANCE",
    };

    if (pageToken) {
      requestBody.pageToken = pageToken;
    }

    const url = "https://places.googleapis.com/v1/places:searchNearby";
    const fieldMask = [
      "places.id",
      "places.displayName",
      "places.primaryType",
      "places.types",
      "places.formattedAddress",
      "places.location",
      "places.nationalPhoneNumber",
      "places.websiteUri",
      "places.googleMapsUri",
      "places.currentOpeningHours",
    ].join(",");

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Google Places API returned HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    if (!data.places || !Array.isArray(data.places)) {
      return [];
    }

    const normalized: NormalizedFacility[] = data.places.map((p: any) => {
      const pLat = p.location?.latitude ?? latitude;
      const pLng = p.location?.longitude ?? longitude;

      // Determine facility type
      const types = p.types || [];
      let facilityType: FacilityType = "clinic";
      if (types.includes("emergency_room") || p.primaryType === "emergency_room") {
        facilityType = "emergency_department";
      } else if (types.includes("hospital") || p.primaryType === "hospital") {
        facilityType = "hospital";
      } else if (types.includes("pharmacy") || p.primaryType === "pharmacy") {
        facilityType = "pharmacy";
      }

      const dist = calculateHaversineDistanceMeters(latitude, longitude, pLat, pLng);
      const mapsUrl = p.googleMapsUri || `https://www.google.com/maps/dir/?api=1&destination=${pLat},${pLng}`;

      return {
        id: p.id || `gplaces_${Math.random().toString(36).substring(7)}`,
        name: p.displayName?.text || "Healthcare Facility",
        facilityType,
        formattedAddress: p.formattedAddress || "Ghana",
        latitude: pLat,
        longitude: pLng,
        distanceMeters: dist,
        phoneNumber: p.nationalPhoneNumber || null,
        websiteUrl: p.websiteUri || null,
        mapsUrl,
        openingHours: p.currentOpeningHours?.weekdayDescriptions?.join("; ") || null,
        openNow: p.currentOpeningHours?.openNow ?? null,
        provider: "Google Places API (New)",
        lastVerifiedAt: new Date().toISOString(),
      };
    });

    return normalized;
  }
}

export const defaultGooglePlacesNewProvider = new GooglePlacesNewProvider();
