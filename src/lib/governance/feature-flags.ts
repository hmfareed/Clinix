import { connectToDatabase } from "@/lib/db/mongodb";
import FeatureFlag, { IFeatureFlag } from "@/models/FeatureFlag";

export const DEFAULT_FEATURE_FLAGS = [
  {
    key: "ai_assessment_enabled",
    name: "AI Symptom Assessment Engine",
    description: "Enables LLM inference via NVIDIA NIM API for conversational triage.",
    enabled: true,
  },
  {
    key: "medication_module_enabled",
    name: "Medication Reference Module",
    description: "Enables approved medication search, indications, and interaction queries.",
    enabled: true,
  },
  {
    key: "facility_search_enabled",
    name: "Care Navigation & Facility Search",
    description: "Enables Ghana healthcare provider geolocation directory and clinic search.",
    enabled: true,
  },
  {
    key: "emergency_dialer_enabled",
    name: "Emergency Dialer Direct Action",
    description: "Enables persistent emergency button and sub-500ms 112 dialing links.",
    enabled: true,
  },
];

// In-memory cache with 15-second TTL to avoid query overhead on high-throughput routes
let flagCache: Record<string, { enabled: boolean; expiresAt: number }> = {};

export async function isFeatureEnabled(key: string): Promise<boolean> {
  const now = Date.now();
  const cached = flagCache[key];

  if (cached && cached.expiresAt > now) {
    return cached.enabled;
  }

  try {
    const dbPromise = (async () => {
      await connectToDatabase();
      const flag = await FeatureFlag.findOne({ key }).lean();
      return flag ? flag.enabled : true;
    })();

    // 400ms race against fallback
    const timeoutPromise = new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 400));
    const enabled = await Promise.race([dbPromise, timeoutPromise]);

    flagCache[key] = {
      enabled,
      expiresAt: now + 15000,
    };

    return enabled;
  } catch {
    // If DB is offline, fall back to default enabled
    const defaultEntry = DEFAULT_FEATURE_FLAGS.find((f) => f.key === key);
    return defaultEntry ? defaultEntry.enabled : true;
  }
}

export async function setFeatureFlag(
  key: string,
  enabled: boolean,
  updatedBy: string
): Promise<void> {
  // Update in-memory cache immediately
  flagCache[key] = {
    enabled,
    expiresAt: Date.now() + 60000,
  };

  try {
    const dbPromise = (async () => {
      await connectToDatabase();
      const defaultMeta = DEFAULT_FEATURE_FLAGS.find((f) => f.key === key);
      await FeatureFlag.findOneAndUpdate(
        { key },
        {
          $set: {
            enabled,
            updatedBy,
            name: defaultMeta?.name || key,
            description: defaultMeta?.description || "Runtime feature kill switch",
          },
        },
        { upsert: true }
      );
    })();

    const timeoutPromise = new Promise<void>((resolve) => setTimeout(() => resolve(), 300));
    await Promise.race([dbPromise, timeoutPromise]);
  } catch {
    // in-memory flag remains active
  }
}

export async function getAllFeatureFlags() {
  try {
    await connectToDatabase();
    const flags = await FeatureFlag.find({}).lean();
    const flagMap = new Map(flags.map((f) => [f.key, f]));

    return DEFAULT_FEATURE_FLAGS.map((df) => {
      const dbFlag = flagMap.get(df.key);
      return {
        key: df.key,
        name: df.name,
        description: df.description,
        enabled: dbFlag ? dbFlag.enabled : df.enabled,
        updatedBy: dbFlag?.updatedBy || "system",
        updatedAt: dbFlag?.updatedAt || new Date(),
      };
    });
  } catch {
    return DEFAULT_FEATURE_FLAGS.map((df) => ({
      ...df,
      updatedBy: "system",
      updatedAt: new Date(),
    }));
  }
}

export function clearFeatureFlagCache() {
  flagCache = {};
}
