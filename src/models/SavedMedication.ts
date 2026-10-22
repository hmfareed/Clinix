import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISavedMedication extends Document {
  userId: mongoose.Types.ObjectId;
  medicationId: string;
  genericName: string;
  brandName?: string;
  dosageForm?: string;
  strength?: string;
  therapeuticClass?: string;
  classification?: string;
  notes?: string;
  disclaimer: string;
  createdAt: Date;
  updatedAt: Date;
}

const SavedMedicationSchema = new Schema<ISavedMedication>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    medicationId: {
      type: String,
      required: true,
      trim: true,
    },
    genericName: {
      type: String,
      required: true,
      trim: true,
    },
    brandName: {
      type: String,
      trim: true,
    },
    dosageForm: {
      type: String,
      trim: true,
    },
    strength: {
      type: String,
      trim: true,
    },
    therapeuticClass: {
      type: String,
      trim: true,
    },
    classification: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      maxlength: 500,
      trim: true,
    },
    disclaimer: {
      type: String,
      default:
        "This is a personal reference bookmark for educational purposes only. It does not represent an active doctor's prescription or verified dosing regimen.",
    },
  },
  {
    timestamps: true,
  }
);

SavedMedicationSchema.index({ userId: 1, medicationId: 1 }, { unique: true });

export const SavedMedication: Model<ISavedMedication> =
  mongoose.models.SavedMedication ||
  mongoose.model<ISavedMedication>("SavedMedication", SavedMedicationSchema);

export default SavedMedication;
