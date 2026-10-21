import { describe, it, expect, vi } from "vitest";
import { calculateHaversineDistanceMeters, formatDistance } from "@/lib/healthcare-places/distance";
import { defaultVerifiedDirectoryProvider } from "@/lib/healthcare-places/verified-directory-provider";
import { defaultHealthcarePlacesService, HealthcarePlacesService } from "@/lib/healthcare-places/places-service";
import { defaultGeocodeService } from "@/lib/healthcare-places/geocode-service";
import { defaultAssistantService } from "@/services/clinix-assistant-service";
import { classifyIntent } from "@/lib/assistant/intent-classifier";
import { checkEmergencyRules } from "@/lib/safety/triage-engine";

describe("Healthcare Places & Clinic Discovery Module", () => {
  describe("Distance Calculations & Formatting", () => {
    it("correctly computes distance between Korle Bu and Ridge Hospital (~3.7 km)", () => {
      // Korle Bu: 5.5375, -0.2289
      // Greater Accra Regional Hospital (Ridge): 5.5614, -0.1982
      const distance = calculateHaversineDistanceMeters(5.5375, -0.2289, 5.5614, -0.1982);
      expect(distance).toBeGreaterThan(3000);
      expect(distance).toBeLessThan(4500);
    });

    it("formats distances under 1 km in meters and over 1 km in kilometers", () => {
      expect(formatDistance(450)).toBe("~450 m away");
      expect(formatDistance(1250)).toBe("~1.3 km away");
      expect(formatDistance(5000)).toBe("~5.0 km away");
      expect(formatDistance(undefined)).toBe("Distance unknown");
    });
  });

  describe("Verified Ghanaian Facilities Directory Provider", () => {
    it("returns verified facilities within search radius", async () => {
      // Search centered in central Accra (5.556, -0.1969) within 8km
      const results = await defaultVerifiedDirectoryProvider.searchNearby({
        latitude: 5.556,
        longitude: -0.1969,
        radiusMeters: 8000,
        facilityTypes: "all",
      });

      expect(results.length).toBeGreaterThan(0);
      const first = results[0];
      expect(first).toHaveProperty("name");
      expect(first).toHaveProperty("formattedAddress");
      expect(first).toHaveProperty("mapsUrl");
      expect(first.distanceMeters).toBeDefined();
      expect(first.distanceMeters).toBeLessThanOrEqual(8000);
    });

    it("filters facilities by facilityType", async () => {
      const hospitalResults = await defaultVerifiedDirectoryProvider.searchNearby({
        latitude: 5.556,
        longitude: -0.1969,
        radiusMeters: 10000,
        facilityTypes: "hospital",
      });

      expect(hospitalResults.length).toBeGreaterThan(0);
      expect(hospitalResults.every((f) => f.facilityType === "hospital")).toBe(true);
    });
  });

  describe("Healthcare Places Service Orchestrator", () => {
    it("enforces strict radius bounds (clamps to 500m - 25,000m)", async () => {
      // Requesting 100,000m should be clamped to 25,000m
      const response = await defaultHealthcarePlacesService.searchNearby({
        latitude: 5.556,
        longitude: -0.1969,
        radiusMeters: 100000,
      });

      expect(response.radiusMeters).toBe(25000);
      expect(response.success).toBe(true);
      expect(response.facilities.length).toBeGreaterThan(0);
    });

    it("ranks returned facilities strictly by proximity (closest first)", async () => {
      const response = await defaultHealthcarePlacesService.searchNearby({
        latitude: 5.556,
        longitude: -0.1969,
        radiusMeters: 15000,
      });

      for (let i = 0; i < response.facilities.length - 1; i++) {
        const curDist = response.facilities[i].distanceMeters ?? 0;
        const nextDist = response.facilities[i + 1].distanceMeters ?? 0;
        expect(curDist).toBeLessThanOrEqual(nextDist);
      }
    });
  });

  describe("Geocode Service for Ghanaian Localities", () => {
    it("resolves major Ghanaian towns to verified coordinates", async () => {
      const accra = await defaultGeocodeService.geocode({ query: "Accra" });
      expect(accra).not.toBeNull();
      expect(accra!.latitude).toBeCloseTo(5.556, 2);
      expect(accra!.longitude).toBeCloseTo(-0.1969, 2);

      const kumasi = await defaultGeocodeService.geocode({ query: "Kumasi" });
      expect(kumasi).not.toBeNull();
      expect(kumasi!.latitude).toBeCloseTo(6.6885, 2);
      expect(kumasi!.longitude).toBeCloseTo(-1.6244, 2);

      const tamale = await defaultGeocodeService.geocode({ query: "Tamale" });
      expect(tamale).not.toBeNull();
      expect(tamale!.latitude).toBeCloseTo(9.4008, 2);
      expect(tamale!.longitude).toBeCloseTo(-0.8393, 2);
    });

    it("resolves neighbourhoods like Osu, East Legon, and KNUST", async () => {
      const osu = await defaultGeocodeService.geocode({ query: "Osu" });
      expect(osu).not.toBeNull();
      expect(osu!.displayName).toContain("Osu");

      const knust = await defaultGeocodeService.geocode({ query: "KNUST" });
      expect(knust).not.toBeNull();
      expect(knust!.displayName).toContain("KNUST");
    });
  });

  describe("Intent Classifier & Clinical Safety Gates", () => {
    it("classifies facility queries as clinic_search", () => {
      const res1 = classifyIntent("Find a hospital near me");
      expect(res1.intent).toBe("clinic_search");

      const res2 = classifyIntent("Where is the nearest clinic?");
      expect(res2.intent).toBe("clinic_search");

      const res3 = classifyIntent("I need an emergency room in Kumasi");
      expect(res3.intent).toBe("clinic_search");
    });

    it("strictly prioritizes emergency rules over clinic search when severe symptoms present", () => {
      // Even if user mentions "hospital", severe chest pain must trigger emergency_assistance immediately
      const emergencyQuery = "I need a hospital my chest hurts so badly and I can't breathe";
      const emergencyCheck = checkEmergencyRules({ text: emergencyQuery, symptoms: emergencyQuery });
      expect(emergencyCheck.emergencyDetected).toBe(true);

      const classified = classifyIntent(emergencyQuery);
      expect(classified.intent).toBe("emergency_assistance");
    });
  });
});
