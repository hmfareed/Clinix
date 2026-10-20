import mongoose, { Schema, Document, Model } from "mongoose";

export type MessageRole = "patient" | "assistant" | "system";

export type MessageResponseType =
  | "message"
  | "follow_up_question"
  | "emergency_alert"
  | "assessment_result"
  | "medication_info"
  | "clinic_info"
  | "clarification";

export interface IAssistantMessage extends Document {
  conversationId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  guestTokenHash?: string;
  role: MessageRole;
  content: string;
  responseType: MessageResponseType;
  intent?: string;
  schemaVersion: string;
  structuredPayload?: Record<string, unknown>;
  clientMessageId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AssistantMessageSchema = new Schema<IAssistantMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "AssistantConversation",
      required: true,
      index: true,
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
    role: {
      type: String,
      enum: ["patient", "assistant", "system"],
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    responseType: {
      type: String,
      enum: [
        "message",
        "follow_up_question",
        "emergency_alert",
        "assessment_result",
        "medication_info",
        "clinic_info",
        "clarification",
      ],
      default: "message",
      required: true,
    },
    intent: {
      type: String,
      required: false,
    },
    schemaVersion: {
      type: String,
      default: "1.0",
      required: true,
    },
    structuredPayload: {
      type: Schema.Types.Mixed,
      required: false,
    },
    clientMessageId: {
      type: String,
      required: false,
      index: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying conversation messages in chronological order
AssistantMessageSchema.index({ conversationId: 1, createdAt: 1 });

export const AssistantMessage: Model<IAssistantMessage> =
  mongoose.models.AssistantMessage ||
  mongoose.model<IAssistantMessage>("AssistantMessage", AssistantMessageSchema);

export default AssistantMessage;
