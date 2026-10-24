const assert = require("assert").strict;
const test = require("node:test");

const {
  AiServiceClient,
  AiServiceError,
  isAiServiceError
} = require("../src/modules/ai/clients/ai-service.client");
const aiService = require("../src/modules/ai/ai.service");
const {
  cvAiRequestValidation,
  careerTargetAiRequestValidation
} = require("../src/modules/ai/ai.validation");
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
  meta: { source: "groq", provider: "groq", model: "test" }
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

const extractResponse = {
  sections: {
    summary: ["Backend engineer"],
    experience: ["Built an API"],
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
    detected_languages: ["en"]
  },
  meta: { source: "groq", provider: "groq", model: "test" },
  normalized_text_length: 34
};

test("public AI requests reject client-controlled tier and plan fields", () => {
  const cvId = "507f1f77bcf86cd799439011";
  const forgedFields = [
    ["tier", "subscription"],
    ["subscription", true],
    ["plan", "PRO"],
    ["planCode", "PRO_30D"],
    ["credits", 999],
    ["creditCost", 0]
  ];

  for (const [field, value] of forgedFields) {
    const errors = cvAiRequestValidation({
      params: { cvId },
      body: { [field]: value }
    });

    assert.ok(errors.some((error) =>
      error.field === field && error.message === `${field} is controlled by the server`
    ));
  }

  const validCareerRequest = careerTargetAiRequestValidation({
    params: { cvId },
    body: { industrySlug: "ai_software", verticalSlug: "backend_ai", targetRole: "Backend Engineer" }
  });
  assert.deepEqual(validCareerRequest, []);
});

test("career targeting requires verticalSlug and defaults support finance and hospitality", () => {
  const cvId = "507f1f77bcf86cd799439011";
  assert.ok(careerTargetAiRequestValidation({ params: { cvId }, body: { industrySlug: "finance_banking", targetRole: "Financial Analyst" } }).some((error) => error.field === "verticalSlug"));
  const { getAiServiceConfig } = require("../src/modules/ai/ai.config");
  const config = getAiServiceConfig();
  assert.ok(config.supportedIndustrySlugs.includes("finance_banking"));
  assert.ok(config.supportedIndustrySlugs.includes("hospitality_tourism"));
});

