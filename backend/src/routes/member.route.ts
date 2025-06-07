import { Router } from "express";
import { 
  joinWorkspaceController, 
  removeMemberController,
  leaveWorkspaceController,
  transferOwnershipController
} from "../controllers/member.controller";

const memberRoutes = Router();

memberRoutes.post("/workspace/:inviteCode/join", joinWorkspaceController);
memberRoutes.post("/workspace/:workspaceId/remove", removeMemberController);
memberRoutes.post("/workspace/:workspaceId/leave", leaveWorkspaceController);
memberRoutes.post("/workspace/:workspaceId/transfer-ownership", transferOwnershipController);

export default memberRoutes;
