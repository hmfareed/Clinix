import { describe, it, expect, vi } from "vitest";
import { calculateHaversineDistanceMeters, formatStraightLineDistance } from "@/lib/healthcare-places/distance";
import { defaultHealthcarePlacesService, HealthcarePlacesService } from "@/lib/healthcare-places/places-service";
import { GooglePlacesNewProvider } from "@/lib/healthcare-places/google-places-provider";
import { VerifiedDirectoryProvider } from "@/lib/healthcare-places/verified-directory-provider";
import { OpenStreetMapPlacesProvider } from "@/lib/healthcare-places/osm-places-provider";
import { NormalizedFacility } from "@/lib/healthcare-places/types";
import { POST as nearbyRouteHandler } from "@/app/api/v1/healthcare/nearby/route";
import { NextRequest } from "next/server";

describe("Nearby Healthcare Search Pipeline — Real Location & Multi-Provider Ranking", () => {
  describe("Tamale Location Regression Test: Proximity vs Famous Hospital", () => {
    it("ranks closer local clinics and district hospitals ahead of Tamale Teaching Hospital when patient is closer to them", async () => {
      // Patient standing near Tishigu / Bank Road in Central Tamale (9.4070, -0.8380)
      // Tamale Central Hospital is ~80 m away
      // Ernest Chemists Central is ~200 m away
      // Tamale Teaching Hospital is ~510 m away
      const patientLat = 9.407;
      const patientLng = -0.838;

      const response = await defaultHealthcarePlacesService.searchNearby({
        latitude: patientLat,
        longitude: patientLng,
        radiusMeters: 5000,
        facilityTypes: "all",
      });

      expect(response.success).toBe(true);
      expect(response.facilities.length).toBeGreaterThan(1);

      // Verify returned results are ordered strictly ascending by proximity
      for (let i = 1; i < response.facilities.length; i++) {
        expect(response.facilities[i].distanceMeters!).toBeGreaterThanOrEqual(
          response.facilities[i - 1].distanceMeters!
        );
      }

      // The first facility MUST be the closest one (e.g. Tamale Central Hospital or pharmacy), NOT Tamale Teaching Hospital
      const firstFacility = response.facilities[0];
      expect(firstFacility.name).not.toBe("Tamale Teaching Hospital");
      expect(firstFacility.distanceMeters).toBeLessThan(300);

      // Verify Tamale Teaching Hospital is present but ranked strictly according to its greater distance
      const tthIndex = response.facilities.findIndex((f) => f.name.includes("Tamale Teaching Hospital"));
      expect(tthIndex).toBeGreaterThan(0);
      expect(response.facilities[tthIndex].distanceMeters).toBeGreaterThan(firstFacility.distanceMeters!);
    });

    it("excludes farther facilities when a tight radius (e.g. 1000m) is selected around patient coordinates", async () => {
      // Patient at 9.4070, -0.8380
      const tightResponse = await defaultHealthcarePlacesService.searchNearby({
        latitude: 9.407,
        longitude: -0.838,
        radiusMeters: 1000, // 1 km radius
      });

      for (const fac of tightResponse.facilities) {
        expect(fac.distanceMeters).toBeLessThanOrEqual(1000);
      }

      // SDA Hospital Tamale (~1.4 km away) must NOT be in 1km results
      const sda = tightResponse.facilities.find((f) => f.name.includes("Seventh Day Adventist"));
      expect(sda).toBeUndefined();

      // Expanding radius to 2.5 km should now include SDA Hospital
      const wideResponse = await defaultHealthcarePlacesService.searchNearby({
        latitude: 9.407,
        longitude: -0.838,
        radiusMeters: 2500,
      });

      const sdaWide = wideResponse.facilities.find((f) => f.name.includes("Seventh Day Adventist"));
      expect(sdaWide).toBeDefined();
    });
  });

  describe("Server-Side Distance Re-Calculation & Anti-Popularity Re-Ranking", () => {
    it("re-ranks popularity-ordered provider results by actual Haversine straight-line distance", async () => {
      const patientLat = 5.6025;
      const patientLng = -0.1837;

      // Mock a provider that returns results ordered by popularity / prominence (far famous hospital first)
      const mockGoogleProvider = new GooglePlacesNewProvider("mock_key");
      vi.spyOn(mockGoogleProvider, "isConfigured").mockReturnValue(true);
      vi.spyOn(mockGoogleProvider, "searchNearby").mockResolvedValue([
        {
          id: "g_popular_far",
          name: "Famous Regional Referral Hospital",
          facilityType: "hospital",
          formattedAddress: "Far Away Highway, Ghana",
          latitude: 5.65, // ~6 km away
          longitude: -0.18,
          mapsUrl: "https://maps.google.com/?q=5.65,-0.18",
          provider: "Google Places API (New)",
        },
        {
          id: "g_small_close",
          name: "Neighbourhood Family Clinic",
          facilityType: "clinic",
          formattedAddress: "Local Street 2, Ghana",
          latitude: 5.604, // ~200 m away
          longitude: -0.184,
          mapsUrl: "https://maps.google.com/?q=5.604,-0.184",
          provider: "Google Places API (New)",
        },
      ]);

      const mockDirectory = new VerifiedDirectoryProvider([]);
      const service = new HealthcarePlacesService(
        mockGoogleProvider,
        mockDirectory,
        new OpenStreetMapPlacesProvider("mock", 100)
      );

      const response = await service.searchNearby({
        latitude: patientLat,
        longitude: patientLng,
        radiusMeters: 10000,
      });

      expect(response.facilities.length).toBe(2);
      // The closer clinic must be re-ranked to index 0, overriding the provider's original popularity order
      expect(response.facilities[0].name).toBe("Neighbourhood Family Clinic");
      expect(response.facilities[0].distanceMeters).toBeLessThan(500);

      expect(response.facilities[1].name).toBe("Famous Regional Referral Hospital");
      expect(response.facilities[1].distanceMeters).toBeGreaterThan(4000);
    });
  });

  describe("Multi-Provider Deduplication & Partial Failure Resilience", () => {
    it("deduplicates identical facilities returned across multiple providers by ID and coordinates", async () => {
      const mockGoogle = new GooglePlacesNewProvider("mock_key");
      vi.spyOn(mockGoogle, "isConfigured").mockReturnValue(true);
      vi.spyOn(mockGoogle, "searchNearby").mockResolvedValue([
        {
          id: "place_123",
          name: "Ridge Hospital",
          facilityType: "hospital",
          formattedAddress: "Castle Road, Ridge, Accra",
          latitude: 5.5614,
          longitude: -0.1982,
          phoneNumber: "+233302228315",
          phoneVerified: true,
          mapsUrl: "https://maps.google.com/?q=5.5614,-0.1982",
          provider: "Google Places API (New)",
        },
      ]);

      const mockOsm = new OpenStreetMapPlacesProvider("mock", 100);
      vi.spyOn(mockOsm, "searchNearby").mockResolvedValue([
        {
          id: "osm_node_999",
          name: "Ridge Hospital (Greater Accra Regional)",
          facilityType: "hospital",
          formattedAddress: "Castle Road, Accra",
          latitude: 5.5615, // virtually identical location (~15m away)
          longitude: -0.1983,
          mapsUrl: "https://maps.google.com/?q=5.5615,-0.1983",
          provider: "OpenStreetMap Contributors",
        },
      ]);

      const service = new HealthcarePlacesService(
        mockGoogle,
        new VerifiedDirectoryProvider([]),
        mockOsm
      );

      const response = await service.searchNearby({
        latitude: 5.56,
        longitude: -0.2,
        radiusMeters: 5000,
      });

      // The duplicate facility should be merged rather than appearing twice
      expect(response.facilities.length).toBe(1);
      expect(response.facilities[0].name).toContain("Ridge Hospital");
    });

    it("gracefully serves verified directory results when online providers fail or time out", async () => {
      const mockGoogle = new GooglePlacesNewProvider("mock_key");
      vi.spyOn(mockGoogle, "isConfigured").mockReturnValue(true);
      vi.spyOn(mockGoogle, "searchNearby").mockRejectedValue(new Error("Network timeout 504"));

      const mockOsm = new OpenStreetMapPlacesProvider("mock", 100);
      vi.spyOn(mockOsm, "searchNearby").mockRejectedValue(new Error("Overpass rate limit exceeded"));

      const service = new HealthcarePlacesService(
        mockGoogle,
        defaultHealthcarePlacesService["verifiedDirectoryProvider"],
        mockOsm
      );

      const response = await service.searchNearby({
        latitude: 5.556,
        longitude: -0.1969,
        radiusMeters: 5000,
      });

      expect(response.success).toBe(true);
      expect(response.facilities.length).toBeGreaterThan(0);
      expect(response.provider).toContain("verified_ghana_directory");
    });
  });

  describe("API Endpoint Validation & Coordinates Honesty", () => {
    it("never replaces missing coordinates with a default hospital; rejects missing coords with 400", async () => {
      const req = new NextRequest("http://localhost/api/v1/healthcare/nearby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Missing latitude and longitude
          radiusMeters: 5000,
        }),
      });

      const res = await nearbyRouteHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("VALIDATION_FAILED");
    });

    it("honestly returns empty array rather than substituting a famous hospital when no facilities exist in radius", async () => {
      // Middle of the Gulf of Guinea (0.0, 0.0), miles from any hospital
      const emptySearch = await defaultHealthcarePlacesService.searchNearby({
        latitude: 0.0,
        longitude: 0.0,
        radiusMeters: 5000,
      });

      expect(emptySearch.success).toBe(true);
      expect(emptySearch.facilities).toEqual([]);
      expect(emptySearch.totalCount).toBe(0);
    });
  });
});
