import { Roles } from "../enums/role.enum";
import MemberModel from "../models/member.model";
import RoleModel from "../models/roles-permission.model";
import WorkspaceModel from "../models/workspace.model";
import UserModel from "../models/user.model";
import {
  BadRequestException,
  NotFoundException,
} from "../utils/appError";

export const getMemberRoleInWorkspace = async (
  userId: string,
  workspaceId: string
) => {
  const member = await MemberModel.findOne({
    userId,
    workspaceId,
  }).populate("role");

  if (!member) {
    throw new NotFoundException("You are not a member of this workspace");
  }

  return { role: member.role };
};

export const removeMemberService = async (
  workspaceId: string,
  memberId: string,
  requestingUserId: string
) => {
  // Check if workspace exists
  const workspace = await WorkspaceModel.findById(workspaceId);
  if (!workspace) {
    throw new NotFoundException("Workspace not found");
  }

  // Check if member exists
  const memberToRemove = await MemberModel.findOne({
    userId: memberId,
    workspaceId: workspaceId,
  }).populate("role");

  if (!memberToRemove) {
    throw new NotFoundException("Member not found in the workspace");
  }

  // Cannot remove workspace owner
  if (memberToRemove.role.name === Roles.OWNER) {
    throw new BadRequestException("Cannot remove the workspace owner");
  }

  // Get requesting user's role
  const requestingMember = await MemberModel.findOne({
    userId: requestingUserId,
    workspaceId: workspaceId,
  }).populate("role");

  if (!requestingMember) {
    throw new BadRequestException("You are not a member of this workspace");
  }

  // Only owners and admins can remove members
  if (
    requestingMember.role.name !== Roles.OWNER &&
    requestingMember.role.name !== Roles.ADMIN
  ) {
    throw new BadRequestException("You don't have permission to remove members");
  }

  // Admins cannot remove other admins
  if (
    requestingMember.role.name === Roles.ADMIN &&
    memberToRemove.role.name === Roles.ADMIN
  ) {
    throw new BadRequestException("Admins cannot remove other admins");
  }

  // Remove the member
  await MemberModel.findByIdAndDelete(memberToRemove._id);

  return {
    message: "Member removed successfully",
  };
};

export const joinWorkspaceByInviteService = async (
  userId: string,
  inviteCode: string
) => {
  // Find workspace by invite code and validate it
  const workspace = await WorkspaceModel.findOne({
    inviteCode,
    inviteCodeActive: true,
  }).exec();

  if (!workspace) {
    throw new NotFoundException("Invalid or expired invite code");
  }

  // Check if invite code has expired
  if (
    workspace.inviteCodeExpiresAt &&
    workspace.inviteCodeExpiresAt < new Date()
  ) {
    workspace.inviteCodeActive = false;
    await workspace.save();
    throw new BadRequestException("This invite link has expired");
  }

  // Check if user is already a member
  const existingMember = await MemberModel.findOne({
    userId,
    workspaceId: workspace._id,
  }).exec();

  if (existingMember) {
    throw new BadRequestException("You are already a member of this workspace");
  }

  // Get member role
  const memberRole = await RoleModel.findOne({ name: Roles.MEMBER });

  if (!memberRole) {
    throw new NotFoundException("Member role not found");
  }

  // Create new member
  const member = new MemberModel({
    userId,
    workspaceId: workspace._id,
    role: memberRole._id,
    joinedAt: new Date(),
  });

  await member.save();

  return {
    workspaceId: workspace._id,
    role: memberRole,
  };
};

export const leaveWorkspaceService = async (
  workspaceId: string,
  userId: string
) => {
  const workspace = await WorkspaceModel.findById(workspaceId);
  if (!workspace) {
    throw new NotFoundException("Workspace not found");
  }

  // Check if user is a member
  const member = await MemberModel.findOne({
    userId,
    workspaceId,
  }).populate("role");

  if (!member) {
    throw new NotFoundException("You are not a member of this workspace");
  }

  // If user is owner, they can't leave
  if (member.role.name === Roles.OWNER) {
    throw new BadRequestException(
      "As the workspace owner, you cannot leave the workspace. Please transfer ownership first."
    );
  }

  // Get the user and unset their current workspace if it matches
  const user = await UserModel.findById(userId);
  if (user?.currentWorkspace?.toString() === workspaceId) {
    user.currentWorkspace = null;
    await user.save();
  }

  // Remove the member
  await MemberModel.findByIdAndDelete(member._id);

  return {
    message: "Successfully left the workspace",
  };
};

export const transferOwnershipService = async (
  workspaceId: string,
  newOwnerId: string,
  currentUserId: string
) => {
  const workspace = await WorkspaceModel.findById(workspaceId);
  if (!workspace) {
    throw new NotFoundException("Workspace not found");
  }

  // Verify current user is the owner
  const currentOwner = await MemberModel.findOne({
    userId: currentUserId,
    workspaceId,
  }).populate("role");

  if (!currentOwner || currentOwner.role.name !== Roles.OWNER) {
    throw new BadRequestException("Only the workspace owner can transfer ownership");
  }

  // Verify new owner is a member and is an admin
  const newOwner = await MemberModel.findOne({
    userId: newOwnerId,
    workspaceId,
  }).populate("role");

  if (!newOwner) {
    throw new NotFoundException("New owner must be a member of the workspace");
  }

  if (newOwner.role.name !== Roles.ADMIN) {
    throw new BadRequestException("Ownership can only be transferred to an admin");
  }

  // Get roles
  const ownerRole = await RoleModel.findOne({ name: Roles.OWNER });
  const memberRole = await RoleModel.findOne({ name: Roles.MEMBER });

  if (!ownerRole || !memberRole) {
    throw new NotFoundException("Required roles not found");
  }

  try {
    // Update workspace owner first
    await WorkspaceModel.findByIdAndUpdate(
      workspaceId,
      { owner: newOwner.userId }
    );

    // Update the new owner's role to owner
    await MemberModel.findByIdAndUpdate(
      newOwner._id,
      { role: ownerRole._id }
    );

    // Update the current owner's role to member
    await MemberModel.findByIdAndUpdate(
      currentOwner._id,
      { role: memberRole._id }
    );

    // Verify the changes were successful
    const verifyNewOwner = await MemberModel.findById(newOwner._id).populate('role');
    const verifyOldOwner = await MemberModel.findById(currentOwner._id).populate('role');
    const verifyWorkspace = await WorkspaceModel.findById(workspaceId);

    if (!verifyNewOwner || 
        !verifyOldOwner || 
        !verifyWorkspace || 
        verifyNewOwner.role.name !== Roles.OWNER ||
        verifyOldOwner.role.name !== Roles.MEMBER ||
        verifyWorkspace.owner.toString() !== newOwner.userId.toString()) {
      // If any verification fails, throw an error
      throw new Error("Ownership transfer failed verification");
    }
  } catch (error) {
    console.error("Transfer ownership error:", error);
    // If anything fails, attempt to rollback
    try {
      await WorkspaceModel.findByIdAndUpdate(workspaceId, { owner: currentOwner.userId });
      await MemberModel.findByIdAndUpdate(currentOwner._id, { role: ownerRole._id });
      await MemberModel.findByIdAndUpdate(newOwner._id, { role: memberRole._id });
    } catch (rollbackError) {
      console.error("Rollback failed:", rollbackError);
    }
    throw new BadRequestException(
      error instanceof Error ? error.message : "Failed to transfer ownership. Please try again."
    );
  }

  return {
    message: "Workspace ownership transferred successfully",
  };
};
