const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");
const http = require("node:http");
const mongoose = require("mongoose");
const test = require("node:test");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "integration-test-secret-that-is-at-least-32-characters";
process.env.JWT_EXPIRES_IN = "1h";
process.env.BCRYPT_SALT_ROUNDS = "4";
process.env.AI_SERVICE_ENABLED = "false";
delete process.env.CLOUDINARY_CLOUD_NAME;
delete process.env.CLOUDINARY_API_KEY;
delete process.env.CLOUDINARY_API_SECRET;

const app = require("../src/app").default;
const Account = require("../src/modules/accounts/account.model").default;
const ApplicantProfile = require("../src/modules/applicantProfiles/applicantProfile.model").default;
const CompanyProfile = require("../src/modules/companyProfiles/companyProfile.model").default;
const Portfolio = require("../src/modules/portfolios/portfolio.model").default;
const PortfolioExperience = require("../src/modules/portfolios/portfolioExperience.model").default;
const PortfolioMoment = require("../src/modules/portfolios/portfolioMoment.model").default;
const PortfolioAsset = require("../src/modules/portfolios/portfolioAsset.model").default;
const PortfolioEvidence = require("../src/modules/portfolios/portfolioEvidence.model").default;
const TokenRevocation = require("../src/modules/auth/tokenRevocation.model").default;
const { ACCOUNT_ROLES, ACCOUNT_STATUSES } = require("../src/constants/enums");
const { signAuthToken } = require("../src/utils/jwt");

let mongo;
let server;
let baseUrl;

const request = async (path, options = {}) => {
  const headers = { ...(options.headers || {}) };
  if (options.body !== undefined && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
    body: options.body === undefined || typeof options.body === "string"
      ? options.body
      : JSON.stringify(options.body)
  });
  const payload = await response.json();
  return { response, payload };
};

const authHeader = (account) => ({ Authorization: `Bearer ${signAuthToken(account)}` });

const createAccount = async ({ email, role = ACCOUNT_ROLES.APPLICANT, fullName, companyName }) => {
  const account = await Account.create({
    email,
    passwordHash: await bcrypt.hash("Password123!", 4),
    role,
    status: ACCOUNT_STATUSES.ACTIVE
  });

  if (role === ACCOUNT_ROLES.APPLICANT) {
    await ApplicantProfile.create({ accountId: account._id, fullName: fullName || "Integration Applicant" });
  }
  if (role === ACCOUNT_ROLES.COMPANY) {
    await CompanyProfile.create({ accountId: account._id, companyName: companyName || "Integration Company" });
  }
  return account;
};

const clearDatabase = async () => {
  await Promise.all([
    Account.deleteMany({}),
    ApplicantProfile.deleteMany({}),
    CompanyProfile.deleteMany({}),
    Portfolio.deleteMany({}),
    PortfolioExperience.deleteMany({}),
    PortfolioMoment.deleteMany({}),
    PortfolioAsset.deleteMany({}),
    PortfolioEvidence.deleteMany({}),
    TokenRevocation.deleteMany({})
  ]);
};

