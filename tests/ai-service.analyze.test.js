const assert = require("assert").strict;
const test = require("node:test");

const { AiServiceClient } = require("../src/modules/ai/clients/ai-service.client");

const expectedRequest = {
  sections: {
    summary: ["AI engineering student"],
    experience: ["Built an API used by 12 teammates"],
    education: ["BSc Computer Science"],
    skills: ["Python", "PyTorch"],
    projects: [],
    certifications: [],
    other: []
  },
  industry_slug: "ai_software",
  vertical_slug: "machine_learning",
  company_model: "corporate",
  jd_extract: {
    role_title: "AI Engineer Intern",
    required_keywords: [],
    preferred_keywords: [],
    responsibilities: []
  },
  language: "en",
  tier: "free",
  local_metrics: {
    bullet_count: 1,
    quantified_bullet_count: 1,
    has_quantified_bullets: true,
    avg_bullet_length: 36,
    section_count: 4,
    detected_languages: ["en"]
  },
  llm_model: null,
  strict_industry_match: false
};

const assertNoUndefined = (value) => {
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    assert.notEqual(nested, undefined, `${key} must not be undefined`);
    assertNoUndefined(nested);
  }
};

test("AI client sends the canonical FastAPI analyze JSON", async () => {
  const client = new AiServiceClient({
    baseUrl: "http://ai:8000",
    fetchImpl: async (input, init) => {
      assert.equal(input, "http://ai:8000/v1/cv/analyze");
      assert.equal(init.method, "POST");
      assert.equal(init.headers.get("Content-Type"), "application/json");
      const body = JSON.parse(init.body);
      assert.deepEqual(body, expectedRequest);
      assert.deepEqual(Object.keys(body).sort(), [
        "company_model",
        "industry_slug",
        "jd_extract",
        "language",
        "llm_model",
        "local_metrics",
        "sections",
        "strict_industry_match",
        "tier",
        "vertical_slug"
      ]);
      assert.deepEqual(Object.keys(body.sections).sort(), [
        "certifications",
        "education",
        "experience",
        "other",
        "projects",
        "skills",
        "summary"
      ]);
      assertNoUndefined(body);
      return new Response(JSON.stringify({
        overall_score: 84,
        dimensions: {
          layout_ats: { score: 80, issues: [], fixes: [] },
          language: { score: 85, issues: [], fixes: [] },
          keywords: { score: 82, missing: [], suggested_bullets: [] },
          jd_fit: { score: 88, gaps: [] }
        },
        rewrites: [],
        company_model_feedback: "Good fit",
        confidence: 0.9,
        disclaimer: "AI-assisted feedback only",
        meta: { source: "groq", provider: "groq", model: "test" }
      }), { status: 200 });
    }
  });

  const result = await client.analyzeCv(expectedRequest);

  assert.equal(result.overall_score, 84);
  assert.equal(result.meta.source, "groq");
  assert.equal(result.meta.provider, "groq");
});
