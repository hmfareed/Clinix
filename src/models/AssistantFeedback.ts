import mongoose, { Schema, Document, Model } from "mongoose";

export type FeedbackRating = "positive" | "negative" | "helpful" | "not_helpful" | "concerning";

export interface IAssistantFeedback extends Document {
  conversationId: mongoose.Types.ObjectId;
  messageId?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  rating: FeedbackRating;
  feedbackText?: string;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AssistantFeedbackSchema = new Schema<IAssistantFeedback>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: "AssistantConversation",
      required: true,
      index: true,
    },
    messageId: {
      type: Schema.Types.ObjectId,
      ref: "AssistantMessage",
      required: false,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
    rating: {
      type: String,
      enum: ["positive", "negative", "helpful", "not_helpful", "concerning"],
      required: true,
    },
    feedbackText: {
      type: String,
      maxlength: 1000,
      required: false,
    },
    category: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

export const AssistantFeedback: Model<IAssistantFeedback> =
  mongoose.models.AssistantFeedback ||
  mongoose.model<IAssistantFeedback>("AssistantFeedback", AssistantFeedbackSchema);

export default AssistantFeedback;
