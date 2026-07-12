const assert = require("assert").strict;
const test = require("node:test");

const {
  AiServiceClient,
  AiServiceError,
  isAiServiceError
} = require("../src/modules/ai/clients/ai-service.client");
const aiService = require("../src/modules/ai/ai.service");
const ApplicantProfile = require("../src/modules/applicantProfiles/applicantProfile.model").default;
const CVDocument = require("../src/modules/cvs/cvDocument.model").default;
const AIResult = require("../src/modules/ai/aiResult.model").default;

const analyzeResponse = {
  overall_score: 81,
  dimensions: {
    layout_ats: {},
    language: {},
    keywords: {},
    jd_fit: {}
  },
  rewrites: [],
  company_model_feedback: "Feedback",
  confidence: 0.8,
  disclaimer: "AI-assisted feedback only",
  meta: { source: "mock", model: "test" }
};

const analyzeRequest = {
  sections: {
    summary: [],
    experience: ["Built an API"],
    education: [],
    skills: ["Node.js"],
    projects: [],
    certifications: [],
    other: []
  },
  industry_slug: "language",
  company_model: "corporate",
  language: "both",
  tier: "free",
  strict_industry_match: false
};

test("AI client normalizes the base URL and validates health responses", async () => {
  const calls = [];
  const client = new AiServiceClient({
    baseUrl: "http://ai:8000///",
    fetchImpl: async (input, init) => {
      calls.push({ input, init });
      return new Response(JSON.stringify({ status: "ok", service: "cvbuddy-ai" }), { status: 200 });
    }
  });

  const health = await client.health();

  assert.equal(health.status, "ok");
  assert.equal(calls[0].input, "http://ai:8000/health");
  assert.equal(calls[0].init.method, "GET");
});

test("AI client maps FastAPI validation errors without exposing raw internals", async () => {
  const client = new AiServiceClient({
    fetchImpl: async () => new Response(JSON.stringify({
      detail: [{ loc: ["body", "industry_slug"], msg: "Field required" }]
    }), { status: 422 })
  });

  await assert.rejects(
    client.analyzeCv(analyzeRequest),
    (error) => {
      assert.ok(error instanceof AiServiceError);
      assert.equal(error.kind, "http");
      assert.equal(error.statusCode, 422);
      assert.equal(error.errors[0].field, "body.industry_slug");
      return true;
    }
  );
});

test("AI client maps AbortController timeouts", async () => {
  const client = new AiServiceClient({
    timeoutMs: 5,
    fetchImpl: async (_input, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    })
  });

  await assert.rejects(
    client.health(),
    (error) => {
      assert.ok(isAiServiceError(error));
      assert.equal(error.kind, "timeout");
      return true;
    }
  );
});

test("ownership failure happens before any AI service call", async () => {
  const originalFindProfile = ApplicantProfile.findOne;
  const originalFetch = global.fetch;
  let fetchCalled = false;

  ApplicantProfile.findOne = async () => null;
  global.fetch = async () => {
    fetchCalled = true;
    return new Response("{}", { status: 500 });
  };

  try {
    await assert.rejects(
      aiService.generateScore("account-1", "507f1f77bcf86cd799439011", {}),
      (error) => error.statusCode === 404
    );
    assert.equal(fetchCalled, false);
  } finally {
    ApplicantProfile.findOne = originalFindProfile;
    global.fetch = originalFetch;
  }
});

test("explicit mock mode still persists a completed AIResult", async () => {
  const originalEnabled = process.env.AI_SERVICE_ENABLED;
  const originalFindProfile = ApplicantProfile.findOne;
  const originalFindCv = CVDocument.findOne;
  const originalCreate = AIResult.create;

  process.env.AI_SERVICE_ENABLED = "false";
  ApplicantProfile.findOne = async () => ({ _id: "profile-1" });
  CVDocument.findOne = async () => ({
    _id: "cv-1",
    extractedText: "Built an API",
    language: "VI"
  });

  const saved = [];
  AIResult.create = async (payload) => {
    const result = {
      ...payload,
      _id: { toString: () => "result-1" },
      accountId: { toString: () => "account-1" },
      createdAt: new Date(),
      save: async () => saved.push(result)
    };
    return result;
  };

  try {
    const result = await aiService.generateScore("account-1", "cv-1", {});
    assert.equal(result.status, "COMPLETED");
    assert.equal(result.score, 78);
    assert.equal(saved.length, 1);
    assert.match(result.resultText, /overallScore/);

    assert.equal(result.result.overallScore, 78);
  } finally {
    if (originalEnabled === undefined) delete process.env.AI_SERVICE_ENABLED;
    else process.env.AI_SERVICE_ENABLED = originalEnabled;
    ApplicantProfile.findOne = originalFindProfile;
    CVDocument.findOne = originalFindCv;
    AIResult.create = originalCreate;
  }
});

