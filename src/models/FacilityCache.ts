import mongoose, { Schema, Document, Model } from "mongoose";

export interface IFacilityCache extends Document {
  providerId: string;
  name: string;
  type: "hospital" | "clinic" | "pharmacy" | "emergency_department";
  location: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude] in GeoJSON
  };
  address?: string;
  phone?: string;
  phoneVerified: boolean;
  hours?: {
    known: boolean;
    text?: string;
  };
  services?: string[];
  source: string;
  lastVerifiedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FacilityCacheSchema = new Schema<IFacilityCache>(
  {
    providerId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["hospital", "clinic", "pharmacy", "emergency_department"],
      required: true,
      index: true,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
        required: true,
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true,
      },
    },
    address: {
      type: String,
      required: false,
    },
    phone: {
      type: String,
      required: false,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
      required: true,
    },
    hours: {
      known: { type: Boolean, default: false },
      text: { type: String, required: false },
    },
    services: {
      type: [String],
      default: [],
    },
    source: {
      type: String,
      required: true,
    },
    lastVerifiedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// 2dsphere spatial index for geospatial proximity queries
FacilityCacheSchema.index({ location: "2dsphere" });

export const FacilityCache: Model<IFacilityCache> =
  mongoose.models.FacilityCache ||
  mongoose.model<IFacilityCache>("FacilityCache", FacilityCacheSchema);

export default FacilityCache;
