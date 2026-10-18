import { ClientSession, Types } from "mongoose";

import {
  PLAN_CATALOG,
  PLAN_CATALOG_VERSION,
  PLAN_CODES
} from "../../config/planCatalog";
import EntitlementGrant, {
  ENTITLEMENT_STATUSES
} from "./entitlementGrant.model";

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfUtcMonth = (value: Date) => new Date(Date.UTC(
  value.getUTCFullYear(),
  value.getUTCMonth(),
  1
));

const startOfNextUtcMonth = (value: Date) => new Date(Date.UTC(
  value.getUTCFullYear(),
  value.getUTCMonth() + 1,
  1
));

const creditsRemaining = (granted: number, consumed: number) =>
  Math.max(0, granted - consumed);

const withSession = <T extends { session: (session: ClientSession) => T }>(
  query: T,
  session?: ClientSession
) => session ? query.session(session) : query;

const serializeEffectiveGrant = (grant) => ({
  grantId: grant._id.toString(),
  planCode: grant.planCode,
  startsAt: grant.startsAt,
  endsAt: grant.endsAt,
  creditsGranted: grant.creditsGranted,
  creditsConsumed: grant.creditsConsumed,
  creditsRemaining: creditsRemaining(grant.creditsGranted, grant.creditsConsumed),
  source: "ENTITLEMENT_GRANT" as const,
  catalogVersion: PLAN_CATALOG_VERSION
});

const getFreeEntitlement = (now = new Date()) => {
  const plan = PLAN_CATALOG[PLAN_CODES.FREE];
  return {
    grantId: null,
    planCode: PLAN_CODES.FREE,
    startsAt: startOfUtcMonth(now),
    endsAt: startOfNextUtcMonth(now),
    creditsGranted: plan.creditsGranted,
    creditsConsumed: 0,
    creditsRemaining: plan.creditsGranted,
    source: "MONTHLY_FREE_POLICY" as const,
    catalogVersion: PLAN_CATALOG_VERSION
  };
};

const freeSourceOrderId = (accountId, startsAt: Date) =>
  `free:${accountId.toString()}:${startsAt.toISOString().slice(0, 7)}`;

const ensureFreeEntitlement = async (
  accountId,
  now = new Date(),
  session?: ClientSession
) => {
  const startsAt = startOfUtcMonth(now);
  const endsAt = startOfNextUtcMonth(now);
  const sourceOrderId = freeSourceOrderId(accountId, startsAt);
  const existing = await getExistingSourceGrant(sourceOrderId, session);
  if (existing) return existing;

  const plan = PLAN_CATALOG[PLAN_CODES.FREE];
  try {
    const [grant] = await EntitlementGrant.create([{
      accountId,
      sourceOrderId,
      planCode: PLAN_CODES.FREE,
      startsAt,
      endsAt,
      creditsGranted: plan.creditsGranted,
      creditsConsumed: 0,
      status: ENTITLEMENT_STATUSES.ACTIVE
    }], { session });
    return grant;
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    const concurrentGrant = await getExistingSourceGrant(sourceOrderId, session);
    if (!concurrentGrant) throw error;
    return concurrentGrant;
  }
};

const getEffectiveEntitlement = async (
  accountId,
  now = new Date(),
  session?: ClientSession
) => {
  const activeGrant = await withSession(EntitlementGrant.findOne({
    accountId,
    planCode: PLAN_CODES.PRO_30D,
    status: ENTITLEMENT_STATUSES.ACTIVE,
    startsAt: { $lte: now },
    endsAt: { $gt: now }
  }).sort({ endsAt: -1 }), session);

  if (activeGrant) return serializeEffectiveGrant(activeGrant);
  const freeGrant = await ensureFreeEntitlement(accountId, now, session);
  return serializeEffectiveGrant(freeGrant);
};

const getExistingSourceGrant = (sourceOrderId: string, session?: ClientSession) =>
  withSession(EntitlementGrant.findOne({ sourceOrderId }), session);

const grantPro30Days = async ({
  accountId,
  sourceOrderId,
  now = new Date(),
  session
}: {
  accountId: Types.ObjectId | string;
  sourceOrderId: string;
  now?: Date;
  session?: ClientSession;
}) => {
  const normalizedSourceOrderId = sourceOrderId.trim();
  if (!normalizedSourceOrderId) {
    throw new Error("sourceOrderId is required to grant PRO_30D");
  }

  const existing = await getExistingSourceGrant(normalizedSourceOrderId, session);
  if (existing) return { grant: existing, created: false };

  const latestGrant = await withSession(EntitlementGrant.findOne({
    accountId,
    planCode: PLAN_CODES.PRO_30D,
    status: { $ne: ENTITLEMENT_STATUSES.REVOKED }
  }).sort({ endsAt: -1 }), session);

  const startsAt = latestGrant?.endsAt && latestGrant.endsAt > now
    ? new Date(latestGrant.endsAt)
    : new Date(now);
  const plan = PLAN_CATALOG[PLAN_CODES.PRO_30D];
  const endsAt = new Date(startsAt.getTime() + plan.durationDays * DAY_MS);

  try {
    const [grant] = await EntitlementGrant.create([{
      accountId,
      sourceOrderId: normalizedSourceOrderId,
      planCode: PLAN_CODES.PRO_30D,
      startsAt,
      endsAt,
      creditsGranted: plan.creditsGranted,
      creditsConsumed: 0,
      status: ENTITLEMENT_STATUSES.ACTIVE
    }], { session });
    return { grant, created: true };
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    const concurrentGrant = await getExistingSourceGrant(normalizedSourceOrderId, session);
    if (!concurrentGrant) throw error;
    return { grant: concurrentGrant, created: false };
  }
};

const expireEndedGrants = (now = new Date()) => EntitlementGrant.updateMany(
  {
    status: ENTITLEMENT_STATUSES.ACTIVE,
    endsAt: { $lte: now }
  },
  {
    $set: { status: ENTITLEMENT_STATUSES.EXPIRED }
  }
);

export {
  expireEndedGrants,
  ensureFreeEntitlement,
  freeSourceOrderId,
  getEffectiveEntitlement,
  getFreeEntitlement,
  grantPro30Days,
  startOfNextUtcMonth,
  startOfUtcMonth
};