const runTranslationFailureCase = async ({ fetchImpl, timeoutMs, expectedStatus, expectedCode }) => {
  const originalEnabled = process.env.AI_SERVICE_ENABLED;
  const originalTimeout = process.env.AI_SERVICE_TIMEOUT_MS;
  const originalFindProfile = ApplicantProfile.findOne;
  const originalFindCv = CVDocument.findOne;
  const originalCreate = AIResult.create;
  const originalFetch = global.fetch;
  let saved;

  process.env.AI_SERVICE_ENABLED = "true";
  process.env.AI_SERVICE_TIMEOUT_MS = String(timeoutMs || 60_000);
  ApplicantProfile.findOne = async () => ({ _id: "profile-1" });
  CVDocument.findOne = async () => ({
    _id: "cv-1",
    extractedText: "Kinh nghiem lam viec",
    language: "VI"
  });
  AIResult.create = async (payload) => {
    const result = {
      ...payload,
      _id: { toString: () => "failed-result-1" },
      accountId: { toString: () => "account-1" },
      createdAt: new Date(),
      save: async () => {
        saved = result;
      }
    };
    return result;
  };
  global.fetch = fetchImpl;

  try {
    await assert.rejects(
      aiService.translateToEnglish("account-1", "cv-1", {}),
      (error) => error.statusCode === expectedStatus && error.code === expectedCode
    );
    assert.equal(saved.status, "FAILED");
    assert.equal(saved.errorCode, expectedCode);
    assert.ok(saved.completedAt instanceof Date);
    assert.equal(saved.resultText, undefined);
  } finally {
    if (originalEnabled === undefined) delete process.env.AI_SERVICE_ENABLED;
    else process.env.AI_SERVICE_ENABLED = originalEnabled;
    if (originalTimeout === undefined) delete process.env.AI_SERVICE_TIMEOUT_MS;
    else process.env.AI_SERVICE_TIMEOUT_MS = originalTimeout;
    ApplicantProfile.findOne = originalFindProfile;
    CVDocument.findOne = originalFindCv;
    AIResult.create = originalCreate;
    global.fetch = originalFetch;
  }
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

test("AI client sends the internal key and request ID only to the configured AI service", async () => {
  const client = new AiServiceClient({
    baseUrl: "http://ai:8000",
    internalApiKey: "test-only-internal-key-not-a-real-secret",
    requestId: "request-12345678",
    fetchImpl: async (input, init) => {
      assert.equal(input, "http://ai:8000/health");
      assert.equal(init.headers.get("X-AI-Internal-Key"), "test-only-internal-key-not-a-real-secret");
      assert.equal(init.headers.get("X-Request-ID"), "request-12345678");
      return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
    }
  });

  await client.health();
});

test("AI client preserves the safe FastAPI error code without exposing internals", async () => {
  const client = new AiServiceClient({
    fetchImpl: async () => new Response(JSON.stringify({
      detail: { code: "AI_UNAUTHORIZED", message: "Unauthorized AI service request" }
    }), { status: 401 })
  });

  await assert.rejects(
    client.analyzeCv(analyzeRequest),
    (error) => {
      assert.equal(error.statusCode, 401);
      assert.equal(error.upstreamCode, "AI_UNAUTHORIZED");
      assert.equal(error.message, "AI service authentication failed");
      return true;
    }
  );
});

test("AI POST calls carry the internal key only to the configured host and reject redirects", async () => {
  const paths = [];
  const client = new AiServiceClient({
    baseUrl: "http://ai:8000/",
    internalApiKey: "test-only-internal-key-not-a-real-secret",
    fetchImpl: async (input, init) => {
      const url = new URL(input);
      assert.equal(url.origin, "http://ai:8000");
      assert.equal(init.method, "POST");
      assert.equal(init.redirect, "error");
      assert.equal(init.headers.get("X-AI-Internal-Key"), "test-only-internal-key-not-a-real-secret");
      assert.equal(init.headers.has("Authorization"), false);
      paths.push(url.pathname);
      return new Response(JSON.stringify(url.pathname === "/v1/translate"
        ? { translated: "Work experience", notes: [], meta: { source: "groq", provider: "groq" } }
        : analyzeResponse), { status: 200 });
    }
  });
  await client.analyzeCv(analyzeRequest);
  await client.extractAndAnalyze({ bytes: Buffer.from("%PDF-test"), mimeType: "application/pdf", filename: "cv.pdf" }, {});
  await client.translate({ text: "Kinh nghiem", source_lang: "vi", target_lang: "en", mode: "cv_native", tier: "free" });
  assert.deepEqual(paths, ["/v1/cv/analyze", "/v1/cv/extract-and-analyze", "/v1/translate"]);
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

test("AI client preserves an upstream 5xx when its response body is not JSON", async () => {
  const client = new AiServiceClient({
    requestId: "request-upstream-html",
    fetchImpl: async () => new Response("<html>gateway failure</html>", {
      status: 502,
      headers: { "Content-Type": "text/html" }
    })
  });

  await assert.rejects(
    client.analyzeCv(analyzeRequest),
    (error) => {
      assert.ok(error instanceof AiServiceError);
      assert.equal(error.kind, "http");
      assert.equal(error.statusCode, 502);
      assert.equal(error.responseFormat, "non_json");
      assert.equal(error.message, "AI service returned an internal error");
      assert.doesNotMatch(error.message, /gateway failure/);
      return true;
    }
  );
});

test("AI client classifies an empty successful response without exposing a body", async () => {
  const client = new AiServiceClient({
    fetchImpl: async () => new Response(null, { status: 200 })
  });

  await assert.rejects(
    client.analyzeCv(analyzeRequest),
    (error) => {
      assert.equal(error.kind, "invalid_response");
      assert.equal(error.responseFormat, "empty");
      return true;
    }
  );
});

test("AI client accepts a complete non-empty extraction contract", async () => {
  const client = new AiServiceClient({
    fetchImpl: async () => new Response(JSON.stringify(extractResponse), { status: 200 })
  });

  const result = await client.extractCv(
    { bytes: Buffer.from("synthetic"), filename: "synthetic.pdf", mimeType: "application/pdf" },
    { mode: "hybrid", targetLanguage: "en" }
  );

  assert.equal(result.normalized_text_length, 34);
  assert.deepEqual(result.local_metrics.detected_languages, ["en"]);
});

test("AI client rejects an empty extraction before downstream analysis", async () => {
  const client = new AiServiceClient({
    fetchImpl: async () => new Response(JSON.stringify({
      ...extractResponse,
      sections: Object.fromEntries(Object.keys(extractResponse.sections).map((key) => [key, []])),
      local_metrics: {},
      normalized_text_length: 0
    }), { status: 200 })
  });

  await assert.rejects(
    client.extractCv(
      { bytes: Buffer.from("synthetic"), filename: "synthetic.pdf", mimeType: "application/pdf" },
      { mode: "hybrid", targetLanguage: "en" }
    ),
    (error) => error.kind === "invalid_response" && /invalid extraction response/.test(error.message)
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

test("AI client rejects mock output unless it is explicitly allowed", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    ...analyzeResponse,
    meta: { source: "mock", provider: "mock", model: "mock-test" }
  }), { status: 200 });

  await assert.rejects(
    new AiServiceClient({ fetchImpl }).analyzeCv(analyzeRequest),
    (error) => error.kind === "invalid_response" && /mock output/.test(error.message)
  );

  const allowed = await new AiServiceClient({
    allowMockOutput: true,
    fetchImpl
  }).analyzeCv(analyzeRequest);
  assert.equal(allowed.meta.source, "mock");
});

test("AI client rejects a successful response that does not prove Groq provenance", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    ...analyzeResponse,
    meta: { source: "groq", model: "test" }
  }), { status: 200 });

  await assert.rejects(
    new AiServiceClient({ fetchImpl }).analyzeCv(analyzeRequest),
    (error) => error.kind === "invalid_response" && /source and provider/.test(error.message)
  );
});

