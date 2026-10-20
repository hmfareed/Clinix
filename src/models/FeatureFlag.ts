import mongoose, { Schema, Document, Model } from "mongoose";

export interface IFeatureFlag extends Document {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const FeatureFlagSchema = new Schema<IFeatureFlag>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    enabled: {
      type: Boolean,
      default: true,
      required: true,
    },
    updatedBy: {
      type: String,
      default: "system",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const FeatureFlag: Model<IFeatureFlag> =
  mongoose.models.FeatureFlag ||
  mongoose.model<IFeatureFlag>("FeatureFlag", FeatureFlagSchema);

export default FeatureFlag;
