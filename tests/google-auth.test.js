const assert = require("node:assert/strict");
const bcrypt = require("bcrypt");
const http = require("node:http");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const test = require("node:test");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { OAuth2Client } = require("google-auth-library");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "google-auth-test-secret-that-is-at-least-32-chars";
process.env.JWT_EXPIRES_IN = "1h";
process.env.BCRYPT_SALT_ROUNDS = "4";
process.env.GOOGLE_CLIENT_ID = "cvbuddy-test-client-id.apps.googleusercontent.com";
process.env.AI_SERVICE_ENABLED = "false";

const app = require("../src/app").default;
const Account = require("../src/modules/accounts/account.model").default;
const ApplicantProfile = require("../src/modules/applicantProfiles/applicantProfile.model").default;
const { ACCOUNT_ROLES, ACCOUNT_STATUSES, AUTH_METHODS } = require("../src/constants/enums");
const {
  verifyGoogleIdToken,
  signGoogleLinkChallenge,
  verifyGoogleLinkChallenge,
  setGoogleTokenVerifierForTests
} = require("../src/modules/auth/googleAuth.service");

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
    body:
      options.body === undefined || typeof options.body === "string"
        ? options.body
        : JSON.stringify(options.body)
  });
  const payload = await response.json();
  return { response, payload };
};

test.before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Account.syncIndexes();
  await ApplicantProfile.syncIndexes();

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.afterEach(async () => {
  setGoogleTokenVerifierForTests(null);
  await Promise.all([
    Account.deleteMany({}),
    ApplicantProfile.deleteMany({})
  ]);
});

test.after(async () => {
  setGoogleTokenVerifierForTests(null);
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.disconnect();
  if (mongo) {
    await mongo.stop();
  }
});

test("Account schema enforces sparse unique googleSubject index and conditional passwordHash validation", async () => {
  const indexes = Account.schema.indexes();
  const googleSubjectIndex = indexes.find(
    ([fields]) => fields.googleSubject === 1
  );
  assert.ok(googleSubjectIndex, "Expected googleSubject index on AccountSchema");
  assert.equal(googleSubjectIndex[1].unique, true);
  assert.equal(googleSubjectIndex[1].sparse, true);

  const googleOnly = await Account.create({
    email: "google-only@example.com",
    role: ACCOUNT_ROLES.APPLICANT,
    authMethods: [AUTH_METHODS.GOOGLE],
    googleSubject: "google-sub-schema-001"
  });
  assert.equal(googleOnly.passwordHash, undefined);
  assert.deepEqual(Array.from(googleOnly.authMethods), [AUTH_METHODS.GOOGLE]);

  // Duplicate googleSubject is rejected by unique sparse index
  await assert.rejects(
    () =>
      Account.create({
        email: "second-google@example.com",
        role: ACCOUNT_ROLES.APPLICANT,
        authMethods: [AUTH_METHODS.GOOGLE],
        googleSubject: "google-sub-schema-001"
      }),
    (error) => error.code === 11000
  );

  // Multiple PASSWORD-only accounts without googleSubject are permitted by sparse index
  const passwordHash = await bcrypt.hash("Pass123!", 4);
  await Account.create({
    email: "pw-1@example.com",
    passwordHash,
    role: ACCOUNT_ROLES.APPLICANT,
    authMethods: [AUTH_METHODS.PASSWORD]
  });
  await Account.create({
    email: "pw-2@example.com",
    passwordHash,
    role: ACCOUNT_ROLES.APPLICANT,
    authMethods: [AUTH_METHODS.PASSWORD]
  });
});

