import mongoose, { Schema, Document, Model } from "mongoose";
import { UrgencyTier } from "@/lib/safety/types";

export type AssessmentStatus =
  | "draft"
  | "collecting_information"
  | "screening"
  | "ready_for_review"
  | "completed"
  | "escalated"
  | "failed";

export interface IAssessment extends Document {
  patientId: mongoose.Types.ObjectId;
  sessionId?: mongoose.Types.ObjectId;
  conversationId?: mongoose.Types.ObjectId;
  status: AssessmentStatus;
  isDraft: boolean;
  lastSavedAt?: Date;

  patientInfo?: {
    age?: number;
    gender?: string;
    pregnancy?: "yes" | "no" | "unknown" | "not_applicable";
  };

  primaryComplaint?: {
    symptom: string;
    affectedArea?: string;
    onset?: "sudden" | "gradual" | "not_sure";
    duration?: "started_today" | "since_yesterday" | "several_days" | "several_weeks_or_longer";
    severity?: "mild" | "moderate" | "severe";
  };

  symptomHistory?: {
    progression?: string;
    associatedSymptoms?: string[];
    triggers?: string;
    previousEpisodes?: string;
  };

  medicalHistory?: {
    conditions?: string[];
    allergies?: { status: "yes" | "no" | "unknown"; items?: string[] };
    currentMedications?: { status: "yes" | "no" | "unknown"; items?: string[] };
    previousTreatments?: string;
  };

  reportedFacts?: {
    known: Array<{
      label: string;
      value: string;
      source: "patient" | "conversation" | "inferred";
    }>;
    unknown: Array<{
      label: string;
      reason?: string;
    }>;
  };

  interviewProgress?: {
    currentStep: number;
    pathway?: string;
    answeredQuestions: Array<{
      questionId: string;
      questionText: string;
      answerText: string;
      answeredAt: Date;
    }>;
    currentQuestion?: {
      id: string;
      text: string;
      type: "single_choice" | "multiple_choice" | "free_text";
      options?: string[];
      category?: string;
    } | null;
  };

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
    suggestedOTCDrugs?: Array<{
      name: string;
      purpose: string;
      warning: string;
    }>;
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
    ruleSetVersion?: string;
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
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "AssistantConversation",
      required: false,
      index: true,
    },
    status: {
      type: String,
      enum: [
        "draft",
        "collecting_information",
        "screening",
        "ready_for_review",
        "completed",
        "escalated",
        "failed",
      ],
      default: "completed",
      required: true,
      index: true,
    },
    isDraft: {
      type: Boolean,
      default: false,
      index: true,
    },
    lastSavedAt: {
      type: Date,
    },
    patientInfo: {
      age: { type: Number },
      gender: { type: String },
      pregnancy: { type: String, enum: ["yes", "no", "unknown", "not_applicable"] },
    },
    primaryComplaint: {
      symptom: { type: String },
      affectedArea: { type: String },
      onset: { type: String, enum: ["sudden", "gradual", "not_sure"] },
      duration: {
        type: String,
        enum: ["started_today", "since_yesterday", "several_days", "several_weeks_or_longer"],
      },
      severity: { type: String, enum: ["mild", "moderate", "severe"] },
    },
    symptomHistory: {
      progression: { type: String },
      associatedSymptoms: [{ type: String }],
      triggers: { type: String },
      previousEpisodes: { type: String },
    },
    medicalHistory: {
      conditions: [{ type: String }],
      allergies: {
        status: { type: String, enum: ["yes", "no", "unknown"], default: "unknown" },
        items: [{ type: String }],
      },
      currentMedications: {
        status: { type: String, enum: ["yes", "no", "unknown"], default: "unknown" },
        items: [{ type: String }],
      },
      previousTreatments: { type: String },
    },
    reportedFacts: {
      known: [
        {
          label: { type: String, required: true },
          value: { type: String, required: true },
          source: { type: String, enum: ["patient", "conversation", "inferred"], default: "patient" },
        },
      ],
      unknown: [
        {
          label: { type: String, required: true },
          reason: { type: String },
        },
      ],
    },
    interviewProgress: {
      currentStep: { type: Number, default: 1 },
      pathway: { type: String },
      answeredQuestions: [
        {
          questionId: { type: String, required: true },
          questionText: { type: String, required: true },
          answerText: { type: String, required: true },
          answeredAt: { type: Date, default: Date.now },
        },
      ],
      currentQuestion: {
        id: { type: String },
        text: { type: String },
        type: { type: String },
        options: [{ type: String }],
        category: { type: String },
      },
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
      suggestedOTCDrugs: [
        {
          name: { type: String },
          purpose: { type: String },
          warning: { type: String },
        },
      ],
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
AssessmentSchema.index({ patientId: 1, isDraft: 1, updatedAt: -1 });

export const Assessment: Model<IAssessment> =
  mongoose.models.Assessment ||
  mongoose.model<IAssessment>("Assessment", AssessmentSchema);

export default Assessment;
