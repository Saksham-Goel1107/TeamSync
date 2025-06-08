import { PermissionType } from "@/constant";
import { UserType, WorkspaceWithMembersType } from "@/types/api.type";
import { useEffect, useMemo, useState } from "react";

const usePermissions = (
  user: UserType | undefined,
  workspace: WorkspaceWithMembersType | undefined
) => {
  const [permissions, setPermissions] = useState<PermissionType[]>([]);

  useEffect(() => {
    // Reset permissions if no user or workspace
    if (!user || !workspace) {
      setPermissions([]);
      return;
    }

    // Safety check for workspace members
    if (!workspace.members || !Array.isArray(workspace.members)) {
      console.warn("Workspace members data is not properly initialized");
      setPermissions([]);
      return;
    }

    try {
      // Find member by comparing user._id with populated userId._id
      const member = workspace.members.find((member) => {
        // Strict type checking for member structure
        if (!member?.userId?._id || !user?._id) {
          return false;
        }
        return member.userId._id === user._id;
      });

      if (!member) {
        console.warn("User is not a member of this workspace");
        setPermissions([]);
        return;
      }

      // Validate role and permissions structure
      if (!member.role || !Array.isArray(member.role.permissions)) {
        console.warn("Invalid role or permissions data structure", member.role);
        setPermissions([]);
        return;
      }

      setPermissions(member.role.permissions);
    } catch (error) {
      console.error("Error in usePermissions:", error);
      setPermissions([]);
    }
  }, [user, workspace]);

  return useMemo(() => permissions, [permissions]);
};

export default usePermissions;
