import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAiModelConfig extends Document {
  configKey: string; // e.g. "active_triage_model"
  activeModelId: string;
  activePromptVersion: string;
  fallbackModelId: string;
  temperature: number;
  maxTokens: number;
  lastEvaluatedAt?: Date;
  evalPassRate?: number;
  missedEmergenciesCount: number;
  status: "active" | "shadow_testing" | "deprecated";
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const AiModelConfigSchema = new Schema<IAiModelConfig>(
  {
    configKey: {
      type: String,
      required: true,
      unique: true,
      default: "active_triage_model",
      index: true,
    },
    activeModelId: {
      type: String,
      required: true,
      default: "meta/llama-3.1-70b-instruct",
    },
    activePromptVersion: {
      type: String,
      required: true,
      default: "assessment-v1",
    },
    fallbackModelId: {
      type: String,
      required: true,
      default: "meta/llama-3.1-8b-instruct",
    },
    temperature: {
      type: Number,
      required: true,
      default: 0,
    },
    maxTokens: {
      type: Number,
      required: true,
      default: 1024,
    },
    lastEvaluatedAt: {
      type: Date,
      default: Date.now,
    },
    evalPassRate: {
      type: Number,
      default: 100,
    },
    missedEmergenciesCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["active", "shadow_testing", "deprecated"],
      default: "active",
      required: true,
    },
    updatedBy: {
      type: String,
      default: "clinical_reviewer",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const AiModelConfig: Model<IAiModelConfig> =
  mongoose.models.AiModelConfig ||
  mongoose.model<IAiModelConfig>("AiModelConfig", AiModelConfigSchema);

export default AiModelConfig;
