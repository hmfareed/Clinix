import mongoose, { Schema, Document, Model } from "mongoose";

export type UserRole =
  | "patient"
  | "support_admin"
  | "clinical_reviewer"
  | "system_admin"
  | "auditor";

export type UserStatus = "active" | "suspended" | "pending_deletion";

export interface IUser extends Document {
  email: string;
  passwordHash?: string;
  name?: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: false,
    },
    name: {
      type: String,
      trim: true,
      required: false,
    },
    role: {
      type: String,
      enum: ["patient", "support_admin", "clinical_reviewer", "system_admin", "auditor"],
      default: "patient",
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "suspended", "pending_deletion"],
      default: "active",
      required: true,
    },
    emailVerified: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent mongoose recompilation during Next.js hot module reloads
export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
