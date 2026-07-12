import mongoose, { Document } from "mongoose";

export interface ITokenRevocation extends Document {
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

const TokenRevocationSchema = new mongoose.Schema<ITokenRevocation>(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true
    },
    expiresAt: {
      type: Date,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now,
      required: true
    }
  },
  {
    collection: "token_revocations"
  }
);

TokenRevocationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const TokenRevocation = mongoose.model<ITokenRevocation>(
  "TokenRevocation",
  TokenRevocationSchema
);

export default TokenRevocation;
