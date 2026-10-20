import mongoose, { Schema, Document, Model } from "mongoose";

export type AuditOutcome = "success" | "denied" | "error";

export interface IAuditEvent extends Document {
  actorId?: string;
  actorRole?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  outcome: AuditOutcome;
  ipHash?: string;
  metadata?: Record<string, unknown>;
  at: Date;
}

const AuditEventSchema = new Schema<IAuditEvent>(
  {
    actorId: {
      type: String,
      required: false,
      index: true,
    },
    actorRole: {
      type: String,
      required: false,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    resourceType: {
      type: String,
      required: false,
    },
    resourceId: {
      type: String,
      required: false,
    },
    outcome: {
      type: String,
      enum: ["success", "denied", "error"],
      required: true,
    },
    ipHash: {
      type: String,
      required: false,
    },
    metadata: {
      type: Schema.Types.Mixed,
      required: false,
    },
    at: {
      type: Date,
      default: Date.now,
      required: true,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

AuditEventSchema.index({ at: -1 });
AuditEventSchema.index({ actorId: 1, at: -1 });

export const AuditEvent: Model<IAuditEvent> =
  mongoose.models.AuditEvent || mongoose.model<IAuditEvent>("AuditEvent", AuditEventSchema);

export default AuditEvent;
