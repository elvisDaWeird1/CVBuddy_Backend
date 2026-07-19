const assert = require("assert").strict;
const test = require("node:test");

const {
  assertCvFileContent,
  assertImageFileContent
} = require("../src/utils/uploadFile");
const {
  buildCvTitle
} = require("../src/modules/cvs/cv.service");
const {
  uploadCvValidation
} = require("../src/modules/cvs/cv.validation");
const {
  validatePortfolioCreate,
  validatePortfolioMomentCreate,
  validatePortfolioVisibility
} = require("../src/modules/portfolios/portfolioCollection.validation");
const aiService = require("../src/modules/ai/ai.service");
const ApplicantProfile = require("../src/modules/applicantProfiles/applicantProfile.model").default;
const CVDocument = require("../src/modules/cvs/cvDocument.model").default;
const AIResult = require("../src/modules/ai/aiResult.model").default;

const file = (originalname, mimetype, buffer) => ({
  originalname,
  mimetype,
  buffer,
  size: buffer.length
});

test("avatar validation accepts JPEG, PNG and WebP signatures", () => {
  assert.doesNotThrow(() => assertImageFileContent(
    file("avatar.jpg", "image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0x00])),
    "avatar"
  ));
  assert.doesNotThrow(() => assertImageFileContent(
    file(
      "avatar.png",
      "image/png",
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    ),
    "avatar"
  ));
  const webp = Buffer.alloc(12);
  webp.write("RIFF", 0, "ascii");
  webp.write("WEBP", 8, "ascii");
  assert.doesNotThrow(() => assertImageFileContent(
    file("avatar.webp", "image/webp", webp),
    "avatar"
  ));
});

test("avatar validation rejects an extension-only fake and an empty file", () => {
  assert.throws(
    () => assertImageFileContent(
      file("avatar.png", "image/png", Buffer.from("not-an-image")),
      "avatar"
    ),
    (error) => error.code === "INVALID_IMAGE_FILE"
  );
  assert.throws(
    () => assertImageFileContent(file("avatar.jpg", "image/jpeg", Buffer.alloc(0)), "avatar"),
    (error) => error.code === "FILE_EMPTY"
  );
});

test("CV validation accepts PDF, DOC and DOCX signatures", () => {
  assert.doesNotThrow(() => assertCvFileContent(
    file("cv.pdf", "application/pdf", Buffer.from("%PDF-1.4"))
  ));
  assert.doesNotThrow(() => assertCvFileContent(
    file(
      "cv.doc",
      "application/msword",
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
    )
  ));
  assert.doesNotThrow(() => assertCvFileContent(
    file(
      "cv.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      Buffer.concat([
        Buffer.from([0x50, 0x4b, 0x03, 0x04]),
        Buffer.from("[Content_Types].xml word/")
      ])
    )
  ));
});

test("CV title is optional and defaults to the original filename stem", () => {
  assert.deepEqual(uploadCvValidation({
    body: { language: "VI" },
    file: file("marketing-intern-cv.pdf", "application/pdf", Buffer.from("%PDF"))
  }), []);
  assert.equal(buildCvTitle("marketing-intern-cv.pdf"), "marketing-intern-cv");
  assert.equal(buildCvTitle("../CV Tiếng Việt.docx"), "CV Tiếng Việt");
});

test("multi-portfolio validators enforce title, visibility and Moment image", () => {
  assert.deepEqual(validatePortfolioCreate({
    body: { title: "Marketing Portfolio", description: "Campaigns" }
  }), []);
  assert.ok(validatePortfolioVisibility({
    body: { visibility: "UNKNOWN" }
  }).some((error) => error.field === "visibility"));
  assert.ok(validatePortfolioMomentCreate({
    body: { caption: "Event" }
  }).some((error) => error.field === "image"));
});

test("translate-and-score returns two completed result ids in mock mode", async () => {
  const originalEnabled = process.env.AI_SERVICE_ENABLED;
  const originalFindProfile = ApplicantProfile.findOne;
  const originalFindCv = CVDocument.findOne;
  const originalCreate = AIResult.create;

  process.env.AI_SERVICE_ENABLED = "false";
  ApplicantProfile.findOne = async () => ({ _id: "profile-1" });
  CVDocument.findOne = async () => ({
    _id: { toString: () => "cv-1" },
    extractedText: "Marketing campaign experience",
    language: "VI"
  });
  let sequence = 0;
  AIResult.create = async (payload) => {
    sequence += 1;
    const resultId = "result-" + sequence;
    return {
      ...payload,
      _id: { toString: () => resultId },
      accountId: { toString: () => "account-1" },
      createdAt: new Date(),
      save: async () => undefined
    };
  };

  try {
    const workflow = await aiService.translateAndScore("account-1", "cv-1", {
      industrySlug: "marketing",
      targetRole: "Marketing Intern"
    });
    assert.equal(workflow.status, "COMPLETED");
    assert.equal(workflow.steps.translation.status, "COMPLETED");
    assert.equal(workflow.steps.scoring.status, "COMPLETED");
    assert.equal(workflow.resultIds.translation, "result-1");
    assert.equal(workflow.resultIds.scoring, "result-2");
  } finally {
    if (originalEnabled === undefined) delete process.env.AI_SERVICE_ENABLED;
    else process.env.AI_SERVICE_ENABLED = originalEnabled;
    ApplicantProfile.findOne = originalFindProfile;
    CVDocument.findOne = originalFindCv;
    AIResult.create = originalCreate;
  }
});
