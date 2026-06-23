import type { HydratedDocument, Types } from "mongoose";

declare global {
  namespace Express {
    interface Request {
      user?: HydratedDocument<{
        _id: Types.ObjectId;
        email: string;
        passwordHash?: string;
        role: "APPLICANT" | "COMPANY" | "ADMIN";
        status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
      }>;
      account?: Request["user"];
    }
  }
}

export {};
