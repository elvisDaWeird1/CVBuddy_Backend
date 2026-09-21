import crypto from "crypto";

import TokenRevocation from "./tokenRevocation.model";

const hashToken = (token: string) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

const isTokenRevoked = async (token: string) => {
  const tokenHash = hashToken(token);
  const revokedToken = await TokenRevocation.exists({
    tokenHash,
    expiresAt: { $gt: new Date() }
  });

  return Boolean(revokedToken);
};

const revokeToken = async (token: string, expiresAt: Date) => {
  const tokenHash = hashToken(token);

  await TokenRevocation.updateOne(
    { tokenHash },
    {
      $setOnInsert: {
        tokenHash,
        expiresAt
      }
    },
    { upsert: true }
  );
};

export {
  isTokenRevoked,
  revokeToken
};
