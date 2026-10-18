const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");
const http = require("node:http");
const mongoose = require("mongoose");
const test = require("node:test");
const { MongoMemoryServer } = require("mongodb-memory-server");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "comprehensive-integration-test-secret-at-least-32-chars";
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
const CVDocument = require("../src/modules/cvs/cvDocument.model").default;
const AIResult = require("../src/modules/ai/aiResult.model").default;
const Portfolio = require("../src/modules/portfolios/portfolio.model").default;
const PortfolioExperience = require("../src/modules/portfolios/portfolioExperience.model").default;
const PortfolioMoment = require("../src/modules/portfolios/portfolioMoment.model").default;
const PortfolioAsset = require("../src/modules/portfolios/portfolioAsset.model").default;
const PortfolioEvidence = require("../src/modules/portfolios/portfolioEvidence.model").default;
const TokenRevocation = require("../src/modules/auth/tokenRevocation.model").default;
const { ACCOUNT_ROLES, ACCOUNT_STATUSES, CV_STATUSES, AI_TYPES, AI_STATUSES } = require("../src/constants/enums");
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
  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  return { response, payload };
};

const authHeader = (account) => ({ Authorization: `Bearer ${signAuthToken(account)}` });

const createAccount = async ({ email, role = ACCOUNT_ROLES.APPLICANT, fullName, companyName, password = "Password123!" }) => {
  const account = await Account.create({
    email,
    passwordHash: await bcrypt.hash(password, 4),
    role,
    status: ACCOUNT_STATUSES.ACTIVE
  });

  if (role === ACCOUNT_ROLES.APPLICANT) {
    await ApplicantProfile.create({
      accountId: account._id,
      fullName: fullName || "Test Applicant",
      university: "Test University",
      major: "Computer Science"
    });
  }
  if (role === ACCOUNT_ROLES.COMPANY) {
    await CompanyProfile.create({
      accountId: account._id,
      companyName: companyName || "Test Company"
    });
  }
  return account;
};

const clearDatabase = async () => {
  await Promise.all([
    Account.deleteMany({}),
    ApplicantProfile.deleteMany({}),
    CompanyProfile.deleteMany({}),
    CVDocument.deleteMany({}),
    AIResult.deleteMany({}),
    Portfolio.deleteMany({}),
    PortfolioExperience.deleteMany({}),
    PortfolioMoment.deleteMany({}),
    PortfolioAsset.deleteMany({}),
    PortfolioEvidence.deleteMany({}),
    TokenRevocation.deleteMany({})
  ]);
};

test.before(async () => {
  mongo = await MongoMemoryServer.create({ instance: { dbName: "cvbuddy_comp_integration" } });
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

test("Applicant Profile: view, update, data persistence, and role guards", async () => {
  const applicant = await createAccount({ email: "profile-test@example.com", fullName: "Nguyen Van A" });
  const company = await createAccount({ email: "company-profile@example.com", role: ACCOUNT_ROLES.COMPANY });

  // 1. Get profile as applicant
  const getRes = await request("/api/applicant-profile/me", { headers: authHeader(applicant) });
  assert.equal(getRes.response.status, 200);
  assert.equal(getRes.payload.data.profile.fullName, "Nguyen Van A");
  assert.equal(getRes.payload.data.profile.university, "Test University");

  // 2. Update profile with valid data
  const updateRes = await request("/api/applicant-profile/me", {
    method: "PATCH",
    headers: authHeader(applicant),
    body: {
      fullName: "Nguyen Van B",
      headline: "Senior Software Engineer",
      summary: "Passionate about full-stack systems",
      careerGoal: "Become a Tech Lead",
      location: "Da Nang, Vietnam",
      phone: "+84901234567"
    }
  });
  assert.equal(updateRes.response.status, 200);
  assert.equal(updateRes.payload.data.profile.fullName, "Nguyen Van B");
  assert.equal(updateRes.payload.data.profile.headline, "Senior Software Engineer");
  assert.equal(updateRes.payload.data.profile.location, "Da Nang, Vietnam");

  // 3. Verify persistence
  const verifyRes = await request("/api/applicant-profile/me", { headers: authHeader(applicant) });
  assert.equal(verifyRes.response.status, 200);
  assert.equal(verifyRes.payload.data.profile.fullName, "Nguyen Van B");
  assert.equal(verifyRes.payload.data.profile.headline, "Senior Software Engineer");
  assert.equal(verifyRes.payload.data.profile.careerGoal, "Become a Tech Lead");

  // 4. Role guard: Company cannot access applicant profile
  const forbiddenRes = await request("/api/applicant-profile/me", { headers: authHeader(company) });
  assert.equal(forbiddenRes.response.status, 403);
  assert.equal(forbiddenRes.payload.code, "FORBIDDEN");

  // 5. Unauthenticated request rejected
  const unauthRes = await request("/api/applicant-profile/me");
  assert.equal(unauthRes.response.status, 401);
  assert.equal(unauthRes.payload.code, "UNAUTHORIZED");
});

test("Password Management: change password validates current credentials and updates hash", async () => {
  const applicant = await createAccount({ email: "pwd-test@example.com", password: "OldPassword123!" });
  const token = signAuthToken(applicant);

  // 1. Invalid current password rejected
  const invalidCurrent = await request("/api/auth/change-password", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: { currentPassword: "WrongPassword!", newPassword: "NewPassword123!" }
  });
  assert.equal(invalidCurrent.response.status, 400);

  // 2. Short new password rejected
  const shortNew = await request("/api/auth/change-password", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: { currentPassword: "OldPassword123!", newPassword: "short" }
  });
  assert.equal(shortNew.response.status, 400);

  // 3. Valid change succeeds
  const validChange = await request("/api/auth/change-password", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body: { currentPassword: "OldPassword123!", newPassword: "NewPassword123!" }
  });
  assert.equal(validChange.response.status, 200);

  // 4. Old password login fails
  const oldLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: "pwd-test@example.com", password: "OldPassword123!" }
  });
  assert.equal(oldLogin.response.status, 401);

  // 5. New password login succeeds
  const newLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: "pwd-test@example.com", password: "NewPassword123!" }
  });
  assert.equal(newLogin.response.status, 200);
  assert.ok(newLogin.payload.data.token);
});

