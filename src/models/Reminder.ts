import mongoose, { Schema, Document, Model } from "mongoose";

export type ReminderType = "follow_up" | "appointment" | "medication_review" | "custom";
export type ReminderStatus = "pending" | "completed" | "dismissed";

export interface IReminder extends Document {
  patientId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  reminderType: ReminderType;
  dueDate: Date;
  status: ReminderStatus;
  assessmentId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ReminderSchema = new Schema<IReminder>(
  {
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
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
      trim: true,
    },
    reminderType: {
      type: String,
      enum: ["follow_up", "appointment", "medication_review", "custom"],
      default: "follow_up",
      required: true,
    },
    dueDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "completed", "dismissed"],
      default: "pending",
      required: true,
      index: true,
    },
    assessmentId: {
      type: Schema.Types.ObjectId,
      ref: "Assessment",
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

ReminderSchema.index({ patientId: 1, dueDate: 1 });

export const Reminder: Model<IReminder> =
  mongoose.models.Reminder ||
  mongoose.model<IReminder>("Reminder", ReminderSchema);

export default Reminder;
