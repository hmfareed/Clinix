import mongoose, { Schema, Document, Model } from "mongoose";
import { ApprovedMedication } from "@/lib/medication/types";

export interface IMedicalReference extends Document {
  referenceId: string;
  medication: ApprovedMedication;
  source: string;
  sourceUrl?: string;
  jurisdiction: string;
  version: string;
  reviewStatus: "approved" | "pending_review" | "deprecated";
  reviewedBy: string;
  lastReviewedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MedicalReferenceSchema = new Schema<IMedicationReferenceDoc>(
  {
    referenceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    medication: {
      id: { type: String, required: true },
      genericName: { type: String, required: true, index: true },
      brandNames: [{ type: String, index: true }],
      therapeuticClass: { type: String, required: true },
      classification: {
        type: String,
        enum: ["over_the_counter", "prescription_only", "pharmacist_only"],
        required: true,
      },
      approvedIndications: [{ type: String }],
      contraindications: [
        {
          condition: { type: String, required: true },
          explanation: { type: String, required: true },
          severity: { type: String, enum: ["critical", "warning"], required: true },
        },
      ],
      ageRestrictions: {
        minAgeYears: { type: Number },
        maxAgeYears: { type: Number },
        warning: { type: String },
      },
      pregnancyPrecautions: {
        isContraindicated: { type: Boolean, required: true },
        warning: { type: String, required: true },
      },
      interactions: [
        {
          medicineOrClass: { type: String, required: true },
          effect: { type: String, required: true },
          severity: { type: String, enum: ["major", "moderate"], required: true },
        },
      ],
      commonSideEffects: [{ type: String }],
      administrationWarnings: [{ type: String }],
      dosageDisclaimer: { type: String, required: true },
      referenceSource: {
        name: { type: String, required: true },
        jurisdiction: { type: String, required: true },
        version: { type: String, required: true },
        sourceUrl: { type: String },
        lastReviewedAt: { type: String, required: true },
        reviewedBy: { type: String, required: true },
      },
    },
    source: {
      type: String,
      required: true,
      trim: true,
    },
    sourceUrl: {
      type: String,
      trim: true,
    },
    jurisdiction: {
      type: String,
      required: true,
      default: "GH",
      index: true,
    },
    version: {
      type: String,
      required: true,
    },
    reviewStatus: {
      type: String,
      enum: ["approved", "pending_review", "deprecated"],
      default: "approved",
      required: true,
      index: true,
    },
    reviewedBy: {
      type: String,
      required: true,
    },
    lastReviewedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for quick jurisdiction-approved lookups
MedicalReferenceSchema.index({ jurisdiction: 1, reviewStatus: 1 });

type IMedicationReferenceDoc = IMedicalReference;

export const MedicalReference: Model<IMedicalReference> =
  mongoose.models.MedicalReference ||
  mongoose.model<IMedicalReference>("MedicalReference", MedicalReferenceSchema);
