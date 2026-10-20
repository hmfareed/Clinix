import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import EmergencyConfiguration from "@/models/EmergencyConfiguration";
import fallbackConfigurations from "@/data/emergency-configurations.json";

export interface EmergencyInfo {
  countryCode: string;
  countryName: string;
  emergencyNumber: string;
  serviceName: string;
  isVerified: boolean;
  lastVerifiedAt: string;
  source: "database" | "bundled_fallback";
}

const DEFAULT_COUNTRY = process.env.DEFAULT_COUNTRY || "GH";

export async function getEmergencyConfiguration(
  countryInput?: string | null
): Promise<EmergencyInfo> {
  const code = (countryInput || DEFAULT_COUNTRY).toUpperCase().trim();

  // Try retrieving active config from database with a strict 500ms timeout
  // Emergency numbers must NEVER wait on hanging network/database connections
  if (process.env.NODE_ENV !== "test" || mongoose.connection.readyState === 1) {
    try {
      const dbLookupPromise = async () => {
        await connectToDatabase();
        return EmergencyConfiguration.findOne({
          countryCode: code,
          enabled: true,
        });
      };

      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("Emergency DB query timeout")), 500)
      );

      const dbConfig = await Promise.race([dbLookupPromise(), timeoutPromise]);

      if (dbConfig) {
        return {
          countryCode: dbConfig.countryCode,
          countryName: dbConfig.countryName,
          emergencyNumber: dbConfig.emergencyNumber,
          serviceName: dbConfig.serviceName,
          isVerified: dbConfig.isVerified,
          lastVerifiedAt: dbConfig.lastVerifiedAt.toISOString(),
          source: "database",
        };
      }
    } catch {
      // Database failure or timeout immediately falls back to static bundled configurations
    }
  }

  // Fallback to static bundled JSON
  const bundled = fallbackConfigurations.find((c) => c.countryCode === code);
  if (bundled) {
    return {
      countryCode: bundled.countryCode,
      countryName: bundled.countryName,
      emergencyNumber: bundled.emergencyNumber,
      serviceName: bundled.serviceName,
      isVerified: bundled.isVerified,
      lastVerifiedAt: bundled.lastVerifiedAt,
      source: "bundled_fallback",
    };
  }

  // Final safety fallback: default to Ghana (112)
  const ghanaFallback = fallbackConfigurations.find((c) => c.countryCode === "GH")!;
  return {
    countryCode: ghanaFallback.countryCode,
    countryName: ghanaFallback.countryName,
    emergencyNumber: ghanaFallback.emergencyNumber,
    serviceName: ghanaFallback.serviceName,
    isVerified: ghanaFallback.isVerified,
    lastVerifiedAt: ghanaFallback.lastVerifiedAt,
    source: "bundled_fallback",
  };
}

export function getAllBundledEmergencyConfigurations(): typeof fallbackConfigurations {
  return fallbackConfigurations;
}
