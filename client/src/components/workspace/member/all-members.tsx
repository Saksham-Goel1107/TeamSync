import React from "react";
import { ChevronDown, Loader, LogOut, Trash2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getAvatarColor, getAvatarFallbackText } from "@/lib/helper";
import { useAuthContext } from "@/context/auth-provider";
import useWorkspaceId from "@/hooks/use-workspace-id";
import useGetWorkspaceMembers from "@/hooks/api/use-get-workspace-members";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  changeWorkspaceMemberRoleMutationFn,
  removeMemberMutationFn,
  leaveWorkspaceMutationFn,
  transferWorkspaceOwnershipMutationFn,
  promoteToCoOwnerMutationFn,
} from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Permissions } from "@/constant";
import { ConfirmDialog } from "@/components/resuable/confirm-dialog";
import useConfirmDialog from "@/hooks/use-confirm-dialog";
import { useNavigate } from "react-router-dom";
import { Member, Role } from "@/types/member.type";
import { APIError } from "@/types/error.type";
import { ToastOptions } from "@/types/toast.type";

type SelectedMember = {
  id: string;
  name: string;
};

const AllMembers = () => {
  const { user, hasPermission, workspace } = useAuthContext();
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();

  const {
    open: openRemove,
    onOpenDialog: onOpenRemoveDialog,
    onCloseDialog: onCloseRemoveDialog,
  } = useConfirmDialog("remove-member");

  const {
    open: openLeave,
    onOpenDialog: onOpenLeaveDialog,
    onCloseDialog: onCloseLeaveDialog,
  } = useConfirmDialog("leave-workspace");

  const {
    open: openTransfer,
    onOpenDialog: onOpenTransferDialog,
    onCloseDialog: onCloseTransferDialog,
  } = useConfirmDialog("transfer-ownership");
  
  const {
    open: openCoOwnerPrompt,
    onOpenDialog: onOpenCoOwnerPromptDialog,
    onCloseDialog: onCloseCoOwnerPromptDialog,
  } = useConfirmDialog("co-owner-prompt");

  const { data, isPending } = useGetWorkspaceMembers(workspaceId);
  const members = (data?.members || []) as Member[];
  const roles = (data?.roles || []) as Role[];

  const canChangeMemberRole = hasPermission(Permissions.CHANGE_MEMBER_ROLE);
  const canManageWorkspace = hasPermission(Permissions.MANAGE_WORKSPACE_SETTINGS);

  const currentMember = members.find((m) => m.userId._id === user?._id);
  const isOwner = currentMember?.role.name === "OWNER";

  const [memberToRemove, setMemberToRemove] = React.useState<SelectedMember | null>(null);
  const [memberToTransferTo, setMemberToTransferTo] = React.useState<SelectedMember | null>(null);
  const [memberToPromote, setMemberToPromote] = React.useState<SelectedMember | null>(null);

  const { mutateAsync: changeRole, isPending: isChangingRole } = useMutation({
    mutationFn: changeWorkspaceMemberRoleMutationFn,
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["members", workspaceId] });
    }
  });

  const { mutateAsync: removeMember, isPending: isRemoving } = useMutation({
    mutationFn: removeMemberMutationFn,
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["members", workspaceId] });
    }
  });

  const { mutateAsync: leaveWorkspace, isPending: isLeaving } = useMutation({
    mutationFn: leaveWorkspaceMutationFn,
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["userWorkspaces"] });
    }
  });

  const { mutateAsync: transferOwnership, isPending: isTransferring } = useMutation({
    mutationFn: transferWorkspaceOwnershipMutationFn,
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["members", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["userWorkspaces"] });
    }
  });
  
  const { isPending: isPromoting } = useMutation({
    mutationFn: promoteToCoOwnerMutationFn,
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["members", workspaceId] });
    }
  });

  const handleLeaveWorkspace = async () => {
    if (!workspaceId) return;

    try {
      // Leave the workspace first
      await leaveWorkspace(workspaceId);
      
      // Navigate before showing toast to ensure we're out of the workspace
      navigate("/");
      
      // Show success message after navigation
      const toastOptions: ToastOptions = {
        title: "Left Workspace",
        description: `You have successfully left "${workspace?.name}"`,
        variant: "success",
      };
      toast(toastOptions);
      
      // Invalidate queries after leaving
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["userWorkspaces"] }),
        queryClient.invalidateQueries({ queryKey: ["currentWorkspace"] }),
        queryClient.invalidateQueries({ queryKey: ["currentUser"] })
      ]);
      
      // Finally close the dialog
      onCloseLeaveDialog();
    } catch (error) {
      console.error('Leave workspace error:', error);
      const apiError = error as APIError;
      const toastOptions: ToastOptions = {
        title: "Error",
        description: apiError.response?.data?.message || "Failed to leave workspace. Please try again.",
        variant: "destructive",
      };
      toast(toastOptions);
      onCloseLeaveDialog();
    }
  };

  const handleSelect = (roleId: string, memberId: string) => {
    if (!roleId || !memberId || !workspaceId) return;

    const member = members.find(m => m.userId._id === memberId);
    if (!member) return;

    const newRole = roles.find(r => r._id === roleId);
    if (!newRole) return;

    // If promoting to co-owner, show confirmation prompt first
    if (newRole.name === "CO_OWNER") {
      setMemberToPromote({
        id: memberId,
        name: member.userId.name,
      });
      onOpenCoOwnerPromptDialog();
      return;
    }

    // For other roles, proceed with the change directly
    const payload = {
      workspaceId,
      data: { roleId, memberId },
    };

    changeRole(payload, {
      onSuccess: () => {
        const toastOptions: ToastOptions = {
          title: "Role Updated",
          description: `Changed ${member.userId.name}'s role to ${newRole.name.toLowerCase()}`,
          variant: "success",
        };
        toast(toastOptions);
        queryClient.invalidateQueries({ queryKey: ["members", workspaceId] });
      },
      onError: (error: APIError) => {
        const toastOptions: ToastOptions = {
          title: "Error",
          description: error.response?.data?.message || "Failed to change role",
          variant: "destructive",
        };
        toast(toastOptions);
      },
    });
  };

  const handleRemoveMember = () => {
    if (!memberToRemove || !workspaceId) return;

    removeMember(
      { workspaceId, memberId: memberToRemove.id },
      {
        onSuccess: () => {
          const toastOptions: ToastOptions = {
            title: "Member Removed",
            description: `${memberToRemove.name} has been removed from the workspace`,
            variant: "success",
          };
          toast(toastOptions);
          queryClient.invalidateQueries({ queryKey: ["members", workspaceId] });
          onCloseRemoveDialog();
        },
        onError: (error: APIError) => {
          const toastOptions: ToastOptions = {
            title: "Error",
            description: error.response?.data?.message || "Failed to remove member",
            variant: "destructive",
          };
          toast(toastOptions);
          onCloseRemoveDialog();
        },
      }
    );
  };

  const handleTransferOwnership = async () => {
    if (!memberToTransferTo || !workspaceId) return;

    try {
      const payload = { workspaceId, newOwnerId: memberToTransferTo.id };
      await transferOwnership(payload);
      
      // Show success message
      const toastOptions: ToastOptions = {
        title: "Ownership Transferred",
        description: `Workspace ownership has been transferred to ${memberToTransferTo.name}`,
        variant: "success",
      };
      toast(toastOptions);
      
      // Wait for all queries to be invalidated
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["members", workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ["userWorkspaces"] }),
        queryClient.invalidateQueries({ queryKey: ["currentWorkspace"] }),
        queryClient.invalidateQueries({ queryKey: ["currentUser"] })
      ]);
      
      // Reset state and close dialog
      setMemberToTransferTo(null);
      onCloseTransferDialog();
      
      // Navigate to workspace root as the user is no longer the owner
      setTimeout(() => {
        navigate(`/workspace/${workspaceId}`);
      }, 100);
    } catch (error) {
      console.error('Transfer ownership error:', error);
      const apiError = error as APIError;
      const toastOptions: ToastOptions = {
        title: "Transfer Failed",
        description: apiError.response?.data?.message || "Failed to transfer ownership. Please try again.",
        variant: "destructive",
      };
      toast(toastOptions);
      onCloseTransferDialog();
    }
  };
  
  const handlePromoteToCoOwner = async () => {
    if (!memberToPromote || !workspaceId) return;

    try {
      // Find the co-owner role ID
      const coOwnerRole = roles.find(r => r.name === "CO_OWNER");
      if (!coOwnerRole) {
        throw new Error("Co-owner role not found");
      }
      
      const payload = {
        workspaceId,
        data: { roleId: coOwnerRole._id, memberId: memberToPromote.id },
      };

      await changeRole(payload);
      
      const toastOptions: ToastOptions = {
        title: "Co-Owner Added",
        description: `${memberToPromote.name} has been promoted to co-owner`,
        variant: "success",
      };
      toast(toastOptions);
      
      queryClient.invalidateQueries({ queryKey: ["members", workspaceId] });
      onCloseCoOwnerPromptDialog();
    } catch (error) {
      console.error('Promote to co-owner error:', error);
      const apiError = error as APIError;
      const toastOptions: ToastOptions = {
        title: "Error",
        description: apiError.response?.data?.message || "Failed to promote to co-owner",
        variant: "destructive",
      };
      toast(toastOptions);
      onCloseCoOwnerPromptDialog();
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Members</h3>
        {!isOwner && !isPending && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 hover:bg-destructive hover:text-destructive-foreground"
            onClick={() => {
              if (!workspace?.name) return;
              onOpenLeaveDialog();
            }}
            disabled={isLeaving || !workspace?.name}
          >
            {isLeaving ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="h-4 w-4" />
            )}
            Leave Workspace
          </Button>
        )}
      </div>

      <div className="grid gap-6 pt-2">
        {isPending && (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="flex items-center justify-between space-x-4 animate-pulse">
                <div className="flex items-center space-x-4">
                  <div className="h-8 w-8 rounded-full bg-gray-200" />
                  <div>
                    <div className="h-4 w-32 bg-gray-200 rounded mb-2" />
                    <div className="h-3 w-24 bg-gray-200 rounded" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-24 bg-gray-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isPending && members?.map((member) => {
          const name = member.userId?.name;
          const initials = getAvatarFallbackText(name);
          const avatarColor = getAvatarColor(name);
          const isCurrentUser = member.userId._id === user?._id;
          const canRemove =
            canManageWorkspace &&
            !isCurrentUser &&
            member.role.name !== "OWNER" &&
            // Prevent co-owners from removing other co-owners
            !(currentMember?.role.name === "CO_OWNER" && member.role.name === "CO_OWNER") &&
            // Prevent admins from removing other admins or co-owners
            !(currentMember?.role.name === "ADMIN" && (member.role.name === "ADMIN" || member.role.name === "CO_OWNER"));
          const canBecomeOwner =
            member.role.name === "CO_OWNER" && isOwner && !isCurrentUser;

          return (
            <div
              key={member._id}
              className="flex items-center justify-between space-x-4"
            >
              <div className="flex items-center space-x-4">
                <Avatar className="h-8 w-8">
                  <AvatarImage
                    src={member.userId?.profilePicture || ""}
                    alt={name}
                  />
                  <AvatarFallback className={avatarColor}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium leading-none">
                    {name}
                    {isCurrentUser && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (You)
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {member.userId.email}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {canBecomeOwner && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setMemberToTransferTo({
                          id: member.userId._id,
                          name: name,
                        });
                        onOpenTransferDialog();
                      }}
                      className="h-8 px-3 text-xs"
                      disabled={isTransferring}
                    >
                      {isTransferring && memberToTransferTo?.id === member.userId._id ? (
                        <Loader className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Make Owner
                    </Button>
                  )}


                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={
                          member.role.name === "OWNER" ? "secondary" : "outline"
                        }
                        size="sm"
                        className="ml-auto min-w-24 capitalize disabled:opacity-95 disabled:pointer-events-none"
                        disabled={
                          isChangingRole ||
                          !canChangeMemberRole ||
                          isCurrentUser ||
                          member.role.name === "OWNER" ||
                          // Disable for co-owners trying to manage other co-owners
                          (currentMember?.role.name === "CO_OWNER" && member.role.name === "CO_OWNER") ||
                          // Disable for admins trying to manage other admins
                          (currentMember?.role.name === "ADMIN" && member.role.name === "ADMIN")
                        }
                      >
                        {member.role.name?.toLowerCase()}{" "}
                        {canChangeMemberRole &&
                          !isCurrentUser &&
                          member.role.name !== "OWNER" &&
                          // Don't show dropdown for co-owners managing other co-owners
                          !(currentMember?.role.name === "CO_OWNER" && member.role.name === "CO_OWNER") &&
                          // Don't show dropdown for admins managing other admins
                          !(currentMember?.role.name === "ADMIN" && member.role.name === "ADMIN") && (
                            <ChevronDown className="text-muted-foreground" />
                          )}
                      </Button>
                    </PopoverTrigger>

                    {canChangeMemberRole && 
                     !isCurrentUser && 
                     member.role.name !== "OWNER" &&
                     // Prevent co-owners from modifying other co-owners
                     !(currentMember?.role.name === "CO_OWNER" && member.role.name === "CO_OWNER") &&
                     // Prevent admins from modifying other admins
                     !(currentMember?.role.name === "ADMIN" && member.role.name === "ADMIN") && (
                      <PopoverContent className="p-0" align="end">
                        <Command>
                          <CommandInput
                            placeholder="Select new role..."
                            disabled={isChangingRole}
                            className="disabled:pointer-events-none"
                          />
                          <CommandList>
                            {isChangingRole ? (
                              <Loader className="w-8 h-8 animate-spin place-self-center flex my-4" />
                            ) : (
                              <>
                                <CommandEmpty>No roles found.</CommandEmpty>
                                <CommandGroup>
                                  {roles?.map(
                                    (role) =>
                                      role.name !== "OWNER" && (
                                        <CommandItem
                                          key={role._id}
                                          disabled={isChangingRole}
                                          className="disabled:pointer-events-none gap-1 mb-1 flex flex-col items-start px-4 py-2 cursor-pointer"
                                          onSelect={() =>
                                            handleSelect(role._id, member.userId._id)
                                          }
                                        >
                                          <p className="capitalize">
                                            {role.name?.toLowerCase()}
                                          </p>
                                          <p className="text-sm text-muted-foreground">
                                            {role.name === "ADMIN"
                                              ? "Can view, create, edit tasks, project and manage settings. Can become owner."
                                              : "Can view and edit only tasks created by them."}
                                          </p>
                                        </CommandItem>
                                      )
                                  )}
                                </CommandGroup>
                              </>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    )}
                  </Popover>
                </div>

                {canRemove && (
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={isRemoving}
                    onClick={() => {
                      setMemberToRemove({ id: member.userId._id, name });
                      onOpenRemoveDialog();
                    }}
                  >
                    {isRemoving && memberToRemove?.id === member.userId._id ? (
                      <Loader className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        isOpen={openRemove}
        isLoading={isRemoving}
        onClose={onCloseRemoveDialog}
        onConfirm={handleRemoveMember}
        title={`Remove ${memberToRemove?.name}`}
        description={`Are you sure you want to remove ${memberToRemove?.name} from the workspace? This action cannot be undone.`}
      />

      <ConfirmDialog
        isOpen={openLeave}
        isLoading={isLeaving}
        onClose={onCloseLeaveDialog}
        onConfirm={handleLeaveWorkspace}
        title="Leave Workspace"
        description={`Are you sure you want to leave "${workspace?.name}"? You will lose access to all workspace content and this action cannot be undone.`}
      />

      <ConfirmDialog
        isOpen={openTransfer}
        isLoading={isTransferring}
        onClose={onCloseTransferDialog}
        onConfirm={handleTransferOwnership}
        title="Transfer Workspace Ownership"
        description={
          memberToTransferTo
            ? `Are you sure you want to transfer ownership to ${memberToTransferTo.name}? This will make them the new owner and you will become a member. This action cannot be undone.`
            : ""
        }
      />

      <ConfirmDialog
        isOpen={openCoOwnerPrompt}
        isLoading={isPromoting}
        onClose={onCloseCoOwnerPromptDialog}
        onConfirm={handlePromoteToCoOwner}
        title="Promote to Co-Owner"
        description={
          memberToPromote
            ? `Are you sure you want to promote ${memberToPromote.name} to co-owner?

Co-owners have extensive permissions including:
• Managing workspace settings
• Adding/removing members
• Changing member roles
• Creating and managing all projects
• Accessing all workspace data

Only promote trusted users to co-owner. This gives them significant control over your workspace.`
            : ""
        }
      />
    </>
  );
};

export default AllMembers;