test("CV Management: ownership isolation, detail view, soft delete, and AI result cascade block", async () => {
  const userA = await createAccount({ email: "userA@example.com", fullName: "User A" });
  const userB = await createAccount({ email: "userB@example.com", fullName: "User B" });

  const profileA = await ApplicantProfile.findOne({ accountId: userA._id });

  // Create CV for User A directly in DB
  const cvA = await CVDocument.create({
    applicantProfileId: profileA._id,
    title: "User A Software Engineer CV",
    fileUrl: "https://res.cloudinary.com/demo/image/upload/userA_cv.pdf",
    fileType: "pdf",
    fileSize: 10240,
    language: "EN",
    status: CV_STATUSES.ACTIVE
  });

  // 1. User A lists own CVs
  const listA = await request("/api/cvs", { headers: authHeader(userA) });
  assert.equal(listA.response.status, 200);
  assert.equal(listA.payload.data.cvs.length, 1);
  assert.equal(listA.payload.data.cvs[0].id, cvA._id.toString());

  // 2. User B lists CVs -> empty list (isolation)
  const listB = await request("/api/cvs", { headers: authHeader(userB) });
  assert.equal(listB.response.status, 200);
  assert.equal(listB.payload.data.cvs.length, 0);

  // 3. User A views own CV detail
  const detailA = await request(`/api/cvs/${cvA._id}`, { headers: authHeader(userA) });
  assert.equal(detailA.response.status, 200);
  assert.equal(detailA.payload.data.cv.title, "User A Software Engineer CV");

  // 4. SECURITY CHECK: IDOR prevention - User B cannot view User A's CV
  const crossUserRead = await request(`/api/cvs/${cvA._id}`, { headers: authHeader(userB) });
  assert.equal(crossUserRead.response.status, 404);
  assert.equal(crossUserRead.payload.code, "NOT_FOUND");

  // 5. SECURITY CHECK: IDOR prevention - User B cannot delete User A's CV
  const crossUserDelete = await request(`/api/cvs/${cvA._id}`, { method: "DELETE", headers: authHeader(userB) });
  assert.equal(crossUserDelete.response.status, 404);

  // 6. Business rule check: If CV has an associated AIResult, soft-delete is blocked!
  await AIResult.create({
    accountId: userA._id,
    cvDocumentId: cvA._id,
    aiType: AI_TYPES.CV_SCORING,
    status: AI_STATUSES.COMPLETED,
    score: 85,
    inputText: "CV content"
  });

  const deleteBlocked = await request(`/api/cvs/${cvA._id}`, { method: "DELETE", headers: authHeader(userA) });
  assert.equal(deleteBlocked.response.status, 409); // Controller blocks delete if AI result exists
  assert.equal(deleteBlocked.payload.code, "CV_IN_USE");

  // Remove the AI result to test normal soft-delete
  await AIResult.deleteMany({ cvDocumentId: cvA._id });

  // 7. User A deletes own CV
  const deleteSuccess = await request(`/api/cvs/${cvA._id}`, { method: "DELETE", headers: authHeader(userA) });
  assert.equal(deleteSuccess.response.status, 200);

  // 8. Deleted CV cannot be retrieved by User A
  const getDeleted = await request(`/api/cvs/${cvA._id}`, { headers: authHeader(userA) });
  assert.equal(getDeleted.response.status, 404);

  // 9. Verified in database: status is DELETED (soft-delete)
  const dbCv = await CVDocument.findById(cvA._id);
  assert.equal(dbCv.status, CV_STATUSES.DELETED);
});

