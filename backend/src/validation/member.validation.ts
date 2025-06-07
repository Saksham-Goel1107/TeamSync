import { z } from "zod";

export const removeMemberSchema = z.object({
  memberId: z.string(),
});

export const transferOwnershipSchema = z.object({
  newOwnerId: z.string(),
});
