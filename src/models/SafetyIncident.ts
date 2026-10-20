import mongoose, { Schema, Document, Model } from "mongoose";

export type IncidentSeverity = "critical" | "high" | "medium" | "low";
export type IncidentStatus = "reported" | "in_review" | "action_taken" | "resolved" | "closed";

export interface ISafetyIncident extends Document {
  incidentNumber: string;
  severity: IncidentSeverity;
  title: string;
  description: string;
  assessmentId?: string;
  status: IncidentStatus;
  reportedBy: string;
  assignedReviewer?: string;
  rootCause?: string;
  correctiveAction?: string;
  ruleUpdateRequired: boolean;
  promptUpdateRequired: boolean;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SafetyIncidentSchema = new Schema<ISafetyIncident>(
  {
    incidentNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ["critical", "high", "medium", "low"],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    assessmentId: {
      type: String,
      required: false,
    },
    status: {
      type: String,
      enum: ["reported", "in_review", "action_taken", "resolved", "closed"],
      default: "reported",
      required: true,
      index: true,
    },
    reportedBy: {
      type: String,
      required: true,
    },
    assignedReviewer: {
      type: String,
      required: false,
    },
    rootCause: {
      type: String,
      required: false,
    },
    correctiveAction: {
      type: String,
      required: false,
    },
    ruleUpdateRequired: {
      type: Boolean,
      default: false,
    },
    promptUpdateRequired: {
      type: Boolean,
      default: false,
    },
    resolvedAt: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

SafetyIncidentSchema.index({ severity: 1, status: 1 });

export const SafetyIncident: Model<ISafetyIncident> =
  mongoose.models.SafetyIncident ||
  mongoose.model<ISafetyIncident>("SafetyIncident", SafetyIncidentSchema);

export default SafetyIncident;
