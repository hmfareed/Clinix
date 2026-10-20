import mongoose, { Schema, Document, Model } from "mongoose";

export type SessionOwnerType = "user" | "guest";
export type SessionStatus = "active" | "completed" | "abandoned" | "emergency";

export interface IAssessmentSession extends Document {
  ownerType: SessionOwnerType;
  userId?: mongoose.Types.ObjectId;
  guestTokenHash?: string;
  status: SessionStatus;
  consentId?: mongoose.Types.ObjectId;
  language: string;
  triageState: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AssessmentSessionSchema = new Schema<IAssessmentSession>(
  {
    ownerType: {
      type: String,
      enum: ["user", "guest"],
      required: true,
      default: "guest",
    },
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
    status: {
      type: String,
      enum: ["active", "completed", "abandoned", "emergency"],
      default: "active",
      required: true,
    },
    consentId: {
      type: Schema.Types.ObjectId,
      ref: "Consent",
      required: false,
    },
    language: {
      type: String,
      default: "en",
      required: true,
    },
    triageState: {
      type: String,
      default: "initial",
      required: true,
    },
    expiresAt: {
      type: Date,
      required: false,
      index: { expires: 0 }, // TTL index automatically cleans up expired guest sessions
    },
  },
  {
    timestamps: true,
  }
);

export const AssessmentSession: Model<IAssessmentSession> =
  mongoose.models.AssessmentSession ||
  mongoose.model<IAssessmentSession>("AssessmentSession", AssessmentSessionSchema);

export default AssessmentSession;
