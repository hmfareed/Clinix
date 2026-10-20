import mongoose, { Schema, Document, Model } from "mongoose";
import { UrgencyTier } from "@/lib/safety/types";

export interface IAssessment extends Document {
  patientId: mongoose.Types.ObjectId;
  sessionId?: mongoose.Types.ObjectId;
  symptoms: Array<{
    description: string;
    onset?: string;
    severity?: string;
  }>;
  urgency: UrgencyTier;
  summary: string;
  possibleConditions: Array<{
    name: string;
    explanation: string;
    supportingSymptoms: string[];
    missingInformation: string[];
  }>;
  recommendations: string[];
  limitations: string[];
  medicationGuidance?: {
    available: boolean;
    explanation: string;
    requiresProfessionalReview: boolean;
  };
  triage: {
    level: string;
    ruleSetVersion: string;
    checkedAt: Date;
  };
  aiMetadata: {
    provider: string;
    model: string;
    promptVersion: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const AssessmentSchema = new Schema<IAssessment>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "AssessmentSession",
      required: false,
    },
    symptoms: [
      {
        description: { type: String, required: true },
        onset: { type: String },
        severity: { type: String },
      },
    ],
    urgency: {
      type: String,
      enum: ["emergency", "urgent", "routine", "self_care_eligible", "insufficient_information"],
      required: true,
    },
    summary: {
      type: String,
      required: true,
    },
    possibleConditions: [
      {
        name: { type: String, required: true },
        explanation: { type: String, required: true },
        supportingSymptoms: [{ type: String }],
        missingInformation: [{ type: String }],
      },
    ],
    recommendations: [{ type: String }],
    limitations: [{ type: String }],
    medicationGuidance: {
      available: { type: Boolean, default: false },
      explanation: { type: String },
      requiresProfessionalReview: { type: Boolean, default: true },
    },
    triage: {
      level: { type: String, required: true },
      ruleSetVersion: { type: String, required: true },
      checkedAt: { type: Date, default: Date.now },
    },
    aiMetadata: {
      provider: { type: String, default: "NVIDIA" },
      model: { type: String, default: "configured-model-id" },
      promptVersion: { type: String, default: "assessment-v1" },
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying a patient's assessments sorted by date
AssessmentSchema.index({ patientId: 1, createdAt: -1 });

export const Assessment: Model<IAssessment> =
  mongoose.models.Assessment ||
  mongoose.model<IAssessment>("Assessment", AssessmentSchema);

export default Assessment;
