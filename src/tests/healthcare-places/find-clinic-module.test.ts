import { describe, it, expect } from "vitest";
import { calculateHaversineDistanceMeters, formatDistance, formatStraightLineDistance } from "@/lib/healthcare-places/distance";
import { defaultVerifiedDirectoryProvider } from "@/lib/healthcare-places/verified-directory-provider";
import { defaultHealthcarePlacesService } from "@/lib/healthcare-places/places-service";
import { defaultGeocodeService } from "@/lib/healthcare-places/geocode-service";
import { defaultAssistantService } from "@/services/clinix-assistant-service";
import { classifyIntent } from "@/lib/assistant/intent-classifier";
import { checkEmergencyRules } from "@/lib/safety/triage-engine";
import { POST as nearbyHandler } from "@/app/api/v1/healthcare/nearby/route";
import { POST as geocodeHandler } from "@/app/api/v1/healthcare/geocode/route";
import { NextRequest } from "next/server";

describe("Find Clinic Module & Healthcare Discovery", () => {
  describe("Location Handling, Distance & Geocoding", () => {
    it("computes accurate straight-line distance between two points", () => {
      // Accra Central (5.556, -0.1969) to Kotoka Airport Area (5.6025, -0.1837)
      const distMeters = calculateHaversineDistanceMeters(5.556, -0.1969, 5.6025, -0.1837);
      expect(distMeters).toBeGreaterThan(4500);
      expect(distMeters).toBeLessThan(6000);
    });

    it("clearly labels straight-line distance separately from driving distance", () => {
      expect(formatStraightLineDistance(450)).toBe("~450 m (straight-line)");
      expect(formatStraightLineDistance(2500)).toBe("~2.5 km (straight-line)");
      expect(formatStraightLineDistance(undefined)).toBe("Distance unknown");
    });

    it("resolves manual town and neighbourhood queries via geocode service", async () => {
      const accra = await defaultGeocodeService.geocode({ query: "Accra" });
      expect(accra).not.toBeNull();
      expect(accra!.latitude).toBeCloseTo(5.556, 2);

      const kumasi = await defaultGeocodeService.geocode({ query: "Kumasi" });
      expect(kumasi).not.toBeNull();
      expect(kumasi!.latitude).toBeCloseTo(6.6885, 2);

      const cantonments = await defaultGeocodeService.geocode({ query: "Cantonments" });
      expect(cantonments).not.toBeNull();
      expect(cantonments!.displayName).toContain("Cantonments");
    });
  });

  describe("Facility Filtering & Specialty Discovery", () => {
    it("filters facilities strictly by specialist type", async () => {
      const results = await defaultHealthcarePlacesService.searchNearby({
        latitude: 5.556,
        longitude: -0.1969,
        radiusMeters: 10000,
        facilityTypes: "specialist",
      });

      expect(results.facilities.length).toBeGreaterThan(0);
      for (const fac of results.facilities) {
        expect(fac.facilityType).toBe("specialist");
      }
      const names = results.facilities.map((f) => f.name);
      expect(names.some((n) => n.includes("Cardiothoracic") || n.includes("Eye") || n.includes("Specialist"))).toBe(true);
    });

    it("filters facilities by hospital, clinic, and pharmacy", async () => {
      const hospitals = await defaultHealthcarePlacesService.searchNearby({
        latitude: 5.556,
        longitude: -0.1969,
        radiusMeters: 10000,
        facilityTypes: "hospital",
      });
      expect(hospitals.facilities.length).toBeGreaterThan(0);
      expect(hospitals.facilities.every((f) => f.facilityType === "hospital")).toBe(true);

      const pharmacies = await defaultHealthcarePlacesService.searchNearby({
        latitude: 5.556,
        longitude: -0.1969,
        radiusMeters: 10000,
        facilityTypes: "pharmacy",
      });
      expect(pharmacies.facilities.length).toBeGreaterThan(0);
      expect(pharmacies.facilities.every((f) => f.facilityType === "pharmacy")).toBe(true);
    });

    it("supports search by specialty and clinical keywords", async () => {
      const cardiacSearch = await defaultHealthcarePlacesService.searchNearby({
        latitude: 5.556,
        longitude: -0.1969,
        radiusMeters: 15000,
        query: "Cardiology",
      });

      expect(cardiacSearch.facilities.length).toBeGreaterThan(0);
      const cardiacFac = cardiacSearch.facilities[0];
      const matches =
        cardiacFac.name.toLowerCase().includes("cardio") ||
        cardiacFac.services?.some((s) => s.toLowerCase().includes("cardio"));
      expect(matches).toBe(true);
    });
  });

  describe("Radius Selector & Proximity Ordering", () => {
    it("respects tight 1 km radius vs wider 10 km radius", async () => {
      // 1 km search around Korle Bu (5.5375, -0.2289)
      const tightSearch = await defaultHealthcarePlacesService.searchNearby({
        latitude: 5.5375,
        longitude: -0.2289,
        radiusMeters: 1000,
      });

      // 10 km search around Korle Bu
      const wideSearch = await defaultHealthcarePlacesService.searchNearby({
        latitude: 5.5375,
        longitude: -0.2289,
        radiusMeters: 10000,
      });

      expect(wideSearch.facilities.length).toBeGreaterThan(tightSearch.facilities.length);
      for (const fac of tightSearch.facilities) {
        expect(fac.distanceMeters).toBeLessThanOrEqual(1000);
      }
    });

    it("clamps out-of-bounds radius strictly to provider limit of 25,000 m", async () => {
      const clamped = await defaultHealthcarePlacesService.searchNearby({
        latitude: 5.556,
        longitude: -0.1969,
        radiusMeters: 80000,
      });
      expect(clamped.radiusMeters).toBe(25000);
    });

    it("orders returned facilities strictly ascending by straight-line distance", async () => {
      const res = await defaultHealthcarePlacesService.searchNearby({
        latitude: 5.556,
        longitude: -0.1969,
        radiusMeters: 15000,
      });

      for (let i = 1; i < res.facilities.length; i++) {
        expect(res.facilities[i].distanceMeters!).toBeGreaterThanOrEqual(
          res.facilities[i - 1].distanceMeters!
        );
      }
    });
  });

  describe("Data Integrity & Non-Fabrication of Healthcare Details", () => {
    it("preserves verified phone numbers and marks phone verification", async () => {
      const res = await defaultHealthcarePlacesService.searchNearby({
        latitude: 5.556,
        longitude: -0.1969,
        radiusMeters: 8000,
      });

      const korleBu = res.facilities.find((f) => f.name.includes("Korle Bu"));
      expect(korleBu).toBeDefined();
      expect(korleBu?.phoneNumber).toBe("+233302665401");
      expect(korleBu?.phoneVerified).toBe(true);
      expect(korleBu?.mapsUrl).toContain("destination=5.5375,-0.2289");
    });

    it("does not fabricate online appointment booking when unverified", async () => {
      const res = await defaultHealthcarePlacesService.searchNearby({
        latitude: 5.556,
        longitude: -0.1969,
        radiusMeters: 8000,
      });

      for (const fac of res.facilities) {
        // Must never claim appointment booking is active unless verified
        expect(fac.appointmentBooking?.available).toBe(false);
      }
    });
  });

  describe("Privacy Guardrails & API Validation", () => {
    it("blocks geolocation search requests containing sensitive clinical/symptom text", async () => {
      const req = new NextRequest("http://localhost/api/v1/healthcare/nearby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: 5.556,
          longitude: -0.1969,
          radiusMeters: 5000,
          symptoms: "I have severe fever and cough",
        }),
      });

      const res = await nearbyHandler(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error.code).toBe("PRIVACY_GUARDRAIL_TRIGGERED");
    });

    it("validates coordinates and rejects invalid coordinates", async () => {
      const req = new NextRequest("http://localhost/api/v1/healthcare/nearby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          latitude: 999, // Invalid latitude
          longitude: -0.1969,
        }),
      });

      const res = await nearbyHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("VALIDATION_FAILED");
    });
  });

  describe("AI Assistant Integration & Shared Directory Service", () => {
    const testUserId = "507f1f77bcf86cd799439011";

    it("routes conversational clinic requests to the shared healthcare places service", async () => {
      const conv = await defaultAssistantService.createConversation({
        authContext: { userId: testUserId },
      });
      const convId = String(conv._id);

      const result = await defaultAssistantService.processPatientMessage({
        conversationId: convId,
        message: "Can you find a clinic near Osu?",
        authContext: { userId: testUserId },
      });

      expect(result.intent).toBe("clinic_search");
      expect(result.response.message).toContain("verified healthcare facilities");
      expect(result.response.facilityResults).toBeDefined();
      expect(result.response.facilityResults!.length).toBeGreaterThan(0);

      // Verify actions include navigation to clinics page
      const hasClinicAction = result.response.actions.some((a) => a.target === "/clinics");
      expect(hasClinicAction).toBe(true);
    });

    it("strictly halts facility discovery if user reports acute emergency symptoms", async () => {
      const emergencyMessage = "I need a hospital my chest feels crushed and I can't breathe";
      const emergencyCheck = checkEmergencyRules({ text: emergencyMessage, symptoms: emergencyMessage });
      expect(emergencyCheck.emergencyDetected).toBe(true);

      const conv = await defaultAssistantService.createConversation({
        authContext: { userId: testUserId },
      });
      const convId = String(conv._id);

      const result = await defaultAssistantService.processPatientMessage({
        conversationId: convId,
        message: emergencyMessage,
        authContext: { userId: testUserId },
      });

      // Clinical emergency gate must take precedence over routine clinic lookup
      expect(result.intent).toBe("emergency_assistance");
      expect(result.response.safety.urgentPathwayTriggered).toBe(true);
      expect(result.response.actions.some((a) => a.type === "call")).toBe(true);
    });
  });
});
