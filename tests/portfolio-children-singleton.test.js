const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");

const PortfolioAsset = require("../src/modules/portfolios/portfolioAsset.model").default;
const PortfolioEvidence = require("../src/modules/portfolios/portfolioEvidence.model").default;
const PortfolioExperience = require("../src/modules/portfolios/portfolioExperience.model").default;
const PortfolioMoment = require("../src/modules/portfolios/portfolioMoment.model").default;
const collectionService = require("../src/modules/portfolios/portfolioCollection.service");
const assetService = require("../src/modules/portfolios/portfolioAsset.service");
const { createExperience } = require("../src/modules/portfolios/portfolioExperience.service");
const { createEvidence } = require("../src/modules/portfolios/portfolioEvidence.service");
const { createMoment } = require("../src/modules/portfolios/portfolioMoment.service");
const { getPublicPortfolio } = require("../src/modules/portfolios/portfolioPublic.service");

const queryResult = (value) => ({
  sort: () => ({ lean: async () => value }),
  lean: async () => value
});

test("Portfolio child schemas require a canonical portfolioId", () => {
  const applicantId = new mongoose.Types.ObjectId();
  const experienceId = new mongoose.Types.ObjectId();

  const moment = new PortfolioMoment({ applicantId, capturedAt: new Date(), mediaAssetIds: [new mongoose.Types.ObjectId()] });
  const experience = new PortfolioExperience({ applicantId, type: "project", title: "Canonical API" });
  const asset = new PortfolioAsset({
    applicantId,
    assetType: "image",
    usage: "moment-media",
    cloudinaryPublicId: "asset",
    cloudinaryResourceType: "image",
    secureUrl: "https://example.com/asset.jpg",
    originalFilename: "asset.jpg",
    mimeType: "image/jpeg"
  });
  const evidence = new PortfolioEvidence({
    applicantId,
    experienceId,
    type: "website",
    title: "Reference",
    url: "https://example.com"
  });

  for (const document of [moment, experience, asset, evidence]) {
    assert.equal(document.validateSync()?.errors?.portfolioId?.kind, "required");
  }
});

test("canonical create services derive portfolioId from the applicant singleton", async (t) => {
  const applicantId = new mongoose.Types.ObjectId();
  const portfolioId = new mongoose.Types.ObjectId();
  const hostilePortfolioId = new mongoose.Types.ObjectId();
  const experienceId = new mongoose.Types.ObjectId();
  const captured = [];

  t.mock.method(collectionService, "ensureDefaultPortfolio", async () => ({ _id: portfolioId }));
  t.mock.method(PortfolioExperience, "create", async (input) => {
    captured.push(input);
    return { _id: experienceId, ...input };
  });
  t.mock.method(PortfolioExperience, "findOne", () => ({
    then: async (resolve) => resolve({ _id: experienceId, applicantId, portfolioId })
  }));
  t.mock.method(PortfolioEvidence, "create", async (input) => {
    captured.push(input);
    return { _id: new mongoose.Types.ObjectId(), ...input };
  });
  t.mock.method(assetService, "createPortfolioAsset", async (input) => ({
    _id: new mongoose.Types.ObjectId(),
    ...input,
    assetType: "image",
    secureUrl: "https://example.com/moment.jpg",
    originalFilename: "moment.jpg",
    mimeType: "image/jpeg"
  }));
  t.mock.method(PortfolioMoment, "create", async (input) => {
    captured.push(input);
    return { _id: input._id, ...input };
  });

  await createExperience(applicantId, {
    type: "project",
    title: "Canonical service",
    portfolioId: hostilePortfolioId
  });
  await createEvidence({
    applicantId,
    experienceId,
    payload: { type: "website", title: "Reference", url: "https://example.com" }
  });
  await createMoment({
    applicantId,
    files: [{ buffer: Buffer.from("image"), originalname: "moment.jpg", mimetype: "image/jpeg" }],
    payload: { capturedAt: new Date("2026-01-01"), portfolioId: hostilePortfolioId }
  });

  assert.equal(captured[0].portfolioId.toString(), portfolioId.toString());
  assert.equal(captured[1].portfolioId.toString(), portfolioId.toString());
  assert.equal(captured[2].portfolioId.toString(), portfolioId.toString());
});

test("published Moment linked to the singleton is returned by the public query", async (t) => {
  const applicantId = new mongoose.Types.ObjectId();
  const portfolioId = new mongoose.Types.ObjectId();
  const momentId = new mongoose.Types.ObjectId();
  const assetId = new mongoose.Types.ObjectId();
  let momentFilter;

  t.mock.method(require("../src/modules/portfolios/portfolio.model").default, "findOne", () => queryResult({
    _id: portfolioId,
    applicantId,
    slug: "canonical-work",
    visibility: "PUBLIC",
    isPublic: true,
    title: "Canonical work",
    skills: [],
    socialLinks: []
  }));
  t.mock.method(PortfolioExperience, "find", () => queryResult([]));
  t.mock.method(PortfolioMoment, "find", (filter) => {
    momentFilter = filter;
    return queryResult([{
      _id: momentId,
      applicantId,
      portfolioId,
      mediaAssetIds: [assetId],
      capturedAt: new Date("2026-01-01"),
      status: "ready",
      visibility: "portfolio"
    }]);
  });
  t.mock.method(PortfolioEvidence, "find", () => queryResult([]));
  t.mock.method(PortfolioAsset, "find", () => queryResult([{
    _id: assetId,
    applicantId,
    portfolioId,
    assetType: "image",
    usage: "moment-media",
    secureUrl: "https://example.com/moment.jpg",
    originalFilename: "moment.jpg",
    mimeType: "image/jpeg"
  }]));

  const result = await getPublicPortfolio("canonical-work");

  assert.equal(momentFilter.portfolioId.toString(), portfolioId.toString());
  assert.equal(result.moments[0].id, momentId.toString());
});
