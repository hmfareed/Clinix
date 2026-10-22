import {
  IHealthcarePlacesProvider,
  NearbySearchRequest,
  NearbySearchResponse,
  NormalizedFacility,
} from "./types";
import { defaultGooglePlacesNewProvider, GooglePlacesNewProvider } from "./google-places-provider";
import { defaultVerifiedDirectoryProvider, VerifiedDirectoryProvider } from "./verified-directory-provider";
import { defaultOpenStreetMapProvider, OpenStreetMapPlacesProvider } from "./osm-places-provider";
import { calculateHaversineDistanceMeters } from "./distance";

export class HealthcarePlacesService {
  private readonly googleProvider: GooglePlacesNewProvider;
  private readonly osmProvider: OpenStreetMapPlacesProvider;
  private readonly verifiedDirectoryProvider: VerifiedDirectoryProvider;

  constructor(
    googleProvider: GooglePlacesNewProvider = defaultGooglePlacesNewProvider,
    verifiedDirectoryProvider: VerifiedDirectoryProvider = defaultVerifiedDirectoryProvider,
    osmProvider: OpenStreetMapPlacesProvider = defaultOpenStreetMapProvider
  ) {
    this.googleProvider = googleProvider;
    this.verifiedDirectoryProvider = verifiedDirectoryProvider;
    this.osmProvider = osmProvider;
  }

  async searchNearby(request: NearbySearchRequest): Promise<NearbySearchResponse> {
    const startTime = Date.now();

    // 1. Enforce strict radius constraints (500m to 25,000m)
    const radiusMeters = Math.min(Math.max(request.radiusMeters || 5000, 500), 25000);
    const sanitizedRequest: NearbySearchRequest = {
      ...request,
      radiusMeters,
      limit: Math.min(request.limit || 20, 50),
    };

    const providersUsed: string[] = [];
    const rawFacilities: NormalizedFacility[] = [];

    // 2. Query Verified Directory (official Ghana Health Service & Ministry of Health baseline)
    try {
      const verifiedResults = await this.verifiedDirectoryProvider.searchNearby(sanitizedRequest);
      if (verifiedResults.length > 0) {
        rawFacilities.push(...verifiedResults);
        providersUsed.push(this.verifiedDirectoryProvider.name);
      }
    } catch (err) {
      console.warn("[HEALTHCARE PLACES] Verified directory search error:", err);
    }

    // 3. Query Google Places (New) if configured
    if (this.googleProvider.isConfigured()) {
      try {
        const googleResults = await this.googleProvider.searchNearby(sanitizedRequest);
        if (googleResults.length > 0) {
          rawFacilities.push(...googleResults);
          providersUsed.push(this.googleProvider.name);
        }
      } catch (err) {
        console.warn("[HEALTHCARE PLACES] Google Places search failed:", err);
      }
    }

    // 4. Query OpenStreetMap for secondary local clinic coverage if needed
    // (If Google is unconfigured or returned fewer than 5 results, query OSM to augment smaller clinic coverage)
    if (rawFacilities.length < 10) {
      try {
        const osmResults = await this.osmProvider.searchNearby(sanitizedRequest);
        if (osmResults.length > 0) {
          rawFacilities.push(...osmResults);
          providersUsed.push(this.osmProvider.name);
        }
      } catch (err) {
        console.warn("[HEALTHCARE PLACES] OSM secondary search error:", err);
      }
    }

    // 5. Cautious Deduplication:
    // Match by provider ID first, or by proximity (< 80 meters) and normalized name similarity
    const deduplicated: NormalizedFacility[] = [];
    const seenIds = new Set<string>();

    for (const fac of rawFacilities) {
      if (seenIds.has(fac.id)) continue;

      // Recalculate distance server-side using the patient's actual coordinates
      const exactDistance = calculateHaversineDistanceMeters(
        sanitizedRequest.latitude,
        sanitizedRequest.longitude,
        fac.latitude,
        fac.longitude
      );

      // Enforce radius filter
      if (exactDistance > radiusMeters) continue;

      const normalizedName = fac.name.toLowerCase().replace(/[^a-z0-9]/g, "");

      // Check if another facility is at virtually the same location (< 80m) with similar name
      const existingIndex = deduplicated.findIndex((existing) => {
        const distBetween = calculateHaversineDistanceMeters(
          fac.latitude,
          fac.longitude,
          existing.latitude,
          existing.longitude
        );
        if (distBetween > 80) return false;

        const existingNormName = existing.name.toLowerCase().replace(/[^a-z0-9]/g, "");
        return (
          existingNormName === normalizedName ||
          existingNormName.includes(normalizedName) ||
          normalizedName.includes(existingNormName)
        );
      });

      if (existingIndex !== -1) {
        // Merge metadata: keep verified contact details or hours if present
        const existing = deduplicated[existingIndex];
        if (!existing.phoneNumber && fac.phoneNumber) {
          existing.phoneNumber = fac.phoneNumber;
          existing.phoneVerified = fac.phoneVerified;
        }
        if (!existing.openingHours && fac.openingHours) {
          existing.openingHours = fac.openingHours;
          existing.openNow = fac.openNow;
        }
        if ((!existing.services || existing.services.length === 0) && fac.services) {
          existing.services = fac.services;
        }
        seenIds.add(fac.id);
        continue;
      }

      seenIds.add(fac.id);
      deduplicated.push({
        ...fac,
        distanceMeters: exactDistance,
      });
    }

    // 6. Rank strictly by proximity (closest first)
    deduplicated.sort((a, b) => (a.distanceMeters ?? 999999) - (b.distanceMeters ?? 999999));

    // 7. Apply limit
    const finalFacilities = deduplicated.slice(0, sanitizedRequest.limit || 20);
    const searchTimeMs = Date.now() - startTime;

    return {
      success: true,
      facilities: finalFacilities,
      totalCount: finalFacilities.length,
      provider: providersUsed.join(" + ") || "Clinix Healthcare Directory",
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