test("FastAPI translation response is persisted without replacing the CV", async () => {
  const originalEnabled = process.env.AI_SERVICE_ENABLED;
  const originalFindProfile = ApplicantProfile.findOne;
  const originalFindCv = CVDocument.findOne;
  const originalCreate = AIResult.create;
  const originalFetch = global.fetch;

  process.env.AI_SERVICE_ENABLED = "true";
  ApplicantProfile.findOne = async () => ({ _id: "profile-1" });
  CVDocument.findOne = async () => ({
    _id: "cv-1",
    extractedText: "Kinh nghiem lam viec",
    language: "VI"
  });

  const saved = [];
  AIResult.create = async (payload) => {
    const result = {
      ...payload,
      _id: { toString: () => "result-translate-1" },
      accountId: { toString: () => "account-1" },
      createdAt: new Date(),
      save: async () => saved.push(result)
    };
    return result;
  };
  global.fetch = async () => new Response(JSON.stringify({
    translated: "Work experience",
    notes: [],
    meta: { source: "mock" }
  }), { status: 200 });

  try {
    const result = await aiService.translateToEnglish("account-1", "cv-1", {});
    assert.equal(result.status, "COMPLETED");
    assert.match(result.resultText, /Work experience/);
    assert.equal(saved[0].aiType, "CV_TRANSLATION");
  } finally {
    if (originalEnabled === undefined) delete process.env.AI_SERVICE_ENABLED;
    else process.env.AI_SERVICE_ENABLED = originalEnabled;
    ApplicantProfile.findOne = originalFindProfile;
    CVDocument.findOne = originalFindCv;
    AIResult.create = originalCreate;
    global.fetch = originalFetch;
  }
});

