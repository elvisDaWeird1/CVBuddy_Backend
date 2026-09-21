const assert = require("assert").strict;
const test = require("node:test");

const {
  MAX_CV_FILE_SIZE_BYTES,
  assertCvFileContent
} = require("../src/utils/uploadFile");

const file = (originalname, mimetype, buffer, size = buffer.length) => ({
  originalname,
  mimetype,
  buffer,
  size
});

const pdfOfSize = (size) => {
  const buffer = Buffer.alloc(size);
  buffer.write("%PDF", 0, "ascii");
  return file("cv.pdf", "application/pdf", buffer);
};

test("CV upload rejects an empty file", () => {
  assert.throws(
    () => assertCvFileContent(file("cv.pdf", "application/pdf", Buffer.alloc(0))),
    (error) => error.statusCode === 400 && error.code === "FILE_EMPTY"
  );
});

test("CV upload rejects fake MIME, extension, and signature combinations", () => {
  assert.throws(
    () => assertCvFileContent(file("cv.pdf", "application/pdf", Buffer.from("not-a-pdf"))),
    (error) => error.statusCode === 400 && error.code === "INVALID_CV_FILE"
  );
  assert.throws(
    () => assertCvFileContent(file("cv.pdf", "application/octet-stream", Buffer.from("%PDF-1.4"))),
    (error) => error.statusCode === 400 && error.code === "INVALID_CV_FILE"
  );
  assert.throws(
    () => assertCvFileContent(file("cv.docx", "application/pdf", Buffer.from("%PDF-1.4"))),
    (error) => error.statusCode === 400 && error.code === "INVALID_CV_FILE"
  );
});

test("legacy DOC files are rejected for new uploads", () => {
  const legacyDocSignature = Buffer.from([
    0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1
  ]);

  assert.throws(
    () => assertCvFileContent(file("cv.doc", "application/msword", legacyDocSignature)),
    (error) => error.statusCode === 400 && error.code === "INVALID_CV_FILE"
  );
});

test("CV upload accepts a file one byte below the 5 MB limit", () => {
  assert.doesNotThrow(() => assertCvFileContent(pdfOfSize(MAX_CV_FILE_SIZE_BYTES - 1)));
});

test("CV upload accepts a file exactly at the 5 MB limit", () => {
  assert.doesNotThrow(() => assertCvFileContent(pdfOfSize(MAX_CV_FILE_SIZE_BYTES)));
});

test("CV upload rejects a file one byte above the 5 MB limit", () => {
  assert.throws(
    () => assertCvFileContent(pdfOfSize(MAX_CV_FILE_SIZE_BYTES + 1)),
    (error) => error.statusCode === 413 && error.code === "FILE_TOO_LARGE"
  );
});
