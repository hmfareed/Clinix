import { describe, it, expect } from "vitest";
import { defaultGhanaDirectoryProvider } from "@/lib/maps/ghana-directory-provider";
import { defaultFacilityService } from "@/lib/maps/facility-service";
import { calculateHaversineDistanceKm } from "@/lib/maps/distance";

describe("Care Navigation - Distance Calculation", () => {
  it("calculates accurate Haversine distance between two points", () => {
    // Distance between Accra (5.556, -0.1969) and Tema (5.6698, -0.0166) is approx 23-24 km
    const dist = calculateHaversineDistanceKm(5.556, -0.1969, 5.6698, -0.0166);
    expect(dist).toBeGreaterThan(20);
    expect(dist).toBeLessThan(26);
  });

  it("calculates zero distance for identical coordinates", () => {
    const dist = calculateHaversineDistanceKm(5.556, -0.1969, 5.556, -0.1969);
    expect(dist).toBe(0);
  });
});

describe("Care Navigation - Ghana Directory Provider", () => {
  it("searches facilities by coordinate proximity and returns sorted results", async () => {
    // Patient near Airport Residential, Accra (5.60, -0.18)
    const results = await defaultGhanaDirectoryProvider.searchFacilities({
      lat: 5.60,
      lng: -0.18,
      limit: 5,
    });

    expect(results.length).toBeGreaterThan(0);
    // Nearest should be Nyaho Medical Centre or Ernest Chemists Airport
    expect(["gh-accra-nyaho-04", "gh-accra-mct-pharmacy-05"]).toContain(results[0].providerId);
    expect(results[0].distanceKm).toBeDefined();

    // Verify results are sorted ascending by distance
    for (let i = 1; i < results.length; i++) {
      expect(results[i].distanceKm!).toBeGreaterThanOrEqual(results[i - 1].distanceKm!);
    }
  });

  it("filters facilities by facility type (emergency_department)", async () => {
    const results = await defaultGhanaDirectoryProvider.searchFacilities({
      type: "emergency_department",
    });

    expect(results.length).toBeGreaterThanOrEqual(3);
    for (const f of results) {
      expect(f.type).toBe("emergency_department");
    }
  });

  it("filters facilities by facility type (pharmacy)", async () => {
    const results = await defaultGhanaDirectoryProvider.searchFacilities({
      type: "pharmacy",
    });

    expect(results.length).toBeGreaterThanOrEqual(2);
    for (const f of results) {
      expect(f.type).toBe("pharmacy");
    }
  });

  it("searches facilities by regional city name query (Kumasi)", async () => {
    const results = await defaultGhanaDirectoryProvider.searchFacilities({
      query: "Kumasi",
    });

    expect(results.length).toBeGreaterThanOrEqual(2);
    const names = results.map((f) => f.name);
    expect(names.some((n) => n.includes("Komfo Anokye"))).toBe(true);
  });

  it("retrieves facility details by providerId", async () => {
    const facility = await defaultGhanaDirectoryProvider.getFacilityDetails("gh-accra-korlebu-01");
    expect(facility).not.toBeNull();
    expect(facility?.name).toBe("Korle Bu Teaching Hospital");
    expect(facility?.phoneVerified).toBe(true);
    expect(facility?.phone).toBe("+233302665401");
  });

  it("returns null when facility providerId does not exist", async () => {
    const facility = await defaultGhanaDirectoryProvider.getFacilityDetails("non-existent-id");
    expect(facility).toBeNull();
  });
});

describe("Care Navigation - Facility Service Integration", () => {
  it("searches facilities via service with radius filtering", async () => {
    const results = await defaultFacilityService.searchFacilities({
      lat: 5.55,
      lng: -0.20,
      radiusKm: 15,
    });

    expect(results.length).toBeGreaterThan(0);
    for (const f of results) {
      expect(f.source).toBeTruthy();
      expect(f.location.lat).toBeDefined();
      expect(f.location.lng).toBeDefined();
    }
  });
});
