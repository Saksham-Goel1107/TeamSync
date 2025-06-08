import { Request, Response } from "express";

import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import {
  changeRoleSchema,
  createWorkspaceSchema,
  workspaceIdSchema,
} from "../validation/workspace.validation";
import { HTTPSTATUS } from "../config/http.config";
import {
  changeMemberRoleService,
  createWorkspaceService,
  deleteWorkspaceService,
  getAllWorkspacesUserIsMemberService,
  getWorkspaceAnalyticsService,
  getWorkspaceMembersService,
  updateWorkspaceByIdService,
  regenerateInviteCodeService,
} from "../services/workspace.service";
import { getMemberRoleInWorkspace } from "../services/member.service";
import { Permissions } from "../enums/role.enum";
import { roleGuard } from "../utils/roleGuard";
import { updateWorkspaceSchema } from "../validation/workspace.validation";
import { InternalServerException, NotFoundException } from "../utils/appError";
import WorkspaceModel from "../models/workspace.model";
import MemberModel from "../models/member.model";

export const createWorkspaceController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = createWorkspaceSchema.parse(req.body);

    const userId = req.user?._id;
    const { workspace } = await createWorkspaceService(userId, body);

    return res.status(HTTPSTATUS.CREATED).json({
      message: "Workspace created successfully",
      workspace,
    });
  }
);

// Controller: Get all workspaces the user is part of

export const getAllWorkspacesUserIsMemberController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;

    const { workspaces } = await getAllWorkspacesUserIsMemberService(userId);

    return res.status(HTTPSTATUS.OK).json({
      message: "User workspaces fetched successfully",
      workspaces,
    });
  }
);

export const getWorkspaceByIdController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.id);
    const userId = req.user?._id;

    // First check if workspace exists
    const workspace = await WorkspaceModel.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }

    // Check if user is a member and get their role
    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    if (!role?.name) {
      throw new InternalServerException("Invalid role data structure");
    }
    roleGuard(role.name, [Permissions.VIEW_ONLY]);

    // Get workspace with populated members including permissions
    const members = await MemberModel.find({
      workspaceId,
    })
      .populate("userId", "name email profilePicture")
      .populate({
        path: "role",
        select: "name permissions",
      });

    const workspaceWithMembers = {
      ...workspace.toObject(),
      members,
    };

    return res.status(HTTPSTATUS.OK).json({
      message: "Workspace fetched successfully",
      workspace: workspaceWithMembers,
    });
  }
);

export const getWorkspaceMembersController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.id);
    const userId = req.user?._id;

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role.name, [Permissions.VIEW_ONLY]);

    const { members, roles } = await getWorkspaceMembersService(workspaceId);

    return res.status(HTTPSTATUS.OK).json({
      message: "Workspace members retrieved successfully",
      members,
      roles,
    });
  }
);

export const getWorkspaceAnalyticsController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.id);
    const userId = req.user?._id;

    // First check if workspace exists
    const workspace = await WorkspaceModel.findById(workspaceId);
    if (!workspace) {
      throw new NotFoundException("Workspace not found");
    }

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role.name, [Permissions.VIEW_ONLY]);

    const { analytics } = await getWorkspaceAnalyticsService(workspaceId);

    return res.status(HTTPSTATUS.OK).json({
      message: "Workspace analytics retrieved successfully",
      analytics,
    });
  }
);

export const changeWorkspaceMemberRoleController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.id);
    const { memberId, roleId } = changeRoleSchema.parse(req.body);

    const userId = req.user?._id;

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role.name, [Permissions.CHANGE_MEMBER_ROLE]);

    const { member } = await changeMemberRoleService(
      workspaceId,
      memberId,
      roleId
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Member Role changed successfully",
      member,
    });
  }
);

export const updateWorkspaceByIdController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.id);
    const { name, description } = updateWorkspaceSchema.parse(req.body);

    const userId = req.user?._id;

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role.name, [Permissions.EDIT_WORKSPACE]);

    const { workspace } = await updateWorkspaceByIdService(
      workspaceId,
      name,
      description
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Workspace updated successfully",
      workspace,
    });
  }
);

export const deleteWorkspaceByIdController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.id);

    const userId = req.user?._id;

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role.name, [Permissions.DELETE_WORKSPACE]);

    const { currentWorkspace } = await deleteWorkspaceService(
      workspaceId,
      userId
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Workspace deleted successfully",
      currentWorkspace,
    });
  }
);

export const regenerateInviteCodeController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.id);
    const userId = req.user?._id;

    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);
    roleGuard(role.name, [Permissions.MANAGE_WORKSPACE_SETTINGS]);

    const { workspace } = await regenerateInviteCodeService(workspaceId, userId);

    return res.status(HTTPSTATUS.OK).json({
      message: "Workspace invite code regenerated successfully",
      workspace,
    });
  }
);