test("verifyGoogleIdToken validates signature, issuer, audience, expiry, and email_verified using OAuth2Client", async () => {
  const futureExp = Math.floor(Date.now() / 1000) + 3600;
  const validClient = {
    verifyIdToken: async ({ idToken, audience }) => {
      assert.equal(idToken, "valid-google-jwt");
      assert.equal(audience, process.env.GOOGLE_CLIENT_ID);
      return {
        getPayload: () => ({
          iss: "https://accounts.google.com",
          aud: process.env.GOOGLE_CLIENT_ID,
          exp: futureExp,
          sub: "google-sub-123",
          email: "Candidate@Example.com",
          email_verified: true,
          name: "Candidate Name",
          picture: "https://lh3.googleusercontent.com/a/avatar"
        })
      };
    }
  };

  const verified = await verifyGoogleIdToken("valid-google-jwt", { oauthClient: validClient });
  assert.deepEqual(verified, {
    sub: "google-sub-123",
    email: "candidate@example.com",
    email_verified: true,
    name: "Candidate Name",
    picture: "https://lh3.googleusercontent.com/a/avatar"
  });

  // Reject wrong issuer
  await assert.rejects(
    () =>
      verifyGoogleIdToken("wrong-iss-jwt", {
        oauthClient: {
          verifyIdToken: async () => ({
            getPayload: () => ({
              iss: "https://evil.example.com",
              aud: process.env.GOOGLE_CLIENT_ID,
              exp: futureExp,
              sub: "google-sub-123",
              email: "candidate@example.com",
              email_verified: true
            })
          })
        }
      }),
    (error) => error.statusCode === 401 && error.code === "GOOGLE_TOKEN_INVALID"
  );

  // Reject wrong audience (GOOGLE_CLIENT_ID mismatch)
  await assert.rejects(
    () =>
      verifyGoogleIdToken("wrong-aud-jwt", {
        oauthClient: {
          verifyIdToken: async () => ({
            getPayload: () => ({
              iss: "https://accounts.google.com",
              aud: "other-app-client-id.apps.googleusercontent.com",
              exp: futureExp,
              sub: "google-sub-123",
              email: "candidate@example.com",
              email_verified: true
            })
          })
        }
      }),
    (error) => error.statusCode === 401 && error.code === "GOOGLE_TOKEN_INVALID"
  );

  // Reject expired token
  await assert.rejects(
    () =>
      verifyGoogleIdToken("expired-jwt", {
        oauthClient: {
          verifyIdToken: async () => ({
            getPayload: () => ({
              iss: "https://accounts.google.com",
              aud: process.env.GOOGLE_CLIENT_ID,
              exp: Math.floor(Date.now() / 1000) - 60,
              sub: "google-sub-123",
              email: "candidate@example.com",
              email_verified: true
            })
          })
        }
      }),
    (error) => error.statusCode === 401 && error.code === "GOOGLE_TOKEN_INVALID"
  );

  // Reject forged signature (OAuth2Client throws)
  const realOAuthSpy = OAuth2Client.prototype.verifyIdToken;
  OAuth2Client.prototype.verifyIdToken = async () => {
    throw new Error("Invalid token signature");
  };
  try {
    await assert.rejects(
      () => verifyGoogleIdToken("forged-jwt"),
      (error) => error.statusCode === 401 && error.code === "GOOGLE_TOKEN_INVALID"
    );
  } finally {
    OAuth2Client.prototype.verifyIdToken = realOAuthSpy;
  }

  // Reject unverified email with 400
  await assert.rejects(
    () =>
      verifyGoogleIdToken("unverified-email-jwt", {
        oauthClient: {
          verifyIdToken: async () => ({
            getPayload: () => ({
              iss: "https://accounts.google.com",
              aud: process.env.GOOGLE_CLIENT_ID,
              exp: futureExp,
              sub: "google-sub-unverified",
              email: "unverified@example.com",
              email_verified: false
            })
          })
        }
      }),
    (error) => error.statusCode === 400 && error.code === "GOOGLE_EMAIL_NOT_VERIFIED"
  );
});

test("POST /api/auth/google creates only APPLICANT accounts and never creates ADMIN or COMPANY accounts", async () => {
  let counter = 0;
  setGoogleTokenVerifierForTests(async (token) => {
    counter += 1;
    return {
      sub: `google-sub-role-guard-${counter}`,
      email: `applicant.${counter}@example.com`,
      email_verified: true,
      name: "Nguyen Minh Anh",
      picture: "https://lh3.googleusercontent.com/a/minh-anh"
    };
  });

  for (const attemptedRole of ["ADMIN", "COMPANY"]) {
    const { response, payload } = await request("/api/auth/google", {
      method: "POST",
      headers: { "X-Request-ID": `req-google-role-${attemptedRole.toLowerCase()}` },
      body: {
        idToken: `new-user-token-${attemptedRole}`,
        role: attemptedRole,
        email: "forged@example.com"
      }
    });

    assert.equal(response.status, 201);
    assert.equal(payload.success, true);
    assert.equal(payload.requestId, `req-google-role-${attemptedRole.toLowerCase()}`);
    assert.ok(payload.data.token);
    assert.equal(payload.data.isNewAccount, true);
    assert.equal(payload.data.needsProfileCompletion, false);
    assert.equal(payload.data.account.role, ACCOUNT_ROLES.APPLICANT);
    assert.deepEqual(payload.data.account.authMethods, [AUTH_METHODS.GOOGLE]);
    assert.equal(payload.data.profile.fullName, "Nguyen Minh Anh");
    assert.equal(payload.data.profile.isComplete, true);
  }
});

