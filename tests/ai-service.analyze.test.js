const assert = require("assert").strict;
const test = require("node:test");

const { AiServiceClient } = require("../src/modules/ai/clients/ai-service.client");

test("AI client accepts the FastAPI analyze response schema", async () => {
  const client = new AiServiceClient({
    baseUrl: "http://ai:8000",
    fetchImpl: async (input, init) => {
      assert.equal(input, "http://ai:8000/v1/cv/analyze");
      assert.equal(init.method, "POST");
      assert.equal(init.headers.get("Content-Type"), "application/json");
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
        meta: { source: "mock", model: "test" }
      }), { status: 200 });
    }
  });

  const result = await client.analyzeCv({
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
  });

  assert.equal(result.overall_score, 84);
  assert.equal(result.meta.source, "mock");
});
