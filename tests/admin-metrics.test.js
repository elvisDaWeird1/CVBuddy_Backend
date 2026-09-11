const assert = require("assert").strict;
const test = require("node:test");
const express = require("express");
const bcrypt = require("bcrypt");

const { ACCOUNT_ROLES, ACCOUNT_STATUSES } = require("../src/constants/enums");
const Account = require("../src/modules/accounts/account.model").default;
const adminService = require("../src/modules/admin/admin.service");
const { provisionAdmin } = require("../src/modules/admin/adminProvisioning.service");
const adminRouter = require("../src/modules/admin/admin.routes").default;
const jwtUtils = require("../src/utils/jwt");
const tokenRevocationService = require("../src/modules/auth/tokenRevocation.service");
const { errorHandler } = require("../src/middlewares/error.middleware");
const { swaggerComponents, swaggerPaths } = require("../src/docs/swagger.paths");

test("admin metrics aggregate Applicant and Company accounts without PII", async () => {
  const originalAggregate = Account.aggregate;
  const now = new Date("2026-09-11T12:00:00.000Z");
  const recentDate = new Date("2026-09-10T12:00:00.000Z");
  const oldDate = new Date("2026-08-01T12:00:00.000Z");
  const fixtures = [
    { role: ACCOUNT_ROLES.APPLICANT, status: ACCOUNT_STATUSES.ACTIVE, createdAt: recentDate },
    { role: ACCOUNT_ROLES.APPLICANT, status: ACCOUNT_STATUSES.ACTIVE, createdAt: oldDate },
    { role: ACCOUNT_ROLES.APPLICANT, status: ACCOUNT_STATUSES.SUSPENDED, createdAt: oldDate },
    { role: ACCOUNT_ROLES.COMPANY, status: ACCOUNT_STATUSES.ACTIVE, createdAt: recentDate },
    { role: ACCOUNT_ROLES.COMPANY, status: ACCOUNT_STATUSES.ACTIVE, createdAt: oldDate },
    { role: ACCOUNT_ROLES.ADMIN, status: ACCOUNT_STATUSES.ACTIVE, createdAt: recentDate }
  ];
  let capturedPipeline;

  Account.aggregate = async (pipeline) => {
    capturedPipeline = pipeline;
    const cutoff = pipeline[1].$group.newUsersLast7Days.$sum.$cond[0].$gte[1];
    const users = fixtures.filter((account) =>
      [ACCOUNT_ROLES.APPLICANT, ACCOUNT_ROLES.COMPANY].includes(account.role)
    );
    return [{
      totalUsers: users.length,
      applicants: users.filter((account) => account.role === ACCOUNT_ROLES.APPLICANT).length,
      companies: users.filter((account) => account.role === ACCOUNT_ROLES.COMPANY).length,
      activeUsers: users.filter((account) => account.status === ACCOUNT_STATUSES.ACTIVE).length,
      newUsersLast7Days: users.filter((account) => account.createdAt >= cutoff).length
    }];
  };

  try {
    const result = await adminService.getUserMetricsOverview(now);
    assert.deepEqual(result, {
      totalUsers: 5,
      applicants: 3,
      companies: 2,
      activeUsers: 4,
      newUsersLast7Days: 2,
      generatedAt: now.toISOString()
    });
    assert.deepEqual(capturedPipeline[0], {
      $match: {
        role: { $in: [ACCOUNT_ROLES.APPLICANT, ACCOUNT_ROLES.COMPANY] }
      }
    });
    assert.equal(JSON.stringify(result).includes("email"), false);
    assert.equal(JSON.stringify(result).includes("fullName"), false);
  } finally {
    Account.aggregate = originalAggregate;
  }
});

test("Swagger documents the protected aggregate-only admin contract", () => {
  const operation = swaggerPaths["/api/admin/metrics/overview"].get;
  const properties = swaggerComponents.schemas.AdminMetricsOverview.properties;

  assert.deepEqual(operation.security, [{ bearerAuth: [] }]);
  assert.ok(operation.responses[401]);
  assert.ok(operation.responses[403]);
  assert.deepEqual(Object.keys(properties).sort(), [
    "activeUsers",
    "applicants",
    "companies",
    "generatedAt",
    "newUsersLast7Days",
    "totalUsers"
  ]);
});

test("admin metrics return zero counts when no user accounts exist", async () => {
  const originalAggregate = Account.aggregate;
  Account.aggregate = async () => [];

  try {
    const result = await adminService.getUserMetricsOverview(new Date("2026-09-11T12:00:00.000Z"));
    assert.equal(result.totalUsers, 0);
    assert.equal(result.applicants, 0);
    assert.equal(result.companies, 0);
    assert.equal(result.activeUsers, 0);
    assert.equal(result.newUsersLast7Days, 0);
  } finally {
    Account.aggregate = originalAggregate;
  }
});

