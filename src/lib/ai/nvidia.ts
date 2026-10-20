import OpenAI from "openai";

export const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
export const DEFAULT_MODEL = "meta/llama-3.2-11b-vision-instruct";
export const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 90000;

export class AssessmentUnavailableError extends Error {
  public readonly code = "AI_UNAVAILABLE";
  public readonly safeAction =
    "If you have severe, acute, or worsening symptoms, call 112 immediately or visit the nearest healthcare facility.";

  constructor(message = "We couldn't complete the AI assessment right now.", public readonly cause?: unknown) {
    super(message);
    this.name = "AssessmentUnavailableError";
  }
}

export function isNvidiaConfigured(): boolean {
  return Boolean(process.env.NVIDIA_API_KEY && process.env.NVIDIA_API_KEY.trim() !== "");
}

export function getNvidiaClient(): OpenAI {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    throw new AssessmentUnavailableError("NVIDIA_API_KEY is not configured on the server.");
  }

  return new OpenAI({
    apiKey,
    baseURL: NVIDIA_BASE_URL,
    timeout: AI_TIMEOUT_MS,
    maxRetries: 0, // Controlled retries handled by our AssessmentService
  });
}

export const MODEL = process.env.NVIDIA_MODEL || DEFAULT_MODEL;
export const FALLBACK_MODEL = process.env.NVIDIA_FALLBACK_MODEL || "meta/llama-3.2-90b-vision-instruct";
