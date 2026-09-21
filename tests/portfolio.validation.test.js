const assert = require("assert").strict;
const test = require("node:test");

const {
  validateEvidenceCreate,
  validateEvidenceUpdate,
  validateExperienceCreate,
  validateFeaturedExperiences,
  validateMomentCreate,
  validateMomentList,
  validatePortfolioProfile,
  validateSlugParam
} = require("../src/modules/portfolios/portfolioDomain.validation");
const { serializeAsset } = require("../src/modules/portfolios/portfolioAsset.service");

test("portfolio profile rejects invalid slug and unknown applicant ownership", () => {
  const errors = validatePortfolioProfile({
    body: { slug: "Not A Slug", applicantId: "66a111111111111111111111" }
  });

  assert.equal(errors.length, 2);
  assert.ok(errors.some((error) => error.field === "slug"));
  assert.ok(errors.some((error) => error.field === "applicantId"));
});

test("experience validation rejects current experiences with an end date", () => {
  const errors = validateExperienceCreate({
    body: { type: "project", title: "API", isCurrent: true, endDate: "2026-01-01" }
  });

  assert.ok(errors.some((error) => error.field === "endDate"));
});

test("moment validation requires at least one media file", () => {
  const errors = validateMomentCreate({
    body: { capturedAt: "2026-07-11T00:00:00.000Z" },
    files: []
  });

  assert.ok(errors.some((error) => error.field === "media"));
});

test("featured experiences are limited to six ids", () => {
  const id = "66a111111111111111111111";
  const errors = validateFeaturedExperiences({
    body: { featuredExperienceIds: [id, id, id, id, id, id, id] }
  });

  assert.ok(errors.some((error) => error.field === "featuredExperienceIds"));
});

test("public slug validation accepts the documented format", () => {
  assert.deepEqual(validateSlugParam({ params: { slug: "nguyen-van-a" } }), []);
});

test("clients cannot mark evidence as verified", () => {
  const createErrors = validateEvidenceCreate({
    body: { type: "github", title: "Repository", url: "https://github.com/example", verificationStatus: "verified" }
  });
  const updateErrors = validateEvidenceUpdate({
    body: { verificationStatus: "verified" }
  });

  assert.ok(createErrors.some((error) => error.field === "verificationStatus"));
  assert.ok(updateErrors.some((error) => error.field === "verificationStatus"));
});

test("moment list validation bounds pagination and validates filters", () => {
  const errors = validateMomentList({
    query: { page: "1", limit: "101", experienceId: "not-an-id", status: "unknown" }
  });

  assert.ok(errors.some((error) => error.field === "limit"));
  assert.ok(errors.some((error) => error.field === "experienceId"));
  assert.ok(errors.some((error) => error.field === "status"));
});

test("public asset serialization omits internal usage metadata", () => {
  const serialized = serializeAsset({
    _id: { toString: () => "asset-1" },
    assetType: "image",
    usage: "moment-media",
    secureUrl: "https://res.cloudinary.com/demo/image/upload/photo.jpg",
    originalFilename: "photo.jpg",
    mimeType: "image/jpeg",
    format: "jpg",
    bytes: 10,
    createdAt: new Date()
  }, { public: true });

  assert.equal(serialized.usage, undefined);
  assert.equal(serialized.secureUrl.includes("cloudinaryPublicId"), false);
});
