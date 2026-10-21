import mongoose, { Schema, Document, Model } from "mongoose";

export type AssistantConversationStatus = "active" | "completed" | "archived" | "emergency";

export type AssistantState =
  | "idle"
  | "collecting_symptoms"
  | "screening"
  | "screening_safety"
  | "asking_questions"
  | "asking_follow_up"
  | "evaluating"
  | "presenting_result"
  | "presenting_guidance"
  | "completed"
  | "escalated"
  | "failed";

export interface IAssistantConversation extends Document {
  userId?: mongoose.Types.ObjectId;
  guestTokenHash?: string;
  title: string;
  status: AssistantConversationStatus;
  currentState: AssistantState;
  assessmentId?: mongoose.Types.ObjectId;
  currentIntent?: string;
  language: string;
  lastActiveAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const AssistantConversationSchema = new Schema<IAssistantConversation>(
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
    title: {
      type: String,
      default: "New Consultation",
      trim: true,
      maxlength: 120,
    },
    status: {
      type: String,
      enum: ["active", "completed", "archived", "emergency"],
      default: "active",
      required: true,
      index: true,
    },
    currentState: {
      type: String,
      enum: [
        "idle",
        "collecting_symptoms",
        "screening",
        "screening_safety",
        "asking_questions",
        "asking_follow_up",
        "evaluating",
        "presenting_result",
        "presenting_guidance",
        "completed",
        "escalated",
        "failed",
      ],
      default: "idle",
      required: true,
      index: true,
    },
    assessmentId: {
      type: Schema.Types.ObjectId,
      ref: "Assessment",
      required: false,
      index: true,
    },
    currentIntent: {
      type: String,
      required: false,
    },
    language: {
      type: String,
      default: "en",
      required: true,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: false,
      index: { expires: 0 },
    },
    metadata: {
      type: Schema.Types.Mixed,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for fast ownership querying and sorting
AssistantConversationSchema.index({ userId: 1, updatedAt: -1 });
AssistantConversationSchema.index({ guestTokenHash: 1, updatedAt: -1 });

export const AssistantConversation: Model<IAssistantConversation> =
  mongoose.models.AssistantConversation ||
  mongoose.model<IAssistantConversation>("AssistantConversation", AssistantConversationSchema);

export default AssistantConversation;
