import mongoose, { Schema, Document, Model } from "mongoose";

export interface IEmergencyConfiguration extends Document {
  countryCode: string;
  countryName: string;
  emergencyNumber: string;
  serviceName: string;
  isVerified: boolean;
  lastVerifiedAt: Date;
  notes?: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EmergencyConfigurationSchema = new Schema<IEmergencyConfiguration>(
  {
    countryCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    countryName: {
      type: String,
      required: true,
      trim: true,
    },
    emergencyNumber: {
      type: String,
      required: true,
      trim: true,
    },
    serviceName: {
      type: String,
      required: true,
      trim: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
      required: true,
    },
    lastVerifiedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    notes: {
      type: String,
      required: false,
    },
    enabled: {
      type: Boolean,
      default: true,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const EmergencyConfiguration: Model<IEmergencyConfiguration> =
  mongoose.models.EmergencyConfiguration ||
  mongoose.model<IEmergencyConfiguration>(
    "EmergencyConfiguration",
    EmergencyConfigurationSchema
  );

export default EmergencyConfiguration;
