import { Facility, SearchFacilitiesParams, IMapsProvider } from "./types";
import { defaultGhanaDirectoryProvider } from "./ghana-directory-provider";
import { defaultGoogleMapsProvider } from "./google-maps-provider";
import { connectToDatabase } from "@/lib/db/mongodb";
import FacilityCache from "@/models/FacilityCache";
import mongoose from "mongoose";

export class FacilityService {
  private readonly provider: IMapsProvider;

  constructor(
    provider: IMapsProvider = process.env.GOOGLE_MAPS_API_KEY
      ? defaultGoogleMapsProvider
      : defaultGhanaDirectoryProvider
  ) {
    this.provider = provider;
  }

  async searchFacilities(params: SearchFacilitiesParams): Promise<Facility[]> {
    // 1. Check database cache if geospatial coordinates are given and MongoDB is available
    if (
      params.lat !== undefined &&
      params.lng !== undefined &&
      mongoose.connection.readyState === 1
    ) {
      try {
        const radiusMeters = (params.radiusKm || 30) * 1000;
        const query: Record<string, unknown> = {
          location: {
            $nearSphere: {
              $geometry: {
                type: "Point",
                coordinates: [params.lng, params.lat],
              },
              $maxDistance: radiusMeters,
            },
          },
        };

        if (params.type) {
          query.type = params.type;
        }

        const cached = await FacilityCache.find(query).limit(params.limit || 20);
        if (cached && cached.length > 0) {
          return cached.map((c) => ({
            providerId: c.providerId,
            name: c.name,
            type: c.type,
            location: {
              lat: c.location.coordinates[1],
              lng: c.location.coordinates[0],
            },
            address: c.address,
            phone: c.phone,
            phoneVerified: c.phoneVerified,
            hours: c.hours,
            services: c.services,
            source: c.source,
            lastVerifiedAt: c.lastVerifiedAt.toISOString(),
          }));
        }
      } catch (cacheErr) {
        console.warn("[FACILITY SERVICE] DB cache lookup failed, querying provider:", cacheErr);
      }
    }

    // 2. Query maps/directory provider
    const results = await this.provider.searchFacilities(params);

    // 3. Asynchronously populate cache in database if connected
    if (results.length > 0 && mongoose.connection.readyState === 1) {
      this.populateCache(results).catch((err) =>
        console.warn("[FACILITY SERVICE] Async cache population error:", err)
      );
    }

    return results;
  }

  async getFacilityById(providerId: string): Promise<Facility | null> {
    if (mongoose.connection.readyState === 1) {
      try {
        const cached = await FacilityCache.findOne({ providerId });
        if (cached) {
          return {
            providerId: cached.providerId,
            name: cached.name,
            type: cached.type,
            location: {
              lat: cached.location.coordinates[1],
              lng: cached.location.coordinates[0],
            },
            address: cached.address,
            phone: cached.phone,
            phoneVerified: cached.phoneVerified,
            hours: cached.hours,
            services: cached.services,
            source: cached.source,
            lastVerifiedAt: cached.lastVerifiedAt.toISOString(),
          };
        }
      } catch {
        // Fallback to provider
      }
    }

    return this.provider.getFacilityDetails(providerId);
  }

  private async populateCache(facilities: Facility[]): Promise<void> {
    await connectToDatabase();
    for (const f of facilities) {
      await FacilityCache.updateOne(
        { providerId: f.providerId },
        {
          $set: {
            name: f.name,
            type: f.type,
            location: {
              type: "Point",
              coordinates: [f.location.lng, f.location.lat],
            },
            address: f.address,
            phone: f.phone,
            phoneVerified: f.phoneVerified,
            hours: f.hours,
            services: f.services,
            source: f.source,
            lastVerifiedAt: f.lastVerifiedAt ? new Date(f.lastVerifiedAt) : new Date(),
          },
        },
        { upsert: true }
      );
    }
  }
}

export const defaultFacilityService = new FacilityService();