test("POST /api/auth/google flags needsProfileCompletion when Google claims lack a valid full name", async () => {
  setGoogleTokenVerifierForTests(async () => ({
    sub: "google-sub-missing-name-001",
    email: "missing.name@example.com",
    email_verified: true,
    name: "   ",
    picture: ""
  }));

  const firstLogin = await request("/api/auth/google", {
    method: "POST",
    body: { idToken: "missing-name-token" }
  });

  assert.equal(firstLogin.response.status, 201);
  assert.equal(firstLogin.payload.data.isNewAccount, true);
  assert.equal(firstLogin.payload.data.needsProfileCompletion, true);
  assert.equal(firstLogin.payload.data.profile.fullName, "Applicant");
  assert.equal(firstLogin.payload.data.profile.isComplete, false);

  // Returning login while profile still has placeholder fullName keeps needsProfileCompletion=true
  const returningIncomplete = await request("/api/auth/google", {
    method: "POST",
    body: { idToken: "missing-name-token" }
  });
  assert.equal(returningIncomplete.response.status, 200);
  assert.equal(returningIncomplete.payload.data.isNewAccount, false);
  assert.equal(returningIncomplete.payload.data.needsProfileCompletion, true);
  assert.equal(returningIncomplete.payload.data.account.needsProfileCompletion, true);
  assert.equal(returningIncomplete.payload.data.profile.isComplete, false);

  // GET /api/auth/me preserves authMethods, needsProfileCompletion, and profile.isComplete across reload
  const meIncomplete = await request("/api/auth/me", {
    headers: {
      Authorization: `Bearer ${returningIncomplete.payload.data.token}`
    }
  });
  assert.equal(meIncomplete.response.status, 200);
  assert.equal(meIncomplete.payload.data.needsProfileCompletion, true);
  assert.deepEqual(meIncomplete.payload.data.account.authMethods, [AUTH_METHODS.GOOGLE]);
  assert.equal(meIncomplete.payload.data.account.needsProfileCompletion, true);
  assert.equal(meIncomplete.payload.data.profile.isComplete, false);

  // Once the applicant updates their profile fullName, returning Google login and /api/auth/me report needsProfileCompletion=false
  await ApplicantProfile.updateOne(
    { _id: firstLogin.payload.data.profile.id },
    { $set: { fullName: "Tran Thi Bich Ngoc" } }
  );

  const returningCompleted = await request("/api/auth/google", {
    method: "POST",
    body: { idToken: "missing-name-token" }
  });
  assert.equal(returningCompleted.response.status, 200);
  assert.equal(returningCompleted.payload.data.needsProfileCompletion, false);
  assert.equal(returningCompleted.payload.data.account.needsProfileCompletion, false);
  assert.equal(returningCompleted.payload.data.profile.fullName, "Tran Thi Bich Ngoc");
  assert.equal(returningCompleted.payload.data.profile.isComplete, true);

  const meCompleted = await request("/api/auth/me", {
    headers: {
      Authorization: `Bearer ${returningCompleted.payload.data.token}`
    }
  });
  assert.equal(meCompleted.response.status, 200);
  assert.equal(meCompleted.payload.data.needsProfileCompletion, false);
  assert.deepEqual(meCompleted.payload.data.account.authMethods, [AUTH_METHODS.GOOGLE]);
  assert.equal(meCompleted.payload.data.account.needsProfileCompletion, false);
  assert.equal(meCompleted.payload.data.profile.isComplete, true);
});

test("POST /api/auth/google signs in an existing Google-linked account and blocks suspended accounts across all flows", async () => {
  const existing = await Account.create({
    email: "returning.google@example.com",
    role: ACCOUNT_ROLES.APPLICANT,
    status: ACCOUNT_STATUSES.ACTIVE,
    authMethods: [AUTH_METHODS.GOOGLE],
    googleSubject: "google-sub-returning-001"
  });
  await ApplicantProfile.create({
    accountId: existing._id,
    fullName: "Returning User"
  });

  setGoogleTokenVerifierForTests(async () => ({
    sub: "google-sub-returning-001",
    email: "returning.google@example.com",
    email_verified: true,
    name: "Returning User",
    picture: "https://lh3.googleusercontent.com/a/returning"
  }));

  const { response, payload } = await request("/api/auth/google", {
    method: "POST",
    body: { idToken: "returning-token" }
  });

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data.isNewAccount, false);
  assert.equal(payload.data.needsProfileCompletion, false);
  assert.equal(payload.data.account.id, existing._id.toString());
  assert.ok(payload.data.token);

  // Suspend the account and verify Google login cannot reactivate or sign in
  existing.status = ACCOUNT_STATUSES.SUSPENDED;
  await existing.save();

  const suspendedRes = await request("/api/auth/google", {
    method: "POST",
    body: { idToken: "returning-token" }
  });
  assert.equal(suspendedRes.response.status, 403);
  assert.equal(suspendedRes.payload.code, "ACCOUNT_INACTIVE");

  // Suspended password account also cannot initiate or complete linking
  const passwordHash = await bcrypt.hash("ValidPass123!", 4);
  const suspendedPasswordAccount = await Account.create({
    email: "suspended.pw@example.com",
    passwordHash,
    role: ACCOUNT_ROLES.APPLICANT,
    status: ACCOUNT_STATUSES.SUSPENDED,
    authMethods: [AUTH_METHODS.PASSWORD]
  });
  const forgedChallenge = signGoogleLinkChallenge({
    accountId: suspendedPasswordAccount._id.toString(),
    email: "suspended.pw@example.com",
    googleSubject: "google-sub-suspended-pw"
  });

  setGoogleTokenVerifierForTests(async () => ({
    sub: "google-sub-suspended-pw",
    email: "suspended.pw@example.com",
    email_verified: true,
    name: "Suspended User",
    picture: ""
  }));

  const suspendedChallengeAttempt = await request("/api/auth/google", {
    method: "POST",
    body: { idToken: "suspended-pw-token" }
  });
  assert.equal(suspendedChallengeAttempt.response.status, 403);
  assert.equal(suspendedChallengeAttempt.payload.code, "ACCOUNT_INACTIVE");

  const suspendedLinkAttempt = await request("/api/auth/google/link", {
    method: "POST",
    body: {
      idToken: "suspended-pw-token",
      password: "ValidPass123!",
      linkToken: forgedChallenge
    }
  });
  assert.equal(suspendedLinkAttempt.response.status, 403);
  assert.equal(suspendedLinkAttempt.payload.code, "ACCOUNT_INACTIVE");
});