test("Portfolio Domain: experiences, moments, evidence, verification guard, and cross-user isolation", async () => {
  const userA = await createAccount({ email: "portfolio-a@example.com", fullName: "Portfolio A" });
  const userB = await createAccount({ email: "portfolio-b@example.com", fullName: "Portfolio B" });
  const headersA = authHeader(userA);
  const headersB = authHeader(userB);

  // 1. Create Experience for User A
  const expRes = await request("/api/portfolio/experiences", {
    method: "POST",
    headers: headersA,
    body: {
      type: "project",
      title: "Microservices Platform",
      role: "Lead Architect",
      organization: "Tech Innovations",
      description: "Designed scalable event-driven architecture",
      startDate: "2024-01-01"
    }
  });
  assert.equal(expRes.response.status, 201);
  const expId = expRes.payload.data.experience.id;

  // 2. User B cannot access User A's experience (Cross-user isolation)
  const crossExp = await request(`/api/portfolio/experiences/${expId}`, { headers: headersB });
  assert.equal(crossExp.response.status, 404);

  const crossExpUpdate = await request(`/api/portfolio/experiences/${expId}`, {
    method: "PATCH",
    headers: headersB,
    body: { title: "Hacked Title" }
  });
  assert.equal(crossExpUpdate.response.status, 404);

  // 3. User A updates own experience
  const expUpdate = await request(`/api/portfolio/experiences/${expId}`, {
    method: "PATCH",
    headers: headersA,
    body: { title: "Microservices Platform v2" }
  });
  assert.equal(expUpdate.response.status, 200);
  assert.equal(expUpdate.payload.data.experience.title, "Microservices Platform v2");

  // 4. Experience publish & archive lifecycle
  const pubExp = await request(`/api/portfolio/experiences/${expId}/publish`, { method: "PATCH", headers: headersA });
  assert.equal(pubExp.response.status, 200);
  assert.equal(pubExp.payload.data.experience.status, "published");

  const archExp = await request(`/api/portfolio/experiences/${expId}/archive`, { method: "PATCH", headers: headersA });
  assert.equal(archExp.response.status, 200);
  assert.equal(archExp.payload.data.experience.status, "archived");

  // 5. Evidence creation under experience
  const evidenceRes = await request(`/api/portfolio/experiences/${expId}/evidence`, {
    method: "POST",
    headers: headersA,
    body: {
      type: "github",
      title: "GitHub Repository",
      url: "https://github.com/example/microservices"
    }
  });
  assert.equal(evidenceRes.response.status, 201);
  const evidenceId = evidenceRes.payload.data.evidence.id;
  assert.equal(evidenceRes.payload.data.evidence.verificationStatus, "unverified");

  // 6. SECURITY CHECK: Clients cannot forge verification status
  const forgeVerification = await request(`/api/portfolio/evidence/${evidenceId}`, {
    method: "PATCH",
    headers: headersA,
    body: {
      verificationStatus: "verified"
    }
  });
  assert.equal(forgeVerification.response.status, 400); // Rejected by validation

  // 7. User B cannot delete User A's evidence
  const crossDeleteEvidence = await request(`/api/portfolio/evidence/${evidenceId}`, {
    method: "DELETE",
    headers: headersB
  });
  assert.equal(crossDeleteEvidence.response.status, 404);

  // 8. Delete experience cascades or removes cleanly
  const deleteExp = await request(`/api/portfolio/experiences/${expId}`, { method: "DELETE", headers: headersA });
  assert.equal(deleteExp.response.status, 200);

  const getDeletedExp = await request(`/api/portfolio/experiences/${expId}`, { headers: headersA });
  assert.equal(getDeletedExp.response.status, 404);
});