test.before(async () => {
  mongo = await MongoMemoryServer.create({ instance: { dbName: "cvbuddy_http_integration" } });
  await mongoose.connect(mongo.getUri());
  server = await new Promise((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.beforeEach(async () => {
  await clearDatabase();
});

test.after(async () => {
  if (server) {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

test("auth HTTP flow registers, rejects invalid credentials, revokes logout, and keeps the error schema", async () => {
  const registration = await request("/api/auth/register/applicant", {
    method: "POST",
    body: { email: "alice@example.com", password: "Password123!", fullName: "Alice Applicant" }
  });
  assert.equal(registration.response.status, 201);
  assert.equal(registration.payload.data.account.email, "alice@example.com");
  assert.equal(Object.hasOwn(registration.payload.data.account, "passwordHash"), false);

  const duplicate = await request("/api/auth/register/applicant", {
    method: "POST",
    body: { email: "alice@example.com", password: "Password123!", fullName: "Alice Applicant" }
  });
  assert.equal(duplicate.response.status, 409);
  assert.equal(duplicate.payload.code, "CONFLICT");
  assert.equal(typeof duplicate.payload.requestId, "string");

  const wrongPassword = await request("/api/auth/login", {
    method: "POST",
    body: { email: "alice@example.com", password: "WrongPassword123!" }
  });
  assert.equal(wrongPassword.response.status, 401);
  assert.equal(wrongPassword.payload.code, "UNAUTHORIZED");

  const login = await request("/api/auth/login", {
    method: "POST",
    body: { email: "alice@example.com", password: "Password123!" }
  });
  assert.equal(login.response.status, 200);
  const token = login.payload.data.token;

  const current = await request("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(current.response.status, 200);
  assert.equal(current.payload.data.account.email, "alice@example.com");

  const logout = await request("/api/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  assert.equal(logout.response.status, 200);

  const revoked = await request("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } });
  assert.equal(revoked.response.status, 401);
  assert.equal(revoked.payload.code, "UNAUTHORIZED");
});

test("admin metrics is role-isolated and counts only applicant and company accounts", async () => {
  const applicant = await createAccount({ email: "applicant@example.com" });
  await createAccount({ email: "company@example.com", role: ACCOUNT_ROLES.COMPANY });
  await createAccount({ email: "admin@example.com", role: ACCOUNT_ROLES.ADMIN });

  const applicantResponse = await request("/api/admin/metrics/overview", { headers: authHeader(applicant) });
  assert.equal(applicantResponse.response.status, 403);
  assert.equal(applicantResponse.payload.code, "FORBIDDEN");

  const login = await request("/api/auth/login", {
    method: "POST",
    body: { email: "admin@example.com", password: "Password123!" }
  });
  const adminResponse = await request("/api/admin/metrics/overview", {
    headers: { Authorization: `Bearer ${login.payload.data.token}` }
  });

  assert.equal(adminResponse.response.status, 200);
  assert.deepEqual({
    totalUsers: adminResponse.payload.data.totalUsers,
    applicants: adminResponse.payload.data.applicants,
    companies: adminResponse.payload.data.companies,
    activeUsers: adminResponse.payload.data.activeUsers,
    newUsersLast7Days: adminResponse.payload.data.newUsersLast7Days
  }, {
    totalUsers: 2,
    applicants: 1,
    companies: 1,
    activeUsers: 2,
    newUsersLast7Days: 2
  });
});

test("CV validation and Portfolio public/ownership boundaries work through HTTP", async () => {
  const owner = await createAccount({ email: "owner@example.com", fullName: "Portfolio Owner" });
  const otherApplicant = await createAccount({ email: "other@example.com", fullName: "Other Applicant" });
  const ownerHeaders = authHeader(owner);

  const missingCv = await request("/api/cvs", { method: "POST", headers: ownerHeaders, body: {} });
  assert.equal(missingCv.response.status, 400);
  assert.equal(missingCv.payload.code, "BAD_REQUEST");
  assert.equal(missingCv.payload.errors[0].field, "file");

  const updatePortfolio = await request("/api/portfolio/me", {
    method: "PUT",
    headers: ownerHeaders,
    body: { headline: "Owner portfolio", slug: "owner-portfolio" }
  });
  assert.equal(updatePortfolio.response.status, 200);

  const privatePublicLookup = await request("/api/portfolio/public/owner-portfolio");
  assert.equal(privatePublicLookup.response.status, 404);

  const experience = await request("/api/portfolio/experiences", {
    method: "POST",
    headers: ownerHeaders,
    body: { type: "project", title: "Private owner project" }
  });
  assert.equal(experience.response.status, 201);

  const otherRead = await request(`/api/portfolio/experiences/${experience.payload.data.experience.id}`, {
    headers: authHeader(otherApplicant)
  });
  assert.equal(otherRead.response.status, 404);

  const published = await request("/api/portfolio/me/publish", { method: "PATCH", headers: ownerHeaders });
  assert.equal(published.response.status, 200);

  const publicPortfolio = await request("/api/portfolio/public/owner-portfolio");
  assert.equal(publicPortfolio.response.status, 200);
  assert.equal(Object.hasOwn(publicPortfolio.payload.data.portfolio, "applicantId"), false);

  const unpublished = await request("/api/portfolio/me/unpublish", { method: "PATCH", headers: ownerHeaders });
  assert.equal(unpublished.response.status, 200);
  const hiddenAgain = await request("/api/portfolio/public/owner-portfolio");
  assert.equal(hiddenAgain.response.status, 404);
});

test("readiness returns a dependency-unavailable error without contacting external services", async () => {
  const readiness = await request("/api/health/ready");
  assert.equal(readiness.response.status, 503);
  assert.equal(readiness.payload.data.checks.mongo, true);
  assert.equal(readiness.payload.data.checks.cloudinary, false);
  assert.equal(readiness.payload.data.checks.ai, true);
});