test("Account takeover prevention: existing password account requires password + valid link challenge", async () => {
  const passwordHash = await bcrypt.hash("CorrectHorseBatteryStaple!1", 4);
  const existingAccount = await Account.create({
    email: "existing.user@example.com",
    passwordHash,
    role: ACCOUNT_ROLES.APPLICANT,
    status: ACCOUNT_STATUSES.ACTIVE,
    authMethods: [AUTH_METHODS.PASSWORD]
  });
  await ApplicantProfile.create({
    accountId: existingAccount._id,
    fullName: "Existing Password User"
  });

  setGoogleTokenVerifierForTests(async () => ({
    sub: "google-sub-link-target-999",
    email: "existing.user@example.com",
    email_verified: true,
    name: "Existing Password User",
    picture: "https://lh3.googleusercontent.com/a/existing"
  }));

  // Step 1: Attempt Google login on existing password email -> 409 challenge with unified envelope
  const initialAttempt = await request("/api/auth/google", {
    method: "POST",
    headers: { "X-Request-ID": "req-link-challenge-001" },
    body: { idToken: "google-token-for-existing-email" }
  });

  assert.equal(initialAttempt.response.status, 409);
  assert.equal(initialAttempt.payload.success, false);
  assert.equal(initialAttempt.payload.code, "GOOGLE_ACCOUNT_LINK_REQUIRED");
  assert.equal(initialAttempt.payload.requestId, "req-link-challenge-001");
  assert.ok(Array.isArray(initialAttempt.payload.errors));
  assert.equal(initialAttempt.payload.requireLink, true);
  assert.equal(initialAttempt.payload.email, "existing.user@example.com");
  assert.ok(initialAttempt.payload.linkToken);
  assert.equal(initialAttempt.payload.data?.token, undefined);

  // Step 2: Attempt linking without linkToken -> rejected with 401 GOOGLE_LINK_CHALLENGE_INVALID
  const missingLinkTokenAttempt = await request("/api/auth/google/link", {
    method: "POST",
    body: {
      idToken: "google-token-for-existing-email",
      password: "CorrectHorseBatteryStaple!1"
    }
  });
  assert.equal(missingLinkTokenAttempt.response.status, 401);
  assert.equal(missingLinkTokenAttempt.payload.code, "GOOGLE_LINK_CHALLENGE_INVALID");

  // Step 3: Attempt linking with WRONG password -> rejected with 401 INVALID_PASSWORD
  const wrongPasswordAttempt = await request("/api/auth/google/link", {
    method: "POST",
    body: {
      idToken: "google-token-for-existing-email",
      password: "WrongPassword123!",
      linkToken: initialAttempt.payload.linkToken
    }
  });

  assert.equal(wrongPasswordAttempt.response.status, 401);
  assert.equal(wrongPasswordAttempt.payload.code, "INVALID_PASSWORD");
  assert.equal((await Account.findById(existingAccount._id)).googleSubject, undefined);

  // Step 4: Link with CORRECT password + valid linkToken -> succeeds
  const validLinkAttempt = await request("/api/auth/google/link", {
    method: "POST",
    body: {
      idToken: "google-token-for-existing-email",
      password: "CorrectHorseBatteryStaple!1",
      linkToken: initialAttempt.payload.linkToken
    }
  });

  assert.equal(validLinkAttempt.response.status, 200);
  assert.equal(validLinkAttempt.payload.success, true);
  assert.equal(validLinkAttempt.payload.data.needsProfileCompletion, false);
  assert.ok(validLinkAttempt.payload.data.token);
  assert.equal(validLinkAttempt.payload.data.account.id, existingAccount._id.toString());

  const linkedAccount = await Account.findById(existingAccount._id);
  assert.equal(linkedAccount.googleSubject, "google-sub-link-target-999");
  assert.deepEqual(
    Array.from(linkedAccount.authMethods).sort(),
    [AUTH_METHODS.GOOGLE, AUTH_METHODS.PASSWORD].sort()
  );

  // Step 5: Both Google login and password login now work on the linked account
  const subsequentGoogleLogin = await request("/api/auth/google", {
    method: "POST",
    body: { idToken: "google-token-for-existing-email" }
  });
  assert.equal(subsequentGoogleLogin.response.status, 200);
  assert.ok(subsequentGoogleLogin.payload.data.token);

  const subsequentPasswordLogin = await request("/api/auth/login", {
    method: "POST",
    body: {
      email: "existing.user@example.com",
      password: "CorrectHorseBatteryStaple!1"
    }
  });
  assert.equal(subsequentPasswordLogin.response.status, 200);
  assert.ok(subsequentPasswordLogin.payload.data.token);
});

