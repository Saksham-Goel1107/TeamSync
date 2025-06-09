import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { workspaceIdSchema } from "../validation/workspace.validation";
import { HTTPSTATUS } from "../config/http.config";
import { getMemberRoleInWorkspace } from "../services/member.service";
import { Permissions } from "../enums/role.enum";
import { roleGuard } from "../utils/roleGuard";
import { MessageModel } from "../services/socket.service";
import { z } from "zod";

// Define the message schema
const messageSchema = z.object({
  text: z.string().min(1),
  workspaceId: z.string(),
});

// Get all messages for a workspace
export const getWorkspaceMessagesController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const userId = req.user?._id;

    // Check if user is a member of the workspace
    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role.name, [Permissions.VIEW_ONLY]);

    // Fetch messages for the workspace
    const messages = await MessageModel.find({ workspaceId })
      .sort({ timestamp: 1 })
      .limit(100);

    return res.status(HTTPSTATUS.OK).json({
      message: "Messages fetched successfully",
      messages,
    });
  }
);

// Create a new message
export const createMessageController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const { text } = messageSchema.parse(req.body);
    const userId = req.user?._id;
    
    // Check if user is a member of the workspace
    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role.name, [Permissions.VIEW_ONLY]);

    // Create the message
    const newMessage = new MessageModel({
      text,
      sender: {
        id: userId,
        name: req.user?.name || "Unknown User",
        profilePicture: req.user?.profilePicture,
      },
      workspaceId,
      timestamp: new Date(),
    });

    // Save the message
    await newMessage.save();

    return res.status(HTTPSTATUS.CREATED).json({
      message: "Message sent successfully",
      newMessage,
    });
  }
);
