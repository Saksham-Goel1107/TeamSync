export interface Role {
  _id: string;
  name: string;
}

export interface Member {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    profilePicture?: string;
  };
  workspaceId: string;
  role: Role;
  joinedAt: string;
}