test("Link challenge rejects expired, tampered, wrong-purpose, and mismatched challenges", async () => {
  const passwordHash = await bcrypt.hash("ValidPassword123!", 4);
  const account = await Account.create({
    email: "challenge.test@example.com",
    passwordHash,
    role: ACCOUNT_ROLES.APPLICANT,
    status: ACCOUNT_STATUSES.ACTIVE,
    authMethods: [AUTH_METHODS.PASSWORD]
  });

  setGoogleTokenVerifierForTests(async () => ({
    sub: "google-sub-challenge-001",
    email: "challenge.test@example.com",
    email_verified: true,
    name: "Challenge User",
    picture: ""
  }));

  // 1. Expired challenge token
  const expiredChallenge = signGoogleLinkChallenge({
    accountId: account._id.toString(),
    email: "challenge.test@example.com",
    googleSubject: "google-sub-challenge-001",
    expiresIn: -10
  });

  const expiredRes = await request("/api/auth/google/link", {
    method: "POST",
    body: {
      idToken: "valid-google-token",
      password: "ValidPassword123!",
      linkToken: expiredChallenge
    }
  });
  assert.equal(expiredRes.response.status, 401);
  assert.equal(expiredRes.payload.code, "GOOGLE_LINK_CHALLENGE_INVALID");

  // 2. Tampered signature challenge token
  const tamperedChallenge = jwt.sign(
    {
      purpose: "google_account_link",
      accountId: account._id.toString(),
      email: "challenge.test@example.com",
      googleSubject: "google-sub-challenge-001"
    },
    "wrong-secret-key-for-tampered-challenge"
  );

  const tamperedRes = await request("/api/auth/google/link", {
    method: "POST",
    body: {
      idToken: "valid-google-token",
      password: "ValidPassword123!",
      linkToken: tamperedChallenge
    }
  });
  assert.equal(tamperedRes.response.status, 401);
  assert.equal(tamperedRes.payload.code, "GOOGLE_LINK_CHALLENGE_INVALID");

  // 3. Mismatched googleSubject in challenge
  const mismatchedSubjectChallenge = signGoogleLinkChallenge({
    accountId: account._id.toString(),
    email: "challenge.test@example.com",
    googleSubject: "different-google-sub-999"
  });

  const mismatchedSubRes = await request("/api/auth/google/link", {
    method: "POST",
    body: {
      idToken: "valid-google-token",
      password: "ValidPassword123!",
      linkToken: mismatchedSubjectChallenge
    }
  });
  assert.equal(mismatchedSubRes.response.status, 401);
  assert.equal(mismatchedSubRes.payload.code, "GOOGLE_LINK_CHALLENGE_INVALID");

  // 4. Mismatched accountId in challenge
  const mismatchedAccountChallenge = signGoogleLinkChallenge({
    accountId: new mongoose.Types.ObjectId().toString(),
    email: "challenge.test@example.com",
    googleSubject: "google-sub-challenge-001"
  });

  const mismatchedAccountRes = await request("/api/auth/google/link", {
    method: "POST",
    body: {
      idToken: "valid-google-token",
      password: "ValidPassword123!",
      linkToken: mismatchedAccountChallenge
    }
  });
  assert.equal(mismatchedAccountRes.response.status, 401);
  assert.equal(mismatchedAccountRes.payload.code, "GOOGLE_LINK_CHALLENGE_INVALID");

  // 5. Direct unit check for blank linkToken
  assert.throws(
    () =>
      verifyGoogleLinkChallenge("", {
        email: "challenge.test@example.com",
        googleSubject: "google-sub-challenge-001"
      }),
    (error) => error.statusCode === 401 && error.code === "GOOGLE_LINK_CHALLENGE_INVALID"
  );
});

