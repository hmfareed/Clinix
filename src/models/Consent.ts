import mongoose, { Schema, Document, Model } from "mongoose";

export type ConsentType =
  | "privacy"
  | "ai_processing"
  | "data_retention"
  | "location"
  | "trusted_contact";

export type ConsentStatus = "granted" | "withdrawn";

export interface IConsent extends Document {
  userId?: mongoose.Types.ObjectId;
  guestTokenHash?: string;
  type: ConsentType;
  policyVersion: string;
  status: ConsentStatus;
  scope?: string;
  ipHash?: string;
  grantedAt: Date;
  withdrawnAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ConsentSchema = new Schema<IConsent>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
    guestTokenHash: {
      type: String,
      required: false,
      index: true,
    },
    type: {
      type: String,
      enum: ["privacy", "ai_processing", "data_retention", "location", "trusted_contact"],
      required: true,
    },
    policyVersion: {
      type: String,
      required: true,
      default: "1.0",
    },
    status: {
      type: String,
      enum: ["granted", "withdrawn"],
      required: true,
      default: "granted",
    },
    scope: {
      type: String,
      required: false,
    },
    ipHash: {
      type: String,
      required: false,
    },
    grantedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    withdrawnAt: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

ConsentSchema.index({ userId: 1, type: 1, policyVersion: 1 });

export const Consent: Model<IConsent> =
  mongoose.models.Consent || mongoose.model<IConsent>("Consent", ConsentSchema);

export default Consent;
