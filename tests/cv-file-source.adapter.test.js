const assert = require("assert").strict;
const fs = require("fs");
const path = require("path");
const test = require("node:test");

const { CvFileSourceAdapter } = require("../src/modules/ai/adapters/cv-file-source.adapter");

const createLocalFile = (extension, bytes) => {
  const directory = path.join(process.cwd(), "uploads", "cvs");
  fs.mkdirSync(directory, { recursive: true });
  const filename = "adapter-test-" + Date.now() + "-" + Math.random().toString(16).slice(2) + extension;
  const filePath = path.join(directory, filename);
  fs.writeFileSync(filePath, bytes);
  return { filename, filePath };
};

const removeFile = (filePath) => {
  fs.rmSync(filePath, { force: true });
};

test("source adapter reads a local PDF", async () => {
  const local = createLocalFile(".pdf", Buffer.from("%PDF-1.4 local"));
  try {
    const result = await new CvFileSourceAdapter().getFile({
      fileUrl: "/uploads/cvs/" + local.filename,
      fileType: "pdf"
    });

    assert.equal(result.mimeType, "application/pdf");
    assert.equal(result.filename, local.filename);
    assert.match(result.bytes.toString("ascii"), /^%PDF/);
  } finally {
    removeFile(local.filePath);
  }
});

test("source adapter reads a local DOCX", async () => {
  const local = createLocalFile(".docx", Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00]));
  try {
    const result = await new CvFileSourceAdapter().getFile({
      fileUrl: "/uploads/cvs/" + local.filename,
      fileType: "docx"
    });

    assert.equal(result.mimeType, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    assert.equal(result.filename, local.filename);
  } finally {
    removeFile(local.filePath);
  }
});

test("source adapter rejects traversal and missing local files", async () => {
  await assert.rejects(
    new CvFileSourceAdapter().getFile({
      fileUrl: "/uploads/cvs/../outside.pdf",
      fileType: "pdf"
    }),
    (error) => error.statusCode === 400
  );

  await assert.rejects(
    new CvFileSourceAdapter().getFile({
      fileUrl: "/uploads/cvs/does-not-exist.pdf",
      fileType: "pdf"
    }),
    (error) => error.statusCode === 409
  );
});

test("source adapter enforces size and file signature", async () => {
  const large = createLocalFile(".pdf", Buffer.from("%PDF-large"));
  const invalid = createLocalFile(".pdf", Buffer.from("not-a-pdf"));
  try {
    await assert.rejects(
      new CvFileSourceAdapter({ maxBytes: 4 }).getFile({
        fileUrl: "/uploads/cvs/" + large.filename,
        fileType: "pdf"
      }),
      (error) => error.statusCode === 413
    );

    await assert.rejects(
      new CvFileSourceAdapter().getFile({
        fileUrl: "/uploads/cvs/" + invalid.filename,
        fileType: "pdf"
      }),
      (error) => error.statusCode === 415
    );
  } finally {
    removeFile(large.filePath);
    removeFile(invalid.filePath);
  }
});

test("source adapter downloads a trusted Cloudinary URL", async () => {
  const originalCloudName = process.env.CLOUDINARY_CLOUD_NAME;
  process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
  try {
    const adapter = new CvFileSourceAdapter({
      fetchImpl: async (input, init) => {
        assert.equal(input, "https://res.cloudinary.com/test-cloud/raw/upload/cv.pdf");
        assert.equal(init.redirect, "error");
        return new Response(Buffer.from("%PDF-remote"), {
          status: 200,
          headers: { "content-type": "application/pdf" }
        });
      }
    });

    const result = await adapter.getFile({
      fileUrl: "https://res.cloudinary.com/test-cloud/raw/upload/cv.pdf",
      fileType: "pdf"
    });

    assert.equal(result.mimeType, "application/pdf");
    assert.match(result.bytes.toString("ascii"), /^%PDF/);
  } finally {
    if (originalCloudName === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
    else process.env.CLOUDINARY_CLOUD_NAME = originalCloudName;
  }
});

test("source adapter rejects non-Cloudinary domains", async () => {
  let fetchCalled = false;
  const originalCloudName = process.env.CLOUDINARY_CLOUD_NAME;
  process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
  try {
    await assert.rejects(
      new CvFileSourceAdapter({
        fetchImpl: async () => {
          fetchCalled = true;
          return new Response("%PDF", { status: 200 });
        }
      }).getFile({
        fileUrl: "https://example.com/cv.pdf",
        fileType: "pdf"
      }),
      (error) => error.statusCode === 400
    );
    assert.equal(fetchCalled, false);
  } finally {
    if (originalCloudName === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
    else process.env.CLOUDINARY_CLOUD_NAME = originalCloudName;
  }
});

test("source adapter maps remote download timeout", async () => {
  const originalCloudName = process.env.CLOUDINARY_CLOUD_NAME;
  process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
  try {
    await assert.rejects(
      new CvFileSourceAdapter({
        timeoutMs: 5,
        fetchImpl: async (_input, init) => new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        })
      }).getFile({
        fileUrl: "https://res.cloudinary.com/test-cloud/raw/upload/cv.pdf",
        fileType: "pdf"
      }),
      (error) => error.statusCode === 504
    );
  } finally {
    if (originalCloudName === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
    else process.env.CLOUDINARY_CLOUD_NAME = originalCloudName;
  }
});
test("source adapter resolves a persisted Cloudinary public ID", async () => {
  const originalCloudName = process.env.CLOUDINARY_CLOUD_NAME;
  process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
  try {
    const calls = [];
    const result = await new CvFileSourceAdapter({
      fetchImpl: async (input) => {
        calls.push(input);
        return new Response(Buffer.from("%PDF-public-id"), {
          status: 200,
          headers: { "content-type": "application/pdf" }
        });
      }
    }).getFile({
      fileUrl: "cv.pdf",
      fileType: "pdf"
    });

    assert.equal(result.mimeType, "application/pdf");
    assert.match(calls[0], /^https:\/\/res\.cloudinary\.com\/test-cloud\/raw\/upload\/cv\.pdf(?:\?.*)?$/);
  } finally {
    if (originalCloudName === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
    else process.env.CLOUDINARY_CLOUD_NAME = originalCloudName;
  }
});
