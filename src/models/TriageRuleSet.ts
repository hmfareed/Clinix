import mongoose, { Schema, Document, Model } from "mongoose";

export type RuleApprovalStatus = "draft" | "review_requested" | "approved" | "rejected";

export interface ITriageRuleSet extends Document {
  version: string;
  name: string;
  rules: unknown[];
  isActive: boolean;
  approvalStatus: RuleApprovalStatus;
  reviewedBy: string;
  reviewedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TriageRuleSetSchema = new Schema<ITriageRuleSet>(
  {
    version: {
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
    rules: {
      type: Schema.Types.Mixed,
      default: [],
    },
    isActive: {
      type: Boolean,
      default: false,
      required: true,
      index: true,
    },
    approvalStatus: {
      type: String,
      enum: ["draft", "review_requested", "approved", "rejected"],
      default: "approved",
      required: true,
      index: true,
    },
    reviewedBy: {
      type: String,
      required: true,
    },
    reviewedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    approvedBy: {
      type: String,
      required: false,
    },
    approvedAt: {
      type: Date,
      required: false,
    },
    notes: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

export const TriageRuleSet: Model<ITriageRuleSet> =
  mongoose.models.TriageRuleSet ||
  mongoose.model<ITriageRuleSet>("TriageRuleSet", TriageRuleSetSchema);

export default TriageRuleSet;