test("production AI client rejects Groq responses without the required metadata contract", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    await assert.rejects(
      new AiServiceClient({
        fetchImpl: async () => new Response(JSON.stringify({
          ...analyzeResponse,
          meta: { source: "groq", provider: "groq", model: "test" }
        }), { status: 200 })
      }).analyzeCv(analyzeRequest),
      (error) => error.kind === "invalid_response" && /supported production metadata/.test(error.message)
    );
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }
});

test("AI service connection failure marks AIResult failed", async () => {
  await runTranslationFailureCase({
    fetchImpl: async () => {
      throw new TypeError("connect failed");
    },
    expectedStatus: 503,
    expectedCode: "AI_SERVICE_UNAVAILABLE"
  });
});

test("AI service timeout marks AIResult failed", async () => {
  await runTranslationFailureCase({
    timeoutMs: 5,
    fetchImpl: async (_input, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    }),
    expectedStatus: 504,
    expectedCode: "AI_SERVICE_TIMEOUT"
  });
});

test("AI service 5xx marks AIResult failed without mock fallback", async () => {
  await runTranslationFailureCase({
    fetchImpl: async () => new Response(JSON.stringify({ detail: "provider failed" }), { status: 503 }),
    expectedStatus: 502,
    expectedCode: "AI_PROVIDER_ERROR"
  });
});

test("AI service authentication failure is mapped to a safe service error", async () => {
  await runTranslationFailureCase({
    fetchImpl: async () => new Response(JSON.stringify({
      detail: { code: "AI_UNAUTHORIZED", message: "Internal AI service authentication failed." }
    }), { status: 401 }),
    expectedStatus: 503,
    expectedCode: "AI_SERVICE_AUTH_FAILED"
  });
});

test("FastAPI provider timeout taxonomy remains a 504 at the Node boundary", async () => {
  await runTranslationFailureCase({
    fetchImpl: async () => new Response(JSON.stringify({
      detail: { code: "AI_PROVIDER_TIMEOUT", message: "AI provider request timed out." }
    }), { status: 504 }),
    expectedStatus: 504,
    expectedCode: "AI_PROVIDER_TIMEOUT"
  });
});

test("invalid AI service response marks AIResult failed", async () => {
  await runTranslationFailureCase({
    fetchImpl: async () => new Response(JSON.stringify({ translated: "missing notes" }), { status: 200 }),
    expectedStatus: 502,
    expectedCode: "AI_PROVIDER_ERROR"
  });
});

test("ownership failure happens before any AI service call", async () => {
  const originalEnabled = process.env.AI_SERVICE_ENABLED;
  const originalFindProfile = ApplicantProfile.findOne;
  const originalFetch = global.fetch;
  let fetchCalled = false;

  process.env.AI_SERVICE_ENABLED = "true";
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
    if (originalEnabled === undefined) delete process.env.AI_SERVICE_ENABLED;
    else process.env.AI_SERVICE_ENABLED = originalEnabled;
    ApplicantProfile.findOne = originalFindProfile;
    global.fetch = originalFetch;
  }
});

