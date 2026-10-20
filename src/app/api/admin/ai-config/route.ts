import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminAuth } from "@/lib/auth/rbac";
import { connectToDatabase } from "@/lib/db/mongodb";
import AiModelConfig from "@/models/AiModelConfig";
import { logAuditEvent } from "@/lib/audit/audit";
import { MODEL } from "@/lib/ai/nvidia";
import { PROMPT_VERSION_V1 } from "@/lib/ai/prompts";

const updateAiConfigSchema = z.object({
  activeModelId: z.string().min(3).max(100).optional(),
  activePromptVersion: z.string().min(3).max(50).optional(),
  fallbackModelId: z.string().min(3).max(100).optional(),
  temperature: z.number().min(0).max(1).optional(),
  status: z.enum(["active", "shadow_testing", "deprecated"]).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAdminAuth();
    if (!authResult.authorized) {
      return authResult.response;
    }

    await connectToDatabase();
    let config = await AiModelConfig.findOne({ configKey: "active_triage_model" }).lean();

    if (!config) {
      // Create baseline record if none exists
      config = await AiModelConfig.create({
        configKey: "active_triage_model",
        activeModelId: MODEL,
        activePromptVersion: PROMPT_VERSION_V1,
        fallbackModelId: "meta/llama-3.1-8b-instruct",
        temperature: 0,
        maxTokens: 1024,
        evalPassRate: 100,
        missedEmergenciesCount: 0,
        status: "active",
        updatedBy: "system_admin",
      });
    }

    return NextResponse.json({
      success: true,
      data: config,
      availableModels: [
        { id: "meta/llama-3.1-70b-instruct", name: "Llama 3.1 70B Instruct (Current Active)", recommended: true },
        { id: "meta/llama-3.1-8b-instruct", name: "Llama 3.1 8B Instruct (Lightweight / Fallback)", recommended: false },
        { id: "mistralai/mixtral-8x7b-instruct-v0.1", name: "Mixtral 8x7B (Candidate)", recommended: false },
      ],
      availablePrompts: [
        { version: "assessment-v1", status: "production_approved" },
        { version: "assessment-v2-draft", status: "under_evaluation" },
      ],
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

    console.error("[AiConfigGET] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to load AI configuration." } },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authResult = await requireAdminAuth(["clinical_reviewer", "system_admin"]);
    if (!authResult.authorized) {
      return authResult.response;
    }

    const body = await req.json();
    const parseResult = updateAiConfigSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_FAILED", message: "Invalid AI config parameters.", details: parseResult.error.flatten().fieldErrors } },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const updateFields: Record<string, unknown> = {
      updatedBy: authResult.user.email,
    };
    const { activeModelId, activePromptVersion, fallbackModelId, temperature, status } = parseResult.data;

    if (activeModelId !== undefined) updateFields.activeModelId = activeModelId;
    if (activePromptVersion !== undefined) updateFields.activePromptVersion = activePromptVersion;
    if (fallbackModelId !== undefined) updateFields.fallbackModelId = fallbackModelId;
    if (temperature !== undefined) updateFields.temperature = temperature;
    if (status !== undefined) updateFields.status = status;

    const updated = await AiModelConfig.findOneAndUpdate(
      { configKey: "active_triage_model" },
      { $set: updateFields },
      { upsert: true, new: true }
    );

    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
    await logAuditEvent({
      actorId: authResult.user.id,
      actorRole: authResult.user.role,
      action: "ai_model_config_updated",
      resourceType: "AiModelConfig",
      resourceId: "active_triage_model",
      outcome: "success",
      ip: clientIp,
      metadata: updateFields,
    });

    return NextResponse.json({
      success: true,
      message: "AI configuration and prompt version updated.",
      data: updated,
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

    console.error("[AiConfigPATCH] Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to update AI configuration." } },
      { status: 500 }
    );
  }
}
