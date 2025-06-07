import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthContext } from "@/context/auth-provider";
import { toast } from "@/hooks/use-toast";
import { CheckIcon, CopyIcon, Loader, RefreshCw } from "lucide-react";
import { BASE_ROUTE } from "@/routes/common/routePaths";
import PermissionsGuard from "@/components/resuable/permission-guard";
import { Permissions } from "@/constant";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { regenerateInviteCodeMutationFn } from "@/lib/api";

const InviteMember = () => {
  const queryClient = useQueryClient();
  const { workspace, workspaceLoading, hasPermission } = useAuthContext();
  const [copied, setCopied] = useState(false);

  const canRegenerateInvite = hasPermission(Permissions.MANAGE_WORKSPACE_SETTINGS);

  const { mutate: regenerateInvite, isPending: isRegenerating } = useMutation({
    mutationFn: regenerateInviteCodeMutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
      toast({
        title: "Success",
        description: "Invite link regenerated successfully",
        variant: "success",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const inviteUrl = workspace
    ? `${window.location.origin}${BASE_ROUTE.INVITE_URL.replace(
        ":inviteCode",
        workspace.inviteCode
      )}`
    : "";

  const handleCopy = () => {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl).then(() => {
        setCopied(true);
        toast({
          title: "Copied",
          description: "Invite url copied to clipboard",
          variant: "success",
        });
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const handleRegenerateInvite = () => {
    if (workspace?._id) {
      regenerateInvite(workspace._id);
    }
  };

  return (
    <div className="flex flex-col pt-0.5 px-0 ">
      <h5 className="text-lg  leading-[30px] font-semibold mb-1">
        Invite members to join you
      </h5>
      <p className="text-sm text-muted-foreground leading-tight">
        Anyone with an invite link can join this free Workspace. You can also
        disable and create a new invite link for this Workspace at any time.
      </p>

      <PermissionsGuard showMessage requiredPermission={Permissions.ADD_MEMBER}>
        {workspaceLoading ? (
          <Loader
            className="w-8 h-8 
            animate-spin
            place-self-center
            flex"
          />
        ) : (
          <div className="flex flex-col gap-4 py-3">
            <div className="flex gap-2">
              <Label htmlFor="link" className="sr-only">
                Link
              </Label>
              <Input
                id="link"
                disabled={true}
                className="disabled:opacity-100 disabled:pointer-events-none"
                value={inviteUrl}
                readOnly
              />
              <Button
                disabled={false}
                className="shrink-0"
                size="icon"
                onClick={handleCopy}
              >
                {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
              </Button>
            </div>
            {canRegenerateInvite && (
              <div>
                <Button
                  variant="outline"
                  onClick={handleRegenerateInvite}
                  disabled={isRegenerating}
                  className="flex gap-2"
                >
                  {isRegenerating ? (
                    <Loader className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Regenerate invite link
                </Button>
                <p className="text-sm text-muted-foreground mt-1">
                  This will deactivate the current invite link and generate a new one.
                </p>
              </div>
            )}
          </div>
        )}
      </PermissionsGuard>
    </div>
  );
};

export default InviteMember;
