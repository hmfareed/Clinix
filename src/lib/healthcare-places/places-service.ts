import {
  IHealthcarePlacesProvider,
  NearbySearchRequest,
  NearbySearchResponse,
  NormalizedFacility,
} from "./types";
import { defaultGooglePlacesNewProvider, GooglePlacesNewProvider } from "./google-places-provider";
import { defaultVerifiedDirectoryProvider, VerifiedDirectoryProvider } from "./verified-directory-provider";

export class HealthcarePlacesService {
  private readonly googleProvider: GooglePlacesNewProvider;
  private readonly verifiedDirectoryProvider: VerifiedDirectoryProvider;

  constructor(
    googleProvider: GooglePlacesNewProvider = defaultGooglePlacesNewProvider,
    verifiedDirectoryProvider: VerifiedDirectoryProvider = defaultVerifiedDirectoryProvider
  ) {
    this.googleProvider = googleProvider;
    this.verifiedDirectoryProvider = verifiedDirectoryProvider;
  }

  async searchNearby(request: NearbySearchRequest): Promise<NearbySearchResponse> {
    const startTime = Date.now();

    // 1. Enforce strict radius constraints (500m to 25,000m)
    const radiusMeters = Math.min(Math.max(request.radiusMeters || 5000, 500), 25000);
    const sanitizedRequest: NearbySearchRequest = {
      ...request,
      radiusMeters,
      limit: Math.min(request.limit || 10, 20),
    };

    let facilities: NormalizedFacility[] = [];
    let activeProviderName = this.verifiedDirectoryProvider.name;

    // 2. Attempt Google Places (New) if configured
    if (this.googleProvider.isConfigured()) {
      try {
        facilities = await this.googleProvider.searchNearby(sanitizedRequest);
        activeProviderName = this.googleProvider.name;
      } catch (err) {
        console.warn("[HEALTHCARE PLACES] Google Places search failed, falling back to verified directory:", err);
      }
    }

    // 3. Fallback to verified Ghanaian directory if Google returned 0 or wasn't configured
    if (facilities.length === 0) {
      facilities = await this.verifiedDirectoryProvider.searchNearby(sanitizedRequest);
      activeProviderName = this.verifiedDirectoryProvider.name;
    }

    // 4. Deduplicate facilities by ID or matching coordinates + name
    const seenIds = new Set<string>();
    const deduplicated: NormalizedFacility[] = [];

    for (const f of facilities) {
      const key = `${f.name.toLowerCase()}_${f.latitude.toFixed(3)}_${f.longitude.toFixed(3)}`;
      if (seenIds.has(f.id) || seenIds.has(key)) {
        continue;
      }
      seenIds.add(f.id);
      seenIds.add(key);
      deduplicated.push(f);
    }

    // 5. Rank strictly by distance (closest first)
    deduplicated.sort((a, b) => (a.distanceMeters ?? 999999) - (b.distanceMeters ?? 999999));

    const searchTimeMs = Date.now() - startTime;

    return {
      success: true,
      facilities: deduplicated,
      totalCount: deduplicated.length,
      provider: activeProviderName,
      radiusMeters,
      center: {
        latitude: sanitizedRequest.latitude,
        longitude: sanitizedRequest.longitude,
      },
      searchTimeMs,
    };
  }
}

export const defaultHealthcarePlacesService = new HealthcarePlacesService();
