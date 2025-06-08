import { PermissionType } from "../enums/role.enum";
import { ForbiddenException } from "./appError";
import { RolePermissions } from "./role-permission";

export const roleGuard = (
  role: keyof typeof RolePermissions | null | undefined,
  requiredPermissions: PermissionType[]
): void => {
  if (!role) {
    throw new ForbiddenException("No role specified");
  }

  const permissions = RolePermissions[role];
  
  // Check if the role exists
  if (!permissions) {
    throw new ForbiddenException(`Invalid role: ${role}`);
  }

  // Check if role has all required permissions
  const missingPermissions = requiredPermissions.filter(
    permission => !permissions.includes(permission)
  );

  if (missingPermissions.length > 0) {
    throw new ForbiddenException(
      `Role ${role} is missing required permissions: ${missingPermissions.join(", ")}`
    );
  }
};
