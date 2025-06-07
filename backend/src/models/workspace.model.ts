import mongoose, { Document, Schema } from "mongoose";
import { generateInviteCode } from "../utils/uuid";

export interface WorkspaceDocument extends Document {
  name: string;
  description: string;
  owner: mongoose.Types.ObjectId;
  inviteCode: string;
  inviteCodeActive: boolean;
  inviteCodeExpiresAt: Date | null;
  createdAt: string;
  updatedAt: string;
  resetInviteCode(): void;
}

const workspaceSchema = new Schema<WorkspaceDocument>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: false },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to User model (the workspace creator)
      required: true,
    },
    inviteCode: {
      type: String,
      required: true,
      unique: true,
      default: generateInviteCode,
    },
    inviteCodeActive: {
      type: Boolean,
      default: true,
    },
    inviteCodeExpiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

workspaceSchema.methods.resetInviteCode = function () {
  this.inviteCode = generateInviteCode();
  this.inviteCodeActive = true;
  this.inviteCodeExpiresAt = null;
  return this;
};

const WorkspaceModel = mongoose.model<WorkspaceDocument>(
  "Workspace",
  workspaceSchema
);

export default WorkspaceModel;