test("Duplicate Google subject and subject mismatch conflicts return stable 409 error codes", async () => {
  const passwordHash = await bcrypt.hash("Password123!", 4);

  // Account A already linked to google-sub-A
  const accountA = await Account.create({
    email: "account.a@example.com",
    passwordHash,
    role: ACCOUNT_ROLES.APPLICANT,
    status: ACCOUNT_STATUSES.ACTIVE,
    authMethods: [AUTH_METHODS.PASSWORD, AUTH_METHODS.GOOGLE],
    googleSubject: "google-sub-A"
  });

  // Account B is password-only
  const accountB = await Account.create({
    email: "account.b@example.com",
    passwordHash,
    role: ACCOUNT_ROLES.APPLICANT,
    status: ACCOUNT_STATUSES.ACTIVE,
    authMethods: [AUTH_METHODS.PASSWORD]
  });

  // 1. Account A tries to sign in or link with a DIFFERENT Google subject (google-sub-DIFFERENT)
  setGoogleTokenVerifierForTests(async () => ({
    sub: "google-sub-DIFFERENT",
    email: "account.a@example.com",
    email_verified: true,
    name: "User A",
    picture: ""
  }));

  const mismatchLoginRes = await request("/api/auth/google", {
    method: "POST",
    body: { idToken: "mismatch-sub-token" }
  });
  assert.equal(mismatchLoginRes.response.status, 409);
  assert.equal(mismatchLoginRes.payload.code, "GOOGLE_SUBJECT_MISMATCH");

  const mismatchChallenge = signGoogleLinkChallenge({
    accountId: accountA._id.toString(),
    email: "account.a@example.com",
    googleSubject: "google-sub-DIFFERENT"
  });
  const mismatchLinkRes = await request("/api/auth/google/link", {
    method: "POST",
    body: {
      idToken: "mismatch-sub-token",
      password: "Password123!",
      linkToken: mismatchChallenge
    }
  });
  assert.equal(mismatchLinkRes.response.status, 409);
  assert.equal(mismatchLinkRes.payload.code, "GOOGLE_SUBJECT_MISMATCH");

  // 2. Account B tries to link google-sub-A (which is already owned by Account A)
  setGoogleTokenVerifierForTests(async () => ({
    sub: "google-sub-A",
    email: "account.b@example.com",
    email_verified: true,
    name: "User B",
    picture: ""
  }));

  const alreadyLinkedChallenge = signGoogleLinkChallenge({
    accountId: accountB._id.toString(),
    email: "account.b@example.com",
    googleSubject: "google-sub-A"
  });

  const alreadyLinkedRes = await request("/api/auth/google/link", {
    method: "POST",
    body: {
      idToken: "already-linked-sub-token",
      password: "Password123!",
      linkToken: alreadyLinkedChallenge
    }
  });
  assert.equal(alreadyLinkedRes.response.status, 409);
  assert.equal(alreadyLinkedRes.payload.code, "GOOGLE_ALREADY_LINKED");
});

test("Concurrent first Google login creates a single account and profile without unhandled duplicate-key errors", async () => {
  setGoogleTokenVerifierForTests(async () => ({
    sub: "google-sub-concurrent-first-001",
    email: "concurrent.first@example.com",
    email_verified: true,
    name: "Concurrent Applicant",
    picture: "https://lh3.googleusercontent.com/a/concurrent"
  }));

  const results = await Promise.all(
    Array.from({ length: 5 }, () =>
      request("/api/auth/google", {
        method: "POST",
        body: { idToken: "concurrent-first-login-token" }
      })
    )
  );

  for (const { response, payload } of results) {
    assert.ok(
      response.status === 200 || response.status === 201,
      `Expected 200 or 201, got ${response.status}: ${JSON.stringify(payload)}`
    );
    assert.equal(payload.success, true);
    assert.ok(payload.data.token);
    assert.equal(payload.data.account.email, "concurrent.first@example.com");
  }

  const accounts = await Account.find({ email: "concurrent.first@example.com" });
  assert.equal(accounts.length, 1);
  assert.equal(accounts[0].googleSubject, "google-sub-concurrent-first-001");

  const profiles = await ApplicantProfile.find({ accountId: accounts[0]._id });
  assert.equal(profiles.length, 1);
  assert.equal(profiles[0].fullName, "Concurrent Applicant");
});

