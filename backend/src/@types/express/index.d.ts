import { JwtPayload } from "jsonwebtoken";

declare global {
  namespace Express {
    interface User extends JwtPayload {
      _id: string;
      name: string;
      email: string;
      profilePicture: string | null;
    }
  }
}