test("disabled AI fails closed without calling dependencies or creating AIResult", async () => {
  const originalEnabled = process.env.AI_SERVICE_ENABLED;
  const originalFindProfile = ApplicantProfile.findOne;
  const originalCreate = AIResult.create;
  const originalFetch = global.fetch;
  let profileRead = false;
  let resultCreated = false;
  let fetchCalled = false;

  process.env.AI_SERVICE_ENABLED = "false";
  ApplicantProfile.findOne = async () => {
    profileRead = true;
    return { _id: "profile-1" };
  };
  AIResult.create = async () => {
    resultCreated = true;
  };
  global.fetch = async () => {
    fetchCalled = true;
    return new Response("{}", { status: 200 });
  };

  try {
    for (const action of [aiService.generateScore, aiService.translateAndScore]) {
      await assert.rejects(
        action("account-1", "cv-1", {}),
        (error) => error.statusCode === 503 && error.code === "AI_FEATURE_DISABLED"
      );
    }
    assert.equal(profileRead, false);
    assert.equal(resultCreated, false);
    assert.equal(fetchCalled, false);
  } finally {
    if (originalEnabled === undefined) delete process.env.AI_SERVICE_ENABLED;
    else process.env.AI_SERVICE_ENABLED = originalEnabled;
    ApplicantProfile.findOne = originalFindProfile;
    AIResult.create = originalCreate;
    global.fetch = originalFetch;
  }
});

test("workflow marks its first AIResult failed when the second result cannot be created", async () => {
  const originalEnabled = process.env.AI_SERVICE_ENABLED;
  const originalFindProfile = ApplicantProfile.findOne;
  const originalFindCv = CVDocument.findOne;
  const originalCreate = AIResult.create;
  let created = 0;
  let firstResult;

  process.env.AI_SERVICE_ENABLED = "true";
  ApplicantProfile.findOne = async () => ({ _id: "profile-1" });
  CVDocument.findOne = async () => ({
    _id: { toString: () => "cv-1" },
    extractedText: "Backend experience",
    language: "EN"
  });
  AIResult.create = async (payload) => {
    created += 1;
    if (created === 2) throw new Error("database write failed");
    firstResult = {
      ...payload,
      _id: { toString: () => "translation-result-1" },
      accountId: { toString: () => "account-1" },
      createdAt: new Date(),
      save: async () => undefined
    };
    return firstResult;
  };

  try {
    await assert.rejects(
      aiService.translateAndScore("account-1", "cv-1", { industrySlug: "language" }),
      /database write failed/
    );
    assert.equal(firstResult.status, "FAILED");
    assert.equal(firstResult.errorCode, "AI_RESULT_INITIALIZATION_FAILED");
    assert.ok(firstResult.completedAt instanceof Date);
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
    meta: { source: "groq", provider: "groq", model: "test" }
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
  fs.promises.readFile = async () => Buffer.from("\n%PDF-translation");
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
      meta: { source: "groq", provider: "groq", model: "test" }
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

test("AI POST calls carry the internal key only to the configured host and reject redirects", async () => {
  const paths = [];
  const client = new AiServiceClient({
    baseUrl: "http://ai:8000/",
    internalApiKey: "test-only-internal-key-not-a-real-secret",
    fetchImpl: async (input, init) => {
      const url = new URL(input);
      assert.equal(url.origin, "http://ai:8000");
      assert.equal(init.method, "POST");
      assert.equal(init.redirect, "error");
      assert.equal(init.headers.get("X-AI-Internal-Key"), "test-only-internal-key-not-a-real-secret");
      assert.equal(init.headers.has("Authorization"), false);
      paths.push(url.pathname);
      return new Response(JSON.stringify(url.pathname === "/v1/translate"
        ? { translated: "Work experience", notes: [], meta: { source: "groq", provider: "groq" } }
        : analyzeResponse), { status: 200 });
    }
  });
  await client.analyzeCv(analyzeRequest);
  await client.extractAndAnalyze({ bytes: Buffer.from("%PDF-test"), mimeType: "application/pdf", filename: "cv.pdf" }, {});
  await client.translate({ text: "Kinh nghiem", source_lang: "vi", target_lang: "en", mode: "cv_native", tier: "free" });
  assert.deepEqual(paths, ["/v1/cv/analyze", "/v1/cv/extract-and-analyze", "/v1/translate"]);
});
