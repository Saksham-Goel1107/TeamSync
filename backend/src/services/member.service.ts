import mongoose from "mongoose";
import { Roles } from "../enums/role.enum";
import MemberModel from "../models/member.model";
import RoleModel from "../models/roles-permission.model";
import WorkspaceModel from "../models/workspace.model";
import UserModel from "../models/user.model";
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  InternalServerException,
} from "../utils/appError";

const getRoleHierarchyLevel = (role: string): number => {
  switch (role) {
    case Roles.OWNER:
      return 4;
    case Roles.CO_OWNER:
      return 3;
    case Roles.ADMIN:
      return 2;
    case Roles.MEMBER:
      return 1;
    default:
      return 0;
  }
};

const canModifyRole = (requestingRole: string, targetRole: string): boolean => {
  const requestingLevel = getRoleHierarchyLevel(requestingRole);
  const targetLevel = getRoleHierarchyLevel(targetRole);

  // Owner can modify all roles
  if (requestingRole === Roles.OWNER) {
    return true;
  }

  // No one can modify users of the same role level
  if (requestingLevel === targetLevel) {
    return false;
  }

  // Co-owner can only modify admin and member roles (roles with lower hierarchy)
  if (requestingRole === Roles.CO_OWNER) {
    return targetLevel < requestingLevel;
  }

  // Admin can only modify member roles (roles with lower hierarchy)
  if (requestingRole === Roles.ADMIN) {
    return targetLevel < requestingLevel;
  }

  // Members can't modify any roles
  return false;
};

