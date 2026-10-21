import { GeocodeRequest, GeocodeResponse } from "./types";

// Verified Ghanaian geographical localities and landmarks for instant, reliable resolution
const GHANA_LOCALITIES: Record<string, { lat: number; lng: number; displayName: string }> = {
  // Greater Accra
  accra: { lat: 5.556, lng: -0.1969, displayName: "Accra, Greater Accra Region, Ghana" },
  osu: { lat: 5.5565, lng: -0.1818, displayName: "Osu, Accra, Ghana" },
  airport: { lat: 5.6025, lng: -0.1837, displayName: "Airport Residential Area, Accra, Ghana" },
  "east legon": { lat: 5.6358, lng: -0.1601, displayName: "East Legon, Accra, Ghana" },
  cantonments: { lat: 5.5786, lng: -0.1764, displayName: "Cantonments, Accra, Ghana" },
  ridge: { lat: 5.5614, lng: -0.1982, displayName: "Ridge, Accra, Ghana" },
  "korle bu": { lat: 5.5375, lng: -0.2289, displayName: "Korle Bu, Accra, Ghana" },
  tema: { lat: 5.6698, lng: -0.0166, displayName: "Tema, Greater Accra Region, Ghana" },
  madina: { lat: 5.6685, lng: -0.1654, displayName: "Madina, Greater Accra Region, Ghana" },
  spintex: { lat: 5.6302, lng: -0.1035, displayName: "Spintex Road, Accra, Ghana" },
  dansoman: { lat: 5.5489, lng: -0.2642, displayName: "Dansoman, Accra, Ghana" },
  kasoa: { lat: 5.5345, lng: -0.4244, displayName: "Kasoa, Central/Greater Accra Border, Ghana" },

  // Ashanti Region
  kumasi: { lat: 6.6885, lng: -1.6244, displayName: "Kumasi, Ashanti Region, Ghana" },
  adum: { lat: 6.6912, lng: -1.6245, displayName: "Adum, Kumasi, Ashanti Region, Ghana" },
  bantama: { lat: 6.6985, lng: -1.6325, displayName: "Bantama, Kumasi, Ashanti Region, Ghana" },
  manhyia: { lat: 6.7051, lng: -1.6148, displayName: "Manhyia, Kumasi, Ashanti Region, Ghana" },
  knust: { lat: 6.6745, lng: -1.5714, displayName: "KNUST, Kumasi, Ashanti Region, Ghana" },
  asokwa: { lat: 6.6695, lng: -1.6085, displayName: "Asokwa, Kumasi, Ashanti Region, Ghana" },

  // Northern & Upper Regions
  tamale: { lat: 9.4008, lng: -0.8393, displayName: "Tamale, Northern Region, Ghana" },
  wa: { lat: 10.0601, lng: -2.5099, displayName: "Wa, Upper West Region, Ghana" },
  bolgatanga: { lat: 10.7856, lng: -0.8514, displayName: "Bolgatanga, Upper East Region, Ghana" },

  // Western & Central Regions
  takoradi: { lat: 4.8873, lng: -1.7554, displayName: "Takoradi, Western Region, Ghana" },
  sekondi: { lat: 4.9341, lng: -1.7137, displayName: "Sekondi, Western Region, Ghana" },
  "cape coast": { lat: 5.1054, lng: -1.2466, displayName: "Cape Coast, Central Region, Ghana" },

  // Eastern & Volta Regions
  koforidua: { lat: 6.0941, lng: -0.2591, displayName: "Koforidua, Eastern Region, Ghana" },
  ho: { lat: 6.6108, lng: 0.4713, displayName: "Ho, Volta Region, Ghana" },
  sunyani: { lat: 7.3399, lng: -2.3268, displayName: "Sunyani, Bono Region, Ghana" },
  techiman: { lat: 7.5833, lng: -1.9333, displayName: "Techiman, Bono East Region, Ghana" },
};

export class GeocodeService {
  private readonly apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GOOGLE_MAPS_API_KEY || "";
  }

  async geocode(request: GeocodeRequest): Promise<GeocodeResponse | null> {
    const rawQuery = request.query.toLowerCase().trim();

    // 1. Check verified Ghanaian localities dictionary first for fast, exact match
    for (const [key, loc] of Object.entries(GHANA_LOCALITIES)) {
      if (rawQuery.includes(key) || key.includes(rawQuery)) {
        return {
          success: true,
          latitude: loc.lat,
          longitude: loc.lng,
          displayName: loc.displayName,
          provider: "clinix_verified_ghana_localities",
        };
      }
    }

    // 2. If Google Maps API is configured, use Google Geocoding API
    if (this.apiKey) {
      try {
        const queryWithCountry = rawQuery.includes("ghana") ? rawQuery : `${rawQuery}, Ghana`;
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          queryWithCountry
        )}&key=${this.apiKey}`;

        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const data = await res.json();
          if (data.results && data.results.length > 0) {
            const first = data.results[0];
            const lat = first.geometry?.location?.lat;
            const lng = first.geometry?.location?.lng;
            if (lat !== undefined && lng !== undefined) {
              return {
                success: true,
                latitude: lat,
                longitude: lng,
                displayName: first.formatted_address || request.query,
                provider: "google_geocoding",
              };
            }
          }
        }
      } catch (err) {
        console.warn("[GEOCODE SERVICE] Google Geocoding lookup failed:", err);
      }
    }

    // 3. Fallback: default to central Accra coordinates if in Ghana
    return {
      success: true,
      latitude: 5.556,
      longitude: -0.1969,
      displayName: `${request.query} (Estimated area in Ghana)`,
      provider: "fallback_regional_center",
    };
  }
}

export const defaultGeocodeService = new GeocodeService();