test("Concurrent account linking updates the account atomically and preserves consistent authMethods", async () => {
  const passwordHash = await bcrypt.hash("ConcurrentLinkPass!1", 4);
  const existingAccount = await Account.create({
    email: "concurrent.link@example.com",
    passwordHash,
    role: ACCOUNT_ROLES.APPLICANT,
    status: ACCOUNT_STATUSES.ACTIVE,
    authMethods: [AUTH_METHODS.PASSWORD]
  });
  await ApplicantProfile.create({
    accountId: existingAccount._id,
    fullName: "Concurrent Link User"
  });

  setGoogleTokenVerifierForTests(async () => ({
    sub: "google-sub-concurrent-link-001",
    email: "concurrent.link@example.com",
    email_verified: true,
    name: "Concurrent Link User",
    picture: ""
  }));

  const linkToken = signGoogleLinkChallenge({
    accountId: existingAccount._id.toString(),
    email: "concurrent.link@example.com",
    googleSubject: "google-sub-concurrent-link-001"
  });

  const results = await Promise.all(
    Array.from({ length: 4 }, () =>
      request("/api/auth/google/link", {
        method: "POST",
        body: {
          idToken: "concurrent-link-token",
          password: "ConcurrentLinkPass!1",
          linkToken
        }
      })
    )
  );

  for (const { response, payload } of results) {
    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    assert.ok(payload.data.token);
  }

  const updated = await Account.findById(existingAccount._id);
  assert.equal(updated.googleSubject, "google-sub-concurrent-link-001");
  assert.deepEqual(
    Array.from(updated.authMethods).sort(),
    [AUTH_METHODS.GOOGLE, AUTH_METHODS.PASSWORD].sort()
  );
});