test("admin provisioning is idempotent and promotion requires an explicit flag", async () => {
  const originalFindOne = Account.findOne;
  const originalCreate = Account.create;
  const originalHash = bcrypt.hash;
  const originalSaltRounds = process.env.BCRYPT_SALT_ROUNDS;
  let existingAccount;
  let hashCalls = 0;

  process.env.BCRYPT_SALT_ROUNDS = "10";
  Account.findOne = () => ({ select: async () => existingAccount });
  bcrypt.hash = async () => {
    hashCalls += 1;
    return "hashed-admin-password";
  };

  try {
    existingAccount = {
      _id: { toString: () => "admin-1" },
      role: ACCOUNT_ROLES.ADMIN,
      status: ACCOUNT_STATUSES.ACTIVE
    };
    const unchanged = await provisionAdmin({
      email: "ADMIN@example.com",
      password: "secure-password"
    });
    assert.equal(unchanged.action, "already-admin");
    assert.equal(hashCalls, 0);

    existingAccount = {
      _id: { toString: () => "applicant-1" },
      role: ACCOUNT_ROLES.APPLICANT,
      status: ACCOUNT_STATUSES.ACTIVE,
      save: async () => undefined
    };
    await assert.rejects(
      () => provisionAdmin({
        email: "applicant@example.com",
        password: "secure-password"
      }),
      (error) => error.statusCode === 409 && error.code === "ADMIN_PROMOTION_REQUIRES_CONFIRMATION"
    );

    const promoted = await provisionAdmin({
      email: "applicant@example.com",
      password: "secure-password",
      promoteExisting: true
    });
    assert.equal(promoted.action, "promoted");
    assert.equal(existingAccount.role, ACCOUNT_ROLES.ADMIN);
    assert.equal(existingAccount.status, ACCOUNT_STATUSES.ACTIVE);
    assert.equal(existingAccount.passwordHash, "hashed-admin-password");
    assert.equal(hashCalls, 1);

    existingAccount = null;
    Account.create = async (payload) => ({
      ...payload,
      _id: { toString: () => "admin-2" }
    });
    const created = await provisionAdmin({
      email: "new-admin@example.com",
      password: "secure-password"
    });
    assert.equal(created.action, "created");
    assert.equal(created.role, ACCOUNT_ROLES.ADMIN);
    assert.equal(created.status, ACCOUNT_STATUSES.ACTIVE);
  } finally {
    Account.findOne = originalFindOne;
    Account.create = originalCreate;
    bcrypt.hash = originalHash;
    if (originalSaltRounds === undefined) delete process.env.BCRYPT_SALT_ROUNDS;
    else process.env.BCRYPT_SALT_ROUNDS = originalSaltRounds;
  }
});

test("admin metrics endpoint enforces authentication and ADMIN role", async () => {
  const originalFindById = Account.findById;
  const originalAggregate = Account.aggregate;
  const originalVerifyAuthToken = jwtUtils.verifyAuthToken;
  const originalIsTokenRevoked = tokenRevocationService.isTokenRevoked;

  jwtUtils.verifyAuthToken = (token) => ({
    accountId: token,
    exp: Math.floor(Date.now() / 1000) + 3600
  });
  tokenRevocationService.isTokenRevoked = async () => false;
  Account.findById = async (accountId) => ({
    _id: accountId,
    role: accountId === "admin-token" ? ACCOUNT_ROLES.ADMIN : ACCOUNT_ROLES.APPLICANT,
    status: ACCOUNT_STATUSES.ACTIVE
  });
  Account.aggregate = async () => [{
    totalUsers: 4,
    applicants: 3,
    companies: 1,
    activeUsers: 4,
    newUsersLast7Days: 1
  }];

  const app = express();
  app.use("/api/admin", adminRouter);
  app.use(errorHandler);
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const anonymousResponse = await fetch(`${baseUrl}/api/admin/metrics/overview`);
    assert.equal(anonymousResponse.status, 401);

    const applicantResponse = await fetch(`${baseUrl}/api/admin/metrics/overview`, {
      headers: { Authorization: "Bearer applicant-token" }
    });
    assert.equal(applicantResponse.status, 403);

    const adminResponse = await fetch(`${baseUrl}/api/admin/metrics/overview`, {
      headers: { Authorization: "Bearer admin-token" }
    });
    assert.equal(adminResponse.status, 200);
    const payload = await adminResponse.json();
    assert.deepEqual(payload.data, {
      totalUsers: 4,
      applicants: 3,
      companies: 1,
      activeUsers: 4,
      newUsersLast7Days: 1,
      generatedAt: payload.data.generatedAt
    });
    assert.equal(Object.hasOwn(payload.data, "email"), false);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    Account.findById = originalFindById;
    Account.aggregate = originalAggregate;
    jwtUtils.verifyAuthToken = originalVerifyAuthToken;
    tokenRevocationService.isTokenRevoked = originalIsTokenRevoked;
  }
});
