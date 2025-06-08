import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import {
  createProjectSchema,
  projectIdSchema,
  updateProjectSchema,
} from "../validation/project.validation";
import { workspaceIdSchema } from "../validation/workspace.validation";
import { getMemberRoleInWorkspace } from "../services/member.service";
import { Permissions, PermissionType } from "../enums/role.enum";
import {
  createProjectService,
  deleteProjectService,
  getProjectAnalyticsService,
  getProjectByIdAndWorkspaceIdService,
  getProjectsInWorkspaceService,
  updateProjectService,
} from "../services/project.service";
import { HTTPSTATUS } from "../config/http.config";
import { NotFoundException, ForbiddenException, InternalServerException } from "../utils/appError";
import WorkspaceModel from "../models/workspace.model";

// Helper function to check workspace existence and member role
const checkWorkspaceAndMemberRole = async (
  userId: string | undefined,
  workspaceId: string,
  requiredPermission: PermissionType
) => {
  if (!userId) {
    throw new ForbiddenException("Authentication required");
  }

  // Check if workspace exists
  const workspace = await WorkspaceModel.findById(workspaceId);
  if (!workspace) {
    throw new NotFoundException("Workspace not found");
  }

  try {
    // Get member role - this will throw ForbiddenException if user is not a member
    const { role } = await getMemberRoleInWorkspace(userId, workspaceId);

    if (!role?.name || !Array.isArray(role?.permissions)) {
      throw new InternalServerException("Invalid role data structure. Missing name or permissions.");
    }

    // Check if user has the required permission
    const hasPermission = role.permissions.includes(requiredPermission);
    if (!hasPermission) {
      let errorMessage = "You don't have sufficient permissions for this action. ";
      switch (requiredPermission) {
        case Permissions.VIEW_ONLY:
          errorMessage += "Contact a workspace admin to grant you view access.";
          break;
        case Permissions.CREATE_PROJECT:
          errorMessage += "Contact a workspace admin to grant you project creation permissions.";
          break;
        case Permissions.EDIT_PROJECT:
          errorMessage += "Contact a workspace admin to grant you project editing permissions.";
          break;
        case Permissions.DELETE_PROJECT:
          errorMessage += "Contact a workspace admin to grant you project deletion permissions.";
          break;
        default:
          errorMessage += "Contact a workspace admin to grant you the necessary permissions.";
      }
      throw new ForbiddenException(errorMessage);
    }

    return role;
  } catch (error: any) {
    // Re-throw known error types
    if (error instanceof ForbiddenException || 
        error instanceof NotFoundException || 
        error instanceof InternalServerException) {
      throw error;
    }

    // Log unexpected errors
    console.error("Error in checkWorkspaceAndMemberRole:", {
      error: error.message,
      stack: error.stack,
      userId,
      workspaceId,
      requiredPermission
    });

    throw new InternalServerException(
      "An unexpected error occurred while checking permissions. Please try again later."
    );
  }
};

export const createProjectController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = createProjectSchema.parse(req.body);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const userId = req.user?._id;

    await checkWorkspaceAndMemberRole(
      userId,
      workspaceId,
      Permissions.CREATE_PROJECT
    );
    const { project } = await createProjectService(userId, workspaceId, body);

    return res.status(HTTPSTATUS.CREATED).json({
      message: "Project created successfully",
      project,
    });
  }
);

export const getAllProjectsInWorkspaceController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const userId = req.user?._id;

    await checkWorkspaceAndMemberRole(userId, workspaceId, Permissions.VIEW_ONLY);

    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const pageNumber = parseInt(req.query.pageNumber as string) || 1;

    const { projects, totalCount, totalPages, skip } =
      await getProjectsInWorkspaceService(workspaceId, pageSize, pageNumber);

    return res.status(HTTPSTATUS.OK).json({
      message: "Project fetched successfully",
      projects,
      pagination: {
        totalCount,
        pageSize,
        pageNumber,
        totalPages,
        skip,
        limit: pageSize,
      },
    });
  }
);

export const getProjectByIdAndWorkspaceIdController = asyncHandler(
  async (req: Request, res: Response) => {
    const projectId = projectIdSchema.parse(req.params.id);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const userId = req.user?._id;

    await checkWorkspaceAndMemberRole(userId, workspaceId, Permissions.VIEW_ONLY);

    const { project } = await getProjectByIdAndWorkspaceIdService(
      workspaceId,
      projectId
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Project fetched successfully",
      project,
    });
  }
);

export const getProjectAnalyticsController = asyncHandler(
  async (req: Request, res: Response) => {
    const projectId = projectIdSchema.parse(req.params.id);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const userId = req.user?._id;

    await checkWorkspaceAndMemberRole(userId, workspaceId, Permissions.VIEW_ONLY);

    const { analytics } = await getProjectAnalyticsService(
      workspaceId,
      projectId
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Project analytics retrieved successfully",
      analytics,
    });
  }
);

export const updateProjectController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const projectId = projectIdSchema.parse(req.params.id);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const body = updateProjectSchema.parse(req.body);

    await checkWorkspaceAndMemberRole(userId, workspaceId, Permissions.EDIT_PROJECT);

    const { project } = await updateProjectService(
      workspaceId,
      projectId,
      body
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Project updated successfully",
      project,
    });
  }
);

export const deleteProjectController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const projectId = projectIdSchema.parse(req.params.id);
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);

    await checkWorkspaceAndMemberRole(userId, workspaceId, Permissions.DELETE_PROJECT);

    await deleteProjectService(workspaceId, projectId);

    return res.status(HTTPSTATUS.OK).json({
      message: "Project deleted successfully",
    });
  }
);
