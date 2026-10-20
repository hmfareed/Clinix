import { Facility, IMapsProvider, SearchFacilitiesParams, FacilityType } from "./types";
import { defaultGhanaDirectoryProvider } from "./ghana-directory-provider";
import { calculateHaversineDistanceKm } from "./distance";

export class GoogleMapsProvider implements IMapsProvider {
  public readonly name = "google_maps";
  private readonly apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GOOGLE_MAPS_API_KEY || "";
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim() !== "");
  }

  async searchFacilities(params: SearchFacilitiesParams): Promise<Facility[]> {
    if (!this.isConfigured()) {
      return defaultGhanaDirectoryProvider.searchFacilities(params);
    }

    try {
      let url = "";
      const radiusMeters = (params.radiusKm || 30) * 1000;

      if (params.lat !== undefined && params.lng !== undefined) {
        url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${params.lat},${params.lng}&radius=${radiusMeters}&type=hospital&key=${this.apiKey}`;
      } else if (params.query) {
        const searchQuery = `${params.query} hospital clinic Ghana`;
        url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${this.apiKey}`;
      } else {
        return defaultGhanaDirectoryProvider.searchFacilities(params);
      }

      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) {
        throw new Error(`Google Maps API error: ${res.statusText}`);
      }

      const data = await res.json();
      if (!data.results || !Array.isArray(data.results) || data.results.length === 0) {
        // Graceful fallback to verified Ghanaian directory
        return defaultGhanaDirectoryProvider.searchFacilities(params);
      }

      const facilities: Facility[] = data.results.slice(0, params.limit || 20).map((place: any) => {
        const lat = place.geometry?.location?.lat || 0;
        const lng = place.geometry?.location?.lng || 0;

        let type: FacilityType = "clinic";
        const types = place.types || [];
        if (types.includes("hospital")) type = "hospital";
        else if (types.includes("pharmacy")) type = "pharmacy";

        let distanceKm: number | undefined;
        if (params.lat !== undefined && params.lng !== undefined) {
          distanceKm = calculateHaversineDistanceKm(params.lat, params.lng, lat, lng);
        }

        return {
          providerId: place.place_id || `gmaps_${Math.random().toString(36).substring(7)}`,
          name: place.name || "Medical Facility",
          type,
          location: { lat, lng },
          address: place.formatted_address || place.vicinity || "Ghana",
          phone: undefined, // Requires place details call
          phoneVerified: false,
          hours: {
            known: Boolean(place.opening_hours),
            text: place.opening_hours?.open_now ? "Open Now" : "Hours Unspecified",
          },
          services: ["General Healthcare", "Consultation"],
          source: "Google Maps API",
          lastVerifiedAt: new Date().toISOString(),
          distanceKm,
        };
      });

      return facilities;
    } catch (err) {
      console.warn("[GOOGLE MAPS PROVIDER] Places search failed, falling back to Ghana Directory:", err);
      return defaultGhanaDirectoryProvider.searchFacilities(params);
    }
  }

  async getFacilityDetails(providerId: string): Promise<Facility | null> {
    if (!this.isConfigured() || !providerId.startsWith("ChIJ")) {
      return defaultGhanaDirectoryProvider.getFacilityDetails(providerId);
    }

    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${providerId}&fields=name,formatted_address,formatted_phone_number,opening_hours,geometry,types&key=${this.apiKey}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return defaultGhanaDirectoryProvider.getFacilityDetails(providerId);

      const data = await res.json();
      const place = data.result;
      if (!place) return defaultGhanaDirectoryProvider.getFacilityDetails(providerId);

      const lat = place.geometry?.location?.lat || 0;
      const lng = place.geometry?.location?.lng || 0;

      let type: FacilityType = "clinic";
      if (place.types?.includes("hospital")) type = "hospital";
      else if (place.types?.includes("pharmacy")) type = "pharmacy";

      return {
        providerId,
        name: place.name,
        type,
        location: { lat, lng },
        address: place.formatted_address,
        phone: place.formatted_phone_number,
        phoneVerified: Boolean(place.formatted_phone_number),
        hours: {
          known: Boolean(place.opening_hours),
          text: place.opening_hours?.weekday_text?.join("; "),
        },
        services: ["Emergency Care", "Consultation", "Inpatient & Outpatient"],
        source: "Google Places Details",
        lastVerifiedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.warn("[GOOGLE MAPS PROVIDER] Place details failed, falling back to Ghana Directory:", err);
      return defaultGhanaDirectoryProvider.getFacilityDetails(providerId);
    }
  }
}

export const defaultGoogleMapsProvider = new GoogleMapsProvider();