test("Company Account: registration, role isolation, and workspace boundary", async () => {
  // 1. Company registration
  const companyReg = await request("/api/auth/register/company", {
    method: "POST",
    body: {
      email: "recruiter@enterprise.com",
      password: "CompanyPassword123!",
      companyName: "Enterprise Global Corp"
    }
  });
  assert.equal(companyReg.response.status, 201);
  assert.equal(companyReg.payload.data.account.role, ACCOUNT_ROLES.COMPANY);
  assert.equal(companyReg.payload.data.profile.companyName, "Enterprise Global Corp");
  assert.equal(Object.hasOwn(companyReg.payload.data.account, "passwordHash"), false);

  // 2. Login as company
  const companyLogin = await request("/api/auth/login", {
    method: "POST",
    body: { email: "recruiter@enterprise.com", password: "CompanyPassword123!" }
  });
  assert.equal(companyLogin.response.status, 200);
  const companyToken = companyLogin.payload.data.token;
  const companyHeaders = { Authorization: `Bearer ${companyToken}` };

  // 3. Company accessing /api/auth/me returns company profile summary
  const meRes = await request("/api/auth/me", { headers: companyHeaders });
  assert.equal(meRes.response.status, 200);
  assert.equal(meRes.payload.data.account.role, ACCOUNT_ROLES.COMPANY);

  // 4. ROLE ISOLATION: Company is rejected from Applicant routes
  const cvAccess = await request("/api/cvs", { headers: companyHeaders });
  assert.equal(cvAccess.response.status, 403);
  assert.equal(cvAccess.payload.code, "FORBIDDEN");

  const portfolioAccess = await request("/api/portfolio/me", { headers: companyHeaders });
  assert.equal(portfolioAccess.response.status, 403);
  assert.equal(portfolioAccess.payload.code, "FORBIDDEN");

  const applicantProfileAccess = await request("/api/applicant-profile/me", { headers: companyHeaders });
  assert.equal(applicantProfileAccess.response.status, 403);
  assert.equal(applicantProfileAccess.payload.code, "FORBIDDEN");

  // 5. ROLE ISOLATION: Company is rejected from Admin routes
  const adminAccess = await request("/api/admin/metrics/overview", { headers: companyHeaders });
  assert.equal(adminAccess.response.status, 403);
  assert.equal(adminAccess.payload.code, "FORBIDDEN");
});

test("AI Results History: query, detail, and ownership isolation", async () => {
  const userA = await createAccount({ email: "ai-user-a@example.com" });
  const userB = await createAccount({ email: "ai-user-b@example.com" });

  const aiResultA = await AIResult.create({
    accountId: userA._id,
    aiType: AI_TYPES.CV_SCORING,
    status: AI_STATUSES.COMPLETED,
    score: 88,
    inputText: "User A CV text",
    resultText: JSON.stringify({ overall_score: 88, dimensions: {} }),
    completedAt: new Date()
  });

  // 1. User A queries AI results list
  const listA = await request("/api/ai/results", { headers: authHeader(userA) });
  assert.equal(listA.response.status, 200);
  assert.equal(listA.payload.data.aiResults.length, 1);
  assert.equal(listA.payload.data.aiResults[0].id, aiResultA._id.toString());
  assert.equal(listA.payload.data.aiResults[0].score, 88);

  // 2. User B queries AI results list -> empty
  const listB = await request("/api/ai/results", { headers: authHeader(userB) });
  assert.equal(listB.response.status, 200);
  assert.equal(listB.payload.data.aiResults.length, 0);

  // 3. User A views own AI result detail
  const detailA = await request(`/api/ai/results/${aiResultA._id}`, { headers: authHeader(userA) });
  assert.equal(detailA.response.status, 200);
  assert.equal(detailA.payload.data.aiResult.id, aiResultA._id.toString());
  assert.equal(detailA.payload.data.aiResult.result.overall_score, 88);

  // 4. SECURITY CHECK: User B cannot access User A's AI result detail (404)
  const crossDetail = await request(`/api/ai/results/${aiResultA._id}`, { headers: authHeader(userB) });
  assert.equal(crossDetail.response.status, 404);
  assert.equal(crossDetail.payload.code, "NOT_FOUND");
});
