import mongoose, { Schema, Document, Model } from "mongoose";

export type TokenType = "email_verification" | "password_reset";

export interface IVerificationToken extends Document {
  identifier: string; // e.g. email or userId
  tokenHash: string;  // sha256 hash of random token
  type: TokenType;
  expiresAt: Date;
  createdAt: Date;
}

const VerificationTokenSchema = new Schema<IVerificationToken>(
  {
    identifier: {
      type: String,
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["email_verification", "password_reset"],
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // Automatically delete after expiry
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

VerificationTokenSchema.index({ identifier: 1, type: 1 });

export const VerificationToken: Model<IVerificationToken> =
  mongoose.models.VerificationToken ||
  mongoose.model<IVerificationToken>("VerificationToken", VerificationTokenSchema);

export default VerificationToken;