test("analysis can send the stored file when extractedText is absent", async () => {
  const fs = require("fs");
  const originalEnabled = process.env.AI_SERVICE_ENABLED;
  const originalUploadDir = process.env.UPLOAD_DIR;
  const originalFindProfile = ApplicantProfile.findOne;
  const originalFindCv = CVDocument.findOne;
  const originalCreate = AIResult.create;
  const originalFetch = global.fetch;
  const originalStat = fs.promises.stat;
  const originalReadFile = fs.promises.readFile;

  process.env.AI_SERVICE_ENABLED = "true";
  process.env.UPLOAD_DIR = "uploads";
  ApplicantProfile.findOne = async () => ({ _id: "profile-1" });
  CVDocument.findOne = async () => ({
    _id: "cv-1",
    fileUrl: "/uploads/cvs/test.pdf",
    language: "VI"
  });
  fs.promises.stat = async () => ({ isFile: () => true, size: 12 });
  fs.promises.readFile = async () => Buffer.from("%PDF-test");
  const calls = [];
  global.fetch = async (input) => {
    calls.push(input);
    return new Response(JSON.stringify(analyzeResponse), { status: 200 });
  };

  AIResult.create = async (payload) => {
    const result = {
      ...payload,
      _id: { toString: () => "result-score-file-1" },
      accountId: { toString: () => "account-1" },
      createdAt: new Date(),
      save: async () => undefined
    };
    return result;
  };

  try {
    const result = await aiService.generateScore("account-1", "cv-1", {});
    assert.equal(result.score, 81);
    assert.ok(calls[0].includes("/v1/cv/extract-and-analyze?"));
    assert.equal(calls.length, 1);
  } finally {
    if (originalEnabled === undefined) delete process.env.AI_SERVICE_ENABLED;
    else process.env.AI_SERVICE_ENABLED = originalEnabled;
    if (originalUploadDir === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = originalUploadDir;
    ApplicantProfile.findOne = originalFindProfile;
    CVDocument.findOne = originalFindCv;
    AIResult.create = originalCreate;
    global.fetch = originalFetch;
    fs.promises.stat = originalStat;
    fs.promises.readFile = originalReadFile;
  }
});

test("invalid industry slug is rejected before file or AI fetch", async () => {
  const originalEnabled = process.env.AI_SERVICE_ENABLED;
  const originalSlugs = process.env.AI_SUPPORTED_INDUSTRY_SLUGS;
  const originalFindProfile = ApplicantProfile.findOne;
  const originalFindCv = CVDocument.findOne;
  const originalFetch = global.fetch;
  let fetchCalled = false;

  process.env.AI_SERVICE_ENABLED = "true";
  process.env.AI_SUPPORTED_INDUSTRY_SLUGS = "language,marketing";
  ApplicantProfile.findOne = async () => ({ _id: "profile-1" });
  CVDocument.findOne = async () => ({
    _id: "cv-1",
    fileUrl: "/uploads/cvs/not-read.pdf",
    language: "VI"
  });
  global.fetch = async () => {
    fetchCalled = true;
    return new Response("{}", { status: 500 });
  };

  try {
    await assert.rejects(
      aiService.generateScore("account-1", "cv-1", { industrySlug: "not-real" }),
      (error) => error.statusCode === 400 && error.errors[0].field === "industrySlug"
    );
    assert.equal(fetchCalled, false);
  } finally {
    if (originalEnabled === undefined) delete process.env.AI_SERVICE_ENABLED;
    else process.env.AI_SERVICE_ENABLED = originalEnabled;
    if (originalSlugs === undefined) delete process.env.AI_SUPPORTED_INDUSTRY_SLUGS;
    else process.env.AI_SUPPORTED_INDUSTRY_SLUGS = originalSlugs;
    ApplicantProfile.findOne = originalFindProfile;
    CVDocument.findOne = originalFindCv;
    global.fetch = originalFetch;
  }
});

test("translation extracts text from a file when extractedText is absent", async () => {
  const fs = require("fs");
  const originalEnabled = process.env.AI_SERVICE_ENABLED;
  const originalFindProfile = ApplicantProfile.findOne;
  const originalFindCv = CVDocument.findOne;
  const originalCreate = AIResult.create;
  const originalFetch = global.fetch;
  const originalStat = fs.promises.stat;
  const originalReadFile = fs.promises.readFile;

  process.env.AI_SERVICE_ENABLED = "true";
  ApplicantProfile.findOne = async () => ({ _id: "profile-1" });
  CVDocument.findOne = async () => ({
    _id: "cv-1",
    fileUrl: "/uploads/cvs/translation-source.pdf",
    fileType: "pdf",
    language: "VI"
  });
  fs.promises.stat = async () => ({ isFile: () => true, size: 12 });
  fs.promises.readFile = async () => Buffer.from("%PDF-translation");
  const calls = [];
  const extraction = {
    sections: {
      summary: ["Backend developer"],
      experience: ["Built APIs"],
      education: [],
      skills: ["Node.js"],
      projects: [],
      certifications: [],
      other: []
    },
    local_metrics: {
      bullet_count: 1,
      quantified_bullet_count: 0,
      has_quantified_bullets: false,
      avg_bullet_length: 12,
      section_count: 3,
      detected_languages: ["vi"]
    },
    meta: {},
    normalized_text_length: 50
  };
  global.fetch = async (input, init) => {
    calls.push({ input, init });
    if (calls.length === 1) {
      return new Response(JSON.stringify(extraction), { status: 200 });
    }

    assert.equal(input, "http://localhost:8001/v1/translate");
    const body = JSON.parse(init.body);
    assert.match(body.text, /Summary:/);
    assert.match(body.text, /Experience:/);
    assert.doesNotMatch(body.text, /\[object Object\]/);
    return new Response(JSON.stringify({
      translated: "Backend developer with API experience",
      notes: [],
      meta: { source: "mock" }
    }), { status: 200 });
  };

  AIResult.create = async (payload) => ({
    ...payload,
    _id: { toString: () => "result-translation-file-1" },
    accountId: { toString: () => "account-1" },
    createdAt: new Date(),
    save: async () => undefined
  });

  try {
    const result = await aiService.translateToEnglish("account-1", "cv-1", {});
    assert.ok(calls[0].input.includes("/v1/cv/extract?"));
    assert.equal(calls.length, 2);
    assert.equal(result.result.translated, "Backend developer with API experience");
  } finally {
    if (originalEnabled === undefined) delete process.env.AI_SERVICE_ENABLED;
    else process.env.AI_SERVICE_ENABLED = originalEnabled;
    ApplicantProfile.findOne = originalFindProfile;
    CVDocument.findOne = originalFindCv;
    AIResult.create = originalCreate;
    global.fetch = originalFetch;
    fs.promises.stat = originalStat;
    fs.promises.readFile = originalReadFile;
  }
});

test("translation marks AIResult failed when extraction fails", async () => {
  const fs = require("fs");
  const originalEnabled = process.env.AI_SERVICE_ENABLED;
  const originalFindProfile = ApplicantProfile.findOne;
  const originalFindCv = CVDocument.findOne;
  const originalCreate = AIResult.create;
  const originalFetch = global.fetch;
  const originalStat = fs.promises.stat;
  const originalReadFile = fs.promises.readFile;

  process.env.AI_SERVICE_ENABLED = "true";
  ApplicantProfile.findOne = async () => ({ _id: "profile-1" });
  CVDocument.findOne = async () => ({
    _id: "cv-1",
    fileUrl: "/uploads/cvs/translation-failure.pdf",
    fileType: "pdf",
    language: "VI"
  });
  fs.promises.stat = async () => ({ isFile: () => true, size: 12 });
  fs.promises.readFile = async () => Buffer.from("%PDF-failure");
  global.fetch = async () => new Response(JSON.stringify({
    detail: "Extraction failed"
  }), { status: 422 });

  let saved;
  AIResult.create = async (payload) => {
    const result = {
      ...payload,
      _id: { toString: () => "result-translation-failure-1" },
      accountId: { toString: () => "account-1" },
      createdAt: new Date(),
      save: async () => {
        saved = result;
      }
    };
    return result;
  };

  try {
    await assert.rejects(
      aiService.translateToEnglish("account-1", "cv-1", {}),
      (error) => error.statusCode === 422
    );
    assert.equal(saved.status, "FAILED");
  } finally {
    if (originalEnabled === undefined) delete process.env.AI_SERVICE_ENABLED;
    else process.env.AI_SERVICE_ENABLED = originalEnabled;
    ApplicantProfile.findOne = originalFindProfile;
    CVDocument.findOne = originalFindCv;
    AIResult.create = originalCreate;
    global.fetch = originalFetch;
    fs.promises.stat = originalStat;
    fs.promises.readFile = originalReadFile;
  }
});