test("Google-only accounts reject password login and change-password while password accounts remain unaffected", async () => {
  setGoogleTokenVerifierForTests(async () => ({
    sub: "google-sub-only-001",
    email: "google.only.user@example.com",
    email_verified: true,
    name: "Google Only User",
    picture: ""
  }));

  const googleSignup = await request("/api/auth/google", {
    method: "POST",
    body: { idToken: "google-only-token" }
  });
  assert.equal(googleSignup.response.status, 201);
  const googleJwt = googleSignup.payload.data.token;

  // Password login on Google-only account returns 401 PASSWORD_LOGIN_UNAVAILABLE
  const pwLoginAttempt = await request("/api/auth/login", {
    method: "POST",
    body: {
      email: "google.only.user@example.com",
      password: "AnyPassword123!"
    }
  });
  assert.equal(pwLoginAttempt.response.status, 401);
  assert.equal(pwLoginAttempt.payload.code, "PASSWORD_LOGIN_UNAVAILABLE");

  // Change password on Google-only account returns 400 PASSWORD_CHANGE_UNAVAILABLE
  const changePwAttempt = await request("/api/auth/change-password", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${googleJwt}` },
    body: {
      currentPassword: "OldPassword123!",
      newPassword: "NewPassword123!"
    }
  });
  assert.equal(changePwAttempt.response.status, 400);
  assert.equal(changePwAttempt.payload.code, "PASSWORD_CHANGE_UNAVAILABLE");

  // Standard password registration, login, and change-password regression check
  const regRes = await request("/api/auth/register/applicant", {
    method: "POST",
    body: {
      email: "standard.pw@example.com",
      password: "InitialPassword123!",
      fullName: "Standard Password User"
    }
  });
  assert.equal(regRes.response.status, 201);

  const loginRes = await request("/api/auth/login", {
    method: "POST",
    body: {
      email: "standard.pw@example.com",
      password: "InitialPassword123!"
    }
  });
  assert.equal(loginRes.response.status, 200);

  const changeStandardPwRes = await request("/api/auth/change-password", {
    method: "PATCH",
    headers: { Authorization: `Bearer ${loginRes.payload.data.token}` },
    body: {
      currentPassword: "InitialPassword123!",
      newPassword: "UpdatedPassword123!"
    }
  });
  assert.equal(changeStandardPwRes.response.status, 200);
});

test("security regression: Google linkToken challenge is cryptographically separated from session JWTs and rejected with 401 when used as a Bearer token", async () => {
  // 1. Create a password account
  const regRes = await request("/api/auth/register/applicant", {
    method: "POST",
    body: {
      email: "victim.linktoken@example.com",
      password: "VictimSecretPassword123!",
      fullName: "Victim Applicant"
    }
  });
  assert.equal(regRes.response.status, 201);

  // 2. Obtain a valid Google linkToken challenge for that account
  setGoogleTokenVerifierForTests(async () => ({
    sub: "google-sub-victim-001",
    email: "victim.linktoken@example.com",
    email_verified: true,
    name: "Victim Applicant",
    picture: ""
  }));

  const challengeRes = await request("/api/auth/google", {
    method: "POST",
    body: { idToken: "valid-google-token-for-victim" }
  });
  assert.equal(challengeRes.response.status, 409);
  assert.equal(challengeRes.payload.code, "GOOGLE_ACCOUNT_LINK_REQUIRED");
  const { linkToken } = challengeRes.payload;
  assert.equal(typeof linkToken, "string");
  assert.ok(linkToken.length > 20);

  // 3. Using linkToken as Bearer for GET /api/auth/me MUST return 401
  const meExploitAttempt = await request("/api/auth/me", {
    headers: {
      Authorization: `Bearer ${linkToken}`
    }
  });
  assert.equal(meExploitAttempt.response.status, 401);
  assert.equal(meExploitAttempt.payload.success, false);

  // 4. Using linkToken as Bearer for protected applicant endpoints MUST return 401
  const profileExploitAttempt = await request("/api/applicant-profile/me", {
    headers: {
      Authorization: `Bearer ${linkToken}`
    }
  });
  assert.equal(profileExploitAttempt.response.status, 401);
  assert.equal(profileExploitAttempt.payload.success, false);

  const cvsExploitAttempt = await request("/api/cvs", {
    headers: {
      Authorization: `Bearer ${linkToken}`
    }
  });
  assert.equal(cvsExploitAttempt.response.status, 401);
  assert.equal(cvsExploitAttempt.payload.success, false);

  // Even a token signed directly with JWT_SECRET carrying a purpose claim is rejected as a session token
  // AND rejected as a linkToken challenge due to domain-separated signing keys
  const rawJwtWithPurpose = jwt.sign(
    {
      purpose: "google_account_link",
      accountId: regRes.payload.data.account.id,
      email: "victim.linktoken@example.com",
      googleSubject: "google-sub-victim-001"
    },
    process.env.JWT_SECRET,
    { expiresIn: "10m" }
  );
  const rawPurposeBearerAttempt = await request("/api/auth/me", {
    headers: {
      Authorization: `Bearer ${rawJwtWithPurpose}`
    }
  });
  assert.equal(rawPurposeBearerAttempt.response.status, 401);

  const rawPurposeLinkAttempt = await request("/api/auth/google/link", {
    method: "POST",
    body: {
      idToken: "valid-google-token-for-victim",
      password: "VictimSecretPassword123!",
      linkToken: rawJwtWithPurpose
    }
  });
  assert.equal(rawPurposeLinkAttempt.response.status, 401);
  assert.equal(rawPurposeLinkAttempt.payload.code, "GOOGLE_LINK_CHALLENGE_INVALID");

  // 5. Normal session JWT still accesses /api/auth/me and /api/applicant-profile/me with 200
  const normalLogin = await request("/api/auth/login", {
    method: "POST",
    body: {
      email: "victim.linktoken@example.com",
      password: "VictimSecretPassword123!"
    }
  });
  assert.equal(normalLogin.response.status, 200);
  const sessionJwt = normalLogin.payload.data.token;

  const validMe = await request("/api/auth/me", {
    headers: {
      Authorization: `Bearer ${sessionJwt}`
    }
  });
  assert.equal(validMe.response.status, 200);
  assert.equal(validMe.payload.data.account.email, "victim.linktoken@example.com");

  const validProfile = await request("/api/applicant-profile/me", {
    headers: {
      Authorization: `Bearer ${sessionJwt}`
    }
  });
  assert.equal(validProfile.response.status, 200);

  // Normal session JWT cannot be used as a linkToken
  const sessionAsLinkTokenAttempt = await request("/api/auth/google/link", {
    method: "POST",
    body: {
      idToken: "valid-google-token-for-victim",
      password: "VictimSecretPassword123!",
      linkToken: sessionJwt
    }
  });
  assert.equal(sessionAsLinkTokenAttempt.response.status, 401);
  assert.equal(sessionAsLinkTokenAttempt.payload.code, "GOOGLE_LINK_CHALLENGE_INVALID");

  // 6. Valid link flow with idToken + password + linkToken still succeeds
  const validLinkRes = await request("/api/auth/google/link", {
    method: "POST",
    body: {
      idToken: "valid-google-token-for-victim",
      password: "VictimSecretPassword123!",
      linkToken
    }
  });
  assert.equal(validLinkRes.response.status, 200);
  assert.ok(validLinkRes.payload.data.token);

  const meAfterLink = await request("/api/auth/me", {
    headers: {
      Authorization: `Bearer ${validLinkRes.payload.data.token}`
    }
  });
  assert.equal(meAfterLink.response.status, 200);
  assert.deepEqual(
    Array.from(meAfterLink.payload.data.account.authMethods).sort(),
    [AUTH_METHODS.GOOGLE, AUTH_METHODS.PASSWORD].sort()
  );
});