export const getMemberRoleInWorkspace = async (
  userId: string,
  workspaceId: string
) => {
  console.log('Raw IDs received:', { userId, workspaceId, 
    userIdType: typeof userId, 
    workspaceIdType: typeof workspaceId 
  });

  // Convert string IDs to ObjectIds if needed
  let userObjectId: mongoose.Types.ObjectId;
  let workspaceObjectId: mongoose.Types.ObjectId;

  try {
    if (typeof userId === 'string') {
      userObjectId = new mongoose.Types.ObjectId(userId);
    } else if ((userId as any) instanceof mongoose.Types.ObjectId) {
      userObjectId = userId as mongoose.Types.ObjectId;
    } else if (userId && typeof userId === 'object' && 'toString' in userId && typeof (userId as any).toString === 'function') {
      userObjectId = new mongoose.Types.ObjectId((userId as any).toString());
    } else {
      throw new BadRequestException("Invalid user ID format");
    }

    if (typeof workspaceId === 'string') {
      workspaceObjectId = new mongoose.Types.ObjectId(workspaceId);
    } else if ((workspaceId as any) instanceof mongoose.Types.ObjectId) {
      workspaceObjectId = workspaceId as mongoose.Types.ObjectId;
    } else if (workspaceId && typeof workspaceId === 'object' && 'toString' in workspaceId && typeof (workspaceId as any).toString === 'function') {
      workspaceObjectId = new mongoose.Types.ObjectId((workspaceId as any).toString());
    } else {
      throw new BadRequestException("Invalid workspace ID format");
    }
  } catch (error) {
    console.error('Error converting IDs:', error);
    throw new BadRequestException("Invalid user or workspace ID format");
  }

  console.log('Looking up member with converted IDs:', {
    userId: userObjectId?.toString(),
    workspaceId: workspaceObjectId?.toString()
  });

  // First find the member
  let member = await MemberModel.findOne({
    userId: userObjectId,
    workspaceId: workspaceObjectId,
  });

  if (!member) {
    // Let's check if there are any members in this workspace at all
    const allMembers = await MemberModel.find({ workspaceId: workspaceObjectId });
    console.log('No member found. All workspace members:', allMembers.map(m => ({
      userId: m.userId.toString(),
      memberId: (m._id as mongoose.Types.ObjectId).toString()
    })));

    throw new ForbiddenException("You are not a member of this workspace");
  }

  console.log('Found member:', {
    memberId: (member._id as mongoose.Types.ObjectId).toString(),
    userId: member.userId.toString(),
    workspaceId: member.workspaceId.toString(),
    roleId: member.role?.toString() || null
  });

  // Handle member with missing role by assigning default MEMBER role
  if (!member.role) {
    console.log("Member found with no role, assigning default MEMBER role:", member._id);
    const defaultRole = await RoleModel.findOne({ name: Roles.MEMBER });
    if (!defaultRole) {
      throw new InternalServerException("Default member role not found. Please run role seeder.");
    }
    
    // Update the member with default role using findByIdAndUpdate to ensure proper type handling
    await MemberModel.findByIdAndUpdate(member._id, { role: defaultRole._id });
    
    // Re-fetch member to get updated state
    member = await MemberModel.findById(member._id);
    if (!member || !member.role) {
      throw new InternalServerException("Failed to update member role");
    }
  }

  // Store the role ID for debugging
  const roleIdBeforePopulate = member.role?.toString();

  // Try to find the role directly first to verify it exists
  const roleExists = await RoleModel.findById(roleIdBeforePopulate);
  if (!roleExists) {
    console.log('Role document not found, attempting to repair with default MEMBER role');
    const defaultRole = await RoleModel.findOne({ name: Roles.MEMBER });
    if (!defaultRole) {
      throw new InternalServerException("Default member role not found. Please run role seeder.");
    }
    
    // Update the member with default role
    await MemberModel.findByIdAndUpdate(member._id, { role: defaultRole._id });
    member = await MemberModel.findById(member._id);
  }

  // Then populate the role field explicitly
  try {
    if (!member) {
      throw new InternalServerException("Member is null before population");
    }
    await member.populate({
      path: "role",
      select: "name permissions"
    });
    
    console.log('Role population result:', {
      roleBeforePopulate: roleIdBeforePopulate,
      populatedRole: member.role
    });
  } catch (error) {
    console.error('Population error:', error);
    throw new InternalServerException("Role population failed: " + (error as Error).message);
  }

  if (!member.role || typeof member.role === 'string') {
    console.error("Role population resulted in invalid state:", {
      memberId: member._id,
      roleId: member.role
    });
    throw new InternalServerException("Role population failed: invalid result type");
  }

  // Validate role structure
  if (!member.role.name || !Array.isArray(member.role.permissions)) {
    console.error("Invalid role properties:", {
      roleName: member.role.name,
      permissions: member.role.permissions
    });
    throw new InternalServerException("Invalid role data structure: invalid role properties");
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

  // Role-based removal restrictions
  const requestingRole = requestingMember.role.name;
  const targetRole = memberToRemove.role.name;

  // Check if requesting user has high enough role to modify target
  if (!canModifyRole(requestingRole, targetRole)) {
    throw new BadRequestException(
      `Users with role ${requestingRole} cannot remove users with role ${targetRole}`
    );
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

  // Only allow transfer to admin or co-owner
  if (newOwner.role.name !== Roles.ADMIN && newOwner.role.name !== Roles.CO_OWNER) {
    throw new BadRequestException("Ownership can only be transferred to an admin or co-owner");
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

export const promoteToCoOwnerService = async (
  workspaceId: string,
  memberId: string,
  requestingUserId: string,
  confirmationText: string
) => {
  // Verify the confirmation text
  const expectedConfirmation = "I understand that co-owners have extensive permissions";
  if (confirmationText !== expectedConfirmation) {
    throw new BadRequestException(
      "Please confirm that you understand the implications of promoting to co-owner"
    );
  }

  const workspace = await WorkspaceModel.findById(workspaceId);
  if (!workspace) {
    throw new NotFoundException("Workspace not found");
  }

  // Get requesting user's role
  const requestingMember = await MemberModel.findOne({
    userId: requestingUserId,
    workspaceId,
  }).populate("role");

  if (!requestingMember) {
    throw new BadRequestException("You are not a member of this workspace");
  }

  // Only owners can promote to co-owner
  if (requestingMember.role.name !== Roles.OWNER) {
    throw new BadRequestException("Only the workspace owner can promote members to co-owner");
  }

  // Get the member to promote
  const memberToPromote = await MemberModel.findOne({
    userId: memberId,
    workspaceId,
  }).populate("role");

  if (!memberToPromote) {
    throw new NotFoundException("Member not found");
  }

  // Cannot promote owner or existing co-owner
  if (
    memberToPromote.role.name === Roles.OWNER ||
    memberToPromote.role.name === Roles.CO_OWNER
  ) {
    throw new BadRequestException(
      `Cannot promote ${memberToPromote.role.name.toLowerCase()} to co-owner`
    );
  }

  // Get co-owner role
  const coOwnerRole = await RoleModel.findOne({ name: Roles.CO_OWNER });
  if (!coOwnerRole) {
    throw new InternalServerException("Co-owner role not found");
  }

  // Update the member's role to co-owner
  await MemberModel.findByIdAndUpdate(memberToPromote._id, {
    role: coOwnerRole._id,
  });

  return {
    message: "Member successfully promoted to co-owner",
  };
};

export const changeMemberRoleService = async (
  workspaceId: string,
  memberId: string,
  newRoleName: keyof typeof Roles,
  requestingUserId: string
) => {
  const workspace = await WorkspaceModel.findById(workspaceId);
  if (!workspace) {
    throw new NotFoundException("Workspace not found");
  }

  // Get requesting user's role
  const requestingMember = await MemberModel.findOne({
    userId: requestingUserId,
    workspaceId,
  }).populate("role");

  if (!requestingMember) {
    throw new BadRequestException("You are not a member of this workspace");
  }

  // Get the member to change
  const memberToChange = await MemberModel.findOne({
    userId: memberId,
    workspaceId,
  }).populate("role");

  if (!memberToChange) {
    throw new NotFoundException("Member not found");
  }

  // Check if requesting user has high enough role to modify target's current role
  if (!canModifyRole(requestingMember.role.name, memberToChange.role.name)) {
    throw new BadRequestException(
      `Users with role ${requestingMember.role.name} cannot modify users with role ${memberToChange.role.name}`
    );
  }

  // Check if requesting user has high enough role to assign the new role
  if (!canModifyRole(requestingMember.role.name, newRoleName)) {
    throw new BadRequestException(
      `Users with role ${requestingMember.role.name} cannot assign the ${newRoleName} role`
    );
  }

  // Get the new role
  const newRole = await RoleModel.findOne({ name: newRoleName });
  if (!newRole) {
    throw new InternalServerException(`Role ${newRoleName} not found`);
  }

  // If trying to assign CO_OWNER role, require confirmation
  if (newRoleName === Roles.CO_OWNER) {
    throw new BadRequestException(
      "Please use the dedicated promoteToCoOwner endpoint for co-owner promotion"
    );
  }

  // Update the member's role
  await MemberModel.findByIdAndUpdate(memberToChange._id, {
    role: newRole._id,
  });

  return {
    message: `Member role updated to ${newRoleName}`,
  };
};
