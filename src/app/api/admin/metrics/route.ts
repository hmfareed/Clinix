import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/rbac";
import { connectToDatabase } from "@/lib/db/mongodb";
import Assessment from "@/models/Assessment";
import User from "@/models/User";
import SafetyIncident from "@/models/SafetyIncident";
import TriageRuleSet from "@/models/TriageRuleSet";
import AiModelConfig from "@/models/AiModelConfig";
import { getAllFeatureFlags } from "@/lib/governance/feature-flags";

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAdminAuth();
    if (!authResult.authorized) {
      return authResult.response;
    }

    await connectToDatabase();

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalAssessments,
      todayAssessments,
      urgencyCounts,
      totalPatients,
      incidentStats,
      activeRuleSet,
      aiConfig,
      flags,
    ] = await Promise.all([
      Assessment.countDocuments(),
      Assessment.countDocuments({ createdAt: { $gte: startOfToday } }),
      Assessment.aggregate([
        { $group: { _id: "$urgency", count: { $sum: 1 } } },
      ]),
      User.countDocuments({ role: "patient" }),
      SafetyIncident.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      TriageRuleSet.findOne({ isActive: true }).select("version name reviewedBy reviewedAt").lean(),
      AiModelConfig.findOne({ configKey: "active_triage_model" }).lean(),
      getAllFeatureFlags(),
    ]);

    const urgencyMap: Record<string, number> = {};
    for (const item of urgencyCounts) {
      if (item._id) urgencyMap[item._id] = item.count;
    }

    const incidentMap: Record<string, number> = {};
    for (const item of incidentStats) {
      if (item._id) incidentMap[item._id] = item.count;
    }

    return NextResponse.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        serviceHealth: {
          database: "connected",
          activeAiModel: aiConfig?.activeModelId || "meta/llama-3.1-70b-instruct",
          promptVersion: aiConfig?.activePromptVersion || "assessment-v1",
          activeRuleSetVersion: activeRuleSet?.version || "reviewed-rules-v1",
        },
        usage: {
          totalAssessments,
          todayAssessments,
          totalRegisteredPatients: totalPatients,
          urgencyBreakdown: {
            emergency: urgencyMap["emergency"] || 0,
            urgent: urgencyMap["urgent"] || 0,
            routine: urgencyMap["routine"] || 0,
            self_care_eligible: urgencyMap["self_care_eligible"] || 0,
            insufficient_information: urgencyMap["insufficient_information"] || 0,
          },
        },
        incidents: {
          totalOpen: (incidentMap["reported"] || 0) + (incidentMap["in_review"] || 0) + (incidentMap["action_taken"] || 0),
          breakdown: incidentMap,
        },
        featureFlags: flags.map((f) => ({
          key: f.key,
          name: f.name,
          enabled: f.enabled,
        })),
      },
    });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      (String((error as { digest?: unknown }).digest).includes("PRERENDER") ||
       String((error as { digest?: unknown }).digest).includes("HANGING") ||
       String((error as { digest?: unknown }).digest).includes("DYNAMIC"))
    ) {
      throw error;
    }

    console.error("[AdminMetricsGET] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to compile aggregate metrics." } },
      { status: 500 }
    );
  }
}
