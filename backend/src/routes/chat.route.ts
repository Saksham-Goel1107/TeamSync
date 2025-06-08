import { Router } from "express";
import {
  getWorkspaceMessagesController,
  createMessageController
} from "../controllers/chat.controller";

const chatRoutes = Router();

// Get all messages for a workspace
chatRoutes.get("/workspace/:workspaceId/chat", getWorkspaceMessagesController);

// Create a new message (for fallback when socket is not available)
chatRoutes.post("/workspace/:workspaceId/chat", createMessageController);

export default chatRoutes;
