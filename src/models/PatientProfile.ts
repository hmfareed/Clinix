import mongoose, { Schema, Document, Model } from "mongoose";
import { TriState } from "@/lib/safety/types";
import { PregnancyStatus } from "@/lib/medication/types";

export interface IPatientProfile extends Document {
  userId: mongoose.Types.ObjectId;
  ageYears?: number;
  allergies: {
    status: TriState;
    items: string[];
  };
  currentMedicines: {
    status: TriState;
    items: string[];
  };
  pregnancy: PregnancyStatus;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const PatientProfileSchema = new Schema<IPatientProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    ageYears: {
      type: Number,
      min: 0,
      max: 125,
      required: false,
    },
    allergies: {
      status: {
        type: String,
        enum: ["yes", "no", "unknown"],
        default: "unknown",
        required: true,
      },
      items: {
        type: [String],
        default: [],
      },
    },
    currentMedicines: {
      status: {
        type: String,
        enum: ["yes", "no", "unknown"],
        default: "unknown",
        required: true,
      },
      items: {
        type: [String],
        default: [],
      },
    },
    pregnancy: {
      type: String,
      enum: ["yes", "no", "unknown", "not_applicable"],
      default: "unknown",
      required: true,
    },
    emergencyContact: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      relationship: { type: String, trim: true },
    },
  },
  {
    timestamps: true,
  }
);

export const PatientProfile: Model<IPatientProfile> =
  mongoose.models.PatientProfile ||
  mongoose.model<IPatientProfile>("PatientProfile", PatientProfileSchema);

export default PatientProfile;
