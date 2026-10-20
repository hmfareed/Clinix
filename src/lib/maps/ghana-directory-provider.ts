import { Facility, IMapsProvider, SearchFacilitiesParams } from "./types";
import { calculateHaversineDistanceKm } from "./distance";
import rawGhanaFacilities from "@/data/ghana-facilities.json";

export class GhanaDirectoryProvider implements IMapsProvider {
  public readonly name = "ghana-healthcare-directory";
  private readonly facilities: Facility[];

  constructor() {
    this.facilities = rawGhanaFacilities as Facility[];
  }

  async searchFacilities(params: SearchFacilitiesParams): Promise<Facility[]> {
    let results = [...this.facilities];

    // 1. Filter by facility type if specified
    if (params.type) {
      results = results.filter((f) => f.type === params.type);
    }

    // 2. Filter by text query if manual location/name query given
    if (params.query && params.query.trim()) {
      const q = params.query.toLowerCase().trim();
      results = results.filter((f) => {
        const nameMatch = f.name.toLowerCase().includes(q);
        const addressMatch = f.address?.toLowerCase().includes(q);
        const serviceMatch = f.services?.some((s) => s.toLowerCase().includes(q));
        return nameMatch || addressMatch || serviceMatch;
      });
    }

    // 3. Compute distance if coordinates provided
    if (params.lat !== undefined && params.lng !== undefined) {
      results = results.map((f) => {
        const dist = calculateHaversineDistanceKm(
          params.lat!,
          params.lng!,
          f.location.lat,
          f.location.lng
        );
        return {
          ...f,
          distanceKm: dist,
        };
      });

      // Filter by radiusKm if requested
      if (params.radiusKm) {
        const withinRadius = results.filter(
          (f) => f.distanceKm !== undefined && f.distanceKm <= params.radiusKm!
        );
        // If results exist within radius, restrict to radius; otherwise preserve sorted closest
        if (withinRadius.length > 0) {
          results = withinRadius;
        }
      }

      // Sort ascending by proximity
      results.sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
    }

    // 4. Apply result limit
    const limit = params.limit || 20;
    return results.slice(0, limit);
  }

  async getFacilityDetails(providerId: string): Promise<Facility | null> {
    const found = this.facilities.find((f) => f.providerId === providerId);
    return found || null;
  }
}

export const defaultGhanaDirectoryProvider = new GhanaDirectoryProvider();
