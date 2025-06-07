import { Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { z } from "zod";
import { HTTPSTATUS } from "../config/http.config";
import {
  joinWorkspaceByInviteService,
  removeMemberService,
  leaveWorkspaceService,
  transferOwnershipService,
} from "../services/member.service";
import { workspaceIdSchema } from "../validation/workspace.validation";
import { removeMemberSchema, transferOwnershipSchema } from "../validation/member.validation";
import { BadRequestException } from "../utils/appError";

export const joinWorkspaceController = asyncHandler(
  async (req: Request, res: Response) => {
    const inviteCode = z.string().parse(req.params.inviteCode);
    const userId = req.user?._id;

    const { workspaceId, role } = await joinWorkspaceByInviteService(
      userId,
      inviteCode
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Successfully joined the workspace",
      workspaceId,
      role,
    });
  }
);

export const removeMemberController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const { memberId } = removeMemberSchema.parse(req.body);
    const userId = req.user?._id;

    const result = await removeMemberService(workspaceId, memberId, userId);

    return res.status(HTTPSTATUS.OK).json(result);
  }
);

export const leaveWorkspaceController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const userId = req.user?._id;

    const result = await leaveWorkspaceService(workspaceId, userId);

    return res.status(HTTPSTATUS.OK).json(result);
  }
);

export const transferOwnershipController = asyncHandler(
  async (req: Request, res: Response) => {
    const workspaceId = workspaceIdSchema.parse(req.params.workspaceId);
    const { newOwnerId } = transferOwnershipSchema.parse(req.body);
    const userId = req.user?._id;

    try {
      const result = await transferOwnershipService(workspaceId, newOwnerId, userId);
      return res.status(HTTPSTATUS.OK).json(result);
    } catch (error) {
      console.error('Transfer ownership controller error:', error);
      if (error instanceof Error) {
        throw new BadRequestException(error.message || "Failed to transfer ownership");
      }
      throw error;
    }
  }
);
