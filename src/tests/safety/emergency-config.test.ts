import { describe, it, expect } from "vitest";
import {
  getEmergencyConfiguration,
  getAllBundledEmergencyConfigurations,
} from "@/lib/emergency/emergency-config";

describe("Emergency Configuration - Fallback & Verification", () => {
  it("returns Ghana 112 as the verified default emergency number", async () => {
    const config = await getEmergencyConfiguration();
    expect(config.countryCode).toBe("GH");
    expect(config.emergencyNumber).toBe("112");
    expect(config.serviceName).toContain("National Ambulance Service");
    expect(config.isVerified).toBe(true);
  });

  it("resolves bundled configurations for other supported countries", async () => {
    const ukConfig = await getEmergencyConfiguration("GB");
    expect(ukConfig.emergencyNumber).toBe("999");
    expect(ukConfig.countryName).toBe("United Kingdom");

    const usConfig = await getEmergencyConfiguration("US");
    expect(usConfig.emergencyNumber).toBe("911");

    const ngConfig = await getEmergencyConfiguration("NG");
    expect(ngConfig.emergencyNumber).toBe("112");
  });

  it("safely falls back to Ghana (112) when given an unknown country code", async () => {
    const unknownConfig = await getEmergencyConfiguration("ZZ");
    expect(unknownConfig.countryCode).toBe("GH");
    expect(unknownConfig.emergencyNumber).toBe("112");
  });

  it("bundled configurations list is non-empty and every entry has valid verified phone numbers", () => {
    const all = getAllBundledEmergencyConfigurations();
    expect(all.length).toBeGreaterThanOrEqual(5);

    for (const item of all) {
      expect(item.countryCode).toMatch(/^[A-Z]{2}$/);
      expect(item.emergencyNumber).toMatch(/^[0-9]{3,4}$/);
      expect(item.isVerified).toBe(true);
      expect(item.serviceName).toBeTruthy();
    }
  });
});
