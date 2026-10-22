import mongoose, { Schema, Document, Model } from "mongoose";

export type MedicationFeedbackType =
  | "incorrect_information"
  | "missing_warning"
  | "dosage_discrepancy"
  | "side_effect_update"
  | "general_feedback";

export interface IMedicationFeedback extends Document {
  medicationId: string;
  medicationName: string;
  feedbackType: MedicationFeedbackType;
  details: string;
  contactEmail?: string;
  userId?: mongoose.Types.ObjectId;
  status: "submitted" | "under_review" | "resolved";
  createdAt: Date;
  updatedAt: Date;
}

const MedicationFeedbackSchema = new Schema<IMedicationFeedback>(
  {
    medicationId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    medicationName: {
      type: String,
      required: true,
      trim: true,
    },
    feedbackType: {
      type: String,
      enum: [
        "incorrect_information",
        "missing_warning",
        "dosage_discrepancy",
        "side_effect_update",
        "general_feedback",
      ],
      required: true,
    },
    details: {
      type: String,
      required: true,
      maxlength: 2000,
      trim: true,
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
    status: {
      type: String,
      enum: ["submitted", "under_review", "resolved"],
      default: "submitted",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const MedicationFeedback: Model<IMedicationFeedback> =
  mongoose.models.MedicationFeedback ||
  mongoose.model<IMedicationFeedback>("MedicationFeedback", MedicationFeedbackSchema);

export default MedicationFeedback;
