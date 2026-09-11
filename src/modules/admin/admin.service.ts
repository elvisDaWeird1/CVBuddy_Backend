import type { PipelineStage } from "mongoose";

import { ACCOUNT_ROLES, ACCOUNT_STATUSES } from "../../constants/enums";
import Account from "../accounts/account.model";

const METRICS_WINDOW_DAYS = 7;
const METRICS_WINDOW_MS = METRICS_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const USER_ROLES = [ACCOUNT_ROLES.APPLICANT, ACCOUNT_ROLES.COMPANY];

interface AggregatedUserMetrics {
  totalUsers: number;
  applicants: number;
  companies: number;
  activeUsers: number;
  newUsersLast7Days: number;
}

const emptyMetrics = (): AggregatedUserMetrics => ({
  totalUsers: 0,
  applicants: 0,
  companies: 0,
  activeUsers: 0,
  newUsersLast7Days: 0
});

const buildUserMetricsPipeline = (newUserCutoff: Date): PipelineStage[] => [
  {
    $match: {
      role: { $in: USER_ROLES }
    }
  },
  {
    $group: {
      _id: null,
      totalUsers: { $sum: 1 },
      applicants: {
        $sum: { $cond: [{ $eq: ["$role", ACCOUNT_ROLES.APPLICANT] }, 1, 0] }
      },
      companies: {
        $sum: { $cond: [{ $eq: ["$role", ACCOUNT_ROLES.COMPANY] }, 1, 0] }
      },
      activeUsers: {
        $sum: { $cond: [{ $eq: ["$status", ACCOUNT_STATUSES.ACTIVE] }, 1, 0] }
      },
      newUsersLast7Days: {
        $sum: { $cond: [{ $gte: ["$createdAt", newUserCutoff] }, 1, 0] }
      }
    }
  },
  {
    $project: {
      _id: 0,
      totalUsers: 1,
      applicants: 1,
      companies: 1,
      activeUsers: 1,
      newUsersLast7Days: 1
    }
  }
];

const getUserMetricsOverview = async (now = new Date()) => {
  const newUserCutoff = new Date(now.getTime() - METRICS_WINDOW_MS);
  const [metrics] = await Account.aggregate<AggregatedUserMetrics>(
    buildUserMetricsPipeline(newUserCutoff)
  );

  return {
    ...(metrics || emptyMetrics()),
    generatedAt: now.toISOString()
  };
};

export {
  buildUserMetricsPipeline,
  getUserMetricsOverview
};
