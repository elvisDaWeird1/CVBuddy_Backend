const assert = require("assert").strict;
const test = require("node:test");

const {
  MAX_PORTFOLIO_FILE_SIZE_BYTES,
  assertPortfolioFileContent
} = require("../src/utils/uploadFile");
const {
  EXPERIENCE_COVER_MIME_TYPES,
  EVIDENCE_MIME_TYPES,
  MOMENT_MEDIA_MIME_TYPES,
  getMaxPortfolioFileSizeBytes
} = require("../src/middlewares/portfolioUpload.middleware");
const { portfolioSwaggerSchemas } = require("../src/docs/portfolio.swagger");

const file = (originalname, mimetype, buffer) => ({
  originalname,
  mimetype,
  buffer,
  size: buffer.length
});

const pdfOfSize = (size) => {
  const buffer = Buffer.alloc(size);
  buffer.write("%PDF", 0, "ascii");
  return file("proof.pdf", "application/pdf", buffer);
};

test("portfolio use cases expose isolated allowlists", () => {
  assert.ok(MOMENT_MEDIA_MIME_TYPES.includes("video/mp4"));
  assert.equal(MOMENT_MEDIA_MIME_TYPES.includes("application/pdf"), false);
  assert.equal(EXPERIENCE_COVER_MIME_TYPES.includes("video/mp4"), false);
  assert.ok(EVIDENCE_MIME_TYPES.includes("application/pdf"));
});

test("Swagger documents the per-use-case 5 MB contract", () => {
  assert.match(portfolioSwaggerSchemas.ExperienceCoverRequest.properties.cover.description, /5 MB/);
  assert.match(portfolioSwaggerSchemas.MomentMultipartRequest.properties.media.description, /maximum 5 MB each/);
  assert.match(portfolioSwaggerSchemas.EvidenceMultipartRequest.properties.file.description, /maximum 5 MB/);
});

test("portfolio validator accepts supported file signatures", () => {
  const mp4 = Buffer.alloc(12);
  mp4.write("ftyp", 4, "ascii");

  assert.doesNotThrow(() => assertPortfolioFileContent(file("cover.jpg", "image/jpeg", Buffer.from([0xff, 0xd8, 0xff]))));
  assert.doesNotThrow(() => assertPortfolioFileContent(file("moment.mp4", "video/mp4", mp4), "media"));
  assert.doesNotThrow(() => assertPortfolioFileContent(file("proof.pdf", "application/pdf", Buffer.from("%PDF-1.4"))));
  assert.doesNotThrow(() => assertPortfolioFileContent(file("proof.doc", "application/msword", Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))));
  assert.doesNotThrow(() => assertPortfolioFileContent(file("proof.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("[Content_Types].xml word/")]))));
});

test("portfolio validator rejects empty files and fake signatures", () => {
  assert.throws(
    () => assertPortfolioFileContent(file("cover.png", "image/png", Buffer.alloc(0)), "cover"),
    (error) => error.code === "FILE_EMPTY"
  );
  assert.throws(
    () => assertPortfolioFileContent(file("cover.png", "image/png", Buffer.from("not-a-png")), "cover"),
    (error) => error.code === "INVALID_FILE_SIGNATURE"
  );
  assert.throws(
    () => assertPortfolioFileContent(file("cover.png", "application/pdf", Buffer.from("%PDF-1.4")), "cover"),
    (error) => error.code === "INVALID_PORTFOLIO_FILE"
  );
});

test("portfolio validator enforces the 5 MB boundary and hard cap", () => {
  assert.doesNotThrow(() => assertPortfolioFileContent(pdfOfSize(MAX_PORTFOLIO_FILE_SIZE_BYTES - 1)));
  assert.doesNotThrow(() => assertPortfolioFileContent(pdfOfSize(MAX_PORTFOLIO_FILE_SIZE_BYTES)));
  assert.throws(
    () => assertPortfolioFileContent(pdfOfSize(MAX_PORTFOLIO_FILE_SIZE_BYTES + 1)),
    (error) => error.statusCode === 413 && error.code === "FILE_TOO_LARGE"
  );

  const original = process.env.MAX_PORTFOLIO_FILE_SIZE_MB;
  process.env.MAX_PORTFOLIO_FILE_SIZE_MB = "10";
  try {
    assert.equal(getMaxPortfolioFileSizeBytes(), MAX_PORTFOLIO_FILE_SIZE_BYTES);
  } finally {
    if (original === undefined) delete process.env.MAX_PORTFOLIO_FILE_SIZE_MB;
    else process.env.MAX_PORTFOLIO_FILE_SIZE_MB = original;
  }
});
