const portfolioErrorResponse = {
  description: "Error response",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ErrorResponse" }
    }
  }
};

const portfolioBearerSecurity = [{ bearerAuth: [] }];
const idParameter = (name: string, description: string) => ({
  name,
  in: "path",
  required: true,
  description,
  schema: { type: "string", example: "66a555555555555555555555" }
});

const jsonRequest = (schema: string, example?: unknown) => ({
  required: true,
  content: {
    "application/json": {
      schema: { $ref: `#/components/schemas/${schema}` },
      ...(example ? { example } : {})
    }
  }
});

const response = (description: string, schema: string, status = 200) => ({
  [status]: {
    description,
    content: {
      "application/json": { schema: { $ref: `#/components/schemas/${schema}` } }
    }
  },
  400: portfolioErrorResponse,
  401: portfolioErrorResponse,
  403: portfolioErrorResponse,
  404: portfolioErrorResponse
});

const portfolioSwaggerPaths = {
  "/api/portfolio/me": {
    get: {
      tags: ["Portfolio"],
      summary: "Get my portfolio profile",
      description: "Returns data.portfolio as null until the Applicant creates the single Portfolio with PUT /api/portfolio/me.",
      security: portfolioBearerSecurity,
      responses: response("Portfolio fetched successfully", "PortfolioDomainReadResponse")
    },
    put: {
      tags: ["Portfolio"],
      summary: "Create or update my portfolio profile",
      security: portfolioBearerSecurity,
      requestBody: jsonRequest("PortfolioProfileRequest", {
        headline: "Backend Developer",
        about: "I build practical web products.",
        desiredRole: "Junior Backend Developer",
        slug: "nguyen-van-a",
        skills: ["Node.js", "MongoDB"],
        socialLinks: { github: "https://github.com/example" }
      }),
      responses: response("Portfolio updated successfully", "PortfolioDomainResponse")
    }
  },
  "/api/portfolio/me/publish": {
    patch: {
      tags: ["Portfolio"],
      summary: "Publish my portfolio",
      security: portfolioBearerSecurity,
      responses: response("Portfolio published successfully", "PortfolioDomainResponse")
    }
  },
  "/api/portfolio/me/unpublish": {
    patch: {
      tags: ["Portfolio"],
      summary: "Unpublish my portfolio",
      security: portfolioBearerSecurity,
      responses: response("Portfolio unpublished successfully", "PortfolioDomainResponse")
    }
  },
  "/api/portfolio/me/featured-experiences": {
    put: {
      tags: ["Portfolio"],
      summary: "Set featured experiences",
      security: portfolioBearerSecurity,
      requestBody: jsonRequest("FeaturedExperiencesRequest", { featuredExperienceIds: [] }),
      responses: response("Featured experiences updated successfully", "PortfolioDomainResponse")
    }
  },
  "/api/portfolio/public/{slug}": {
    get: {
      tags: ["Portfolio"],
      summary: "Get a public portfolio by slug",
      parameters: [idParameter("slug", "Portfolio slug")],
      responses: {
        200: {
          description: "Public portfolio fetched successfully",
          content: { "application/json": { schema: { $ref: "#/components/schemas/PublicPortfolioDomainResponse" } } }
        },
        400: portfolioErrorResponse,
        404: portfolioErrorResponse
      }
    }
  },
  "/api/portfolio/experiences": {
    post: {
      tags: ["Portfolio"],
      summary: "Create an experience",
      security: portfolioBearerSecurity,
      requestBody: jsonRequest("ExperienceRequest", { type: "project", title: "CVBuddy API", description: "Built the backend API." }),
      responses: response("Experience created successfully", "ExperienceResponse", 201)
    },
    get: {
      tags: ["Portfolio"],
      summary: "List my experiences",
      security: portfolioBearerSecurity,
      parameters: [
        { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
        { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
        { name: "status", in: "query", schema: { type: "string", enum: ["draft", "published", "archived"] } },
        { name: "type", in: "query", schema: { type: "string", enum: ["event", "project", "job", "internship", "volunteer", "competition", "workshop", "course", "club", "personal-project", "other"] } },
        { name: "search", in: "query", schema: { type: "string" } }
      ],
      responses: {
        200: {
          description: "Experiences fetched successfully",
          content: { "application/json": { schema: { $ref: "#/components/schemas/ExperienceListResponse" } } }
        },
        401: portfolioErrorResponse,
        403: portfolioErrorResponse
      }
    }
  },
  "/api/portfolio/experiences/{id}": {
    get: {
      tags: ["Portfolio"], summary: "Get an experience", security: portfolioBearerSecurity,
      parameters: [idParameter("id", "Experience id")], responses: response("Experience fetched successfully", "ExperienceResponse")
    },
    patch: {
      tags: ["Portfolio"], summary: "Update an experience", security: portfolioBearerSecurity,
      parameters: [idParameter("id", "Experience id")], requestBody: jsonRequest("ExperienceUpdateRequest"), responses: response("Experience updated successfully", "ExperienceResponse")
    },
    delete: {
      tags: ["Portfolio"], summary: "Delete an experience", security: portfolioBearerSecurity,
      parameters: [idParameter("id", "Experience id")], responses: { 200: { description: "Experience deleted successfully", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } }, 400: portfolioErrorResponse, 401: portfolioErrorResponse, 403: portfolioErrorResponse, 404: portfolioErrorResponse }
    }
  },
  "/api/portfolio/experiences/{id}/publish": {
    patch: { tags: ["Portfolio"], summary: "Publish an experience", security: portfolioBearerSecurity, parameters: [idParameter("id", "Experience id")], responses: response("Experience published successfully", "ExperienceResponse") }
  },
  "/api/portfolio/experiences/{id}/archive": {
    patch: { tags: ["Portfolio"], summary: "Archive an experience", security: portfolioBearerSecurity, parameters: [idParameter("id", "Experience id")], responses: response("Experience archived successfully", "ExperienceResponse") }
  },
  "/api/portfolio/experiences/{id}/cover": {
    patch: {
      tags: ["Portfolio"], summary: "Set an experience cover", security: portfolioBearerSecurity, parameters: [idParameter("id", "Experience id")],
      requestBody: { required: true, content: { "multipart/form-data": { schema: { $ref: "#/components/schemas/ExperienceCoverRequest" } }, "application/json": { schema: { $ref: "#/components/schemas/ExperienceCoverRequest" } } } },
      responses: response("Experience cover updated successfully", "ExperienceResponse")
    },
    post: {
      tags: ["Portfolio"], summary: "Set an experience cover (legacy-compatible alias)", security: portfolioBearerSecurity, parameters: [idParameter("id", "Experience id")],
      requestBody: { required: true, content: { "multipart/form-data": { schema: { $ref: "#/components/schemas/ExperienceCoverRequest" } }, "application/json": { schema: { $ref: "#/components/schemas/ExperienceCoverRequest" } } } },
      responses: response("Experience cover updated successfully", "ExperienceResponse")
    }
  },
  "/api/portfolio/moments": {
    post: {
      tags: ["Portfolio"], summary: "Create a moment with 1 to 5 media files", security: portfolioBearerSecurity,
      requestBody: { required: true, content: { "multipart/form-data": { schema: { $ref: "#/components/schemas/MomentMultipartRequest" } } } },
      responses: response("Moment created successfully", "MomentResponse", 201)
    },
    get: {
      tags: ["Portfolio"], summary: "List my moments", security: portfolioBearerSecurity,
      parameters: [
        { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
        { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
        { name: "experienceId", in: "query", schema: { type: "string" } },
        { name: "status", in: "query", schema: { type: "string", enum: ["draft", "ready"] } },
        { name: "visibility", in: "query", schema: { type: "string", enum: ["private", "portfolio"] } }
      ],
      responses: { 200: { description: "Moments fetched successfully", content: { "application/json": { schema: { $ref: "#/components/schemas/MomentListResponse" } } } }, 401: portfolioErrorResponse, 403: portfolioErrorResponse }
    }
  },
  "/api/portfolio/moments/{id}": {
    get: { tags: ["Portfolio"], summary: "Get a moment", security: portfolioBearerSecurity, parameters: [idParameter("id", "Moment id")], responses: response("Moment fetched successfully", "MomentResponse") },
    patch: { tags: ["Portfolio"], summary: "Update a moment", security: portfolioBearerSecurity, parameters: [idParameter("id", "Moment id")], requestBody: jsonRequest("MomentUpdateRequest"), responses: response("Moment updated successfully", "MomentResponse") },
    delete: { tags: ["Portfolio"], summary: "Delete a moment and its assets", security: portfolioBearerSecurity, parameters: [idParameter("id", "Moment id")], responses: { 200: { description: "Moment deleted successfully", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } }, 400: portfolioErrorResponse, 401: portfolioErrorResponse, 403: portfolioErrorResponse, 404: portfolioErrorResponse } }
  },
  "/api/portfolio/moments/{id}/assign-experience": {
    patch: { tags: ["Portfolio"], summary: "Assign a moment to an experience", security: portfolioBearerSecurity, parameters: [idParameter("id", "Moment id")], requestBody: jsonRequest("MomentAssignmentRequest", { experienceId: "66a777777777777777777777" }), responses: response("Moment assigned to experience successfully", "MomentResponse") }
  },
  "/api/portfolio/moments/{id}/unassign-experience": {
    patch: { tags: ["Portfolio"], summary: "Unassign a moment from an experience", security: portfolioBearerSecurity, parameters: [idParameter("id", "Moment id")], responses: response("Moment unassigned from experience successfully", "MomentResponse") }
  },
  "/api/portfolio/experiences/{experienceId}/evidence": {
    post: { tags: ["Portfolio"], summary: "Add URL or uploaded-file evidence", security: portfolioBearerSecurity, parameters: [idParameter("experienceId", "Experience id")], requestBody: { required: true, content: { "multipart/form-data": { schema: { $ref: "#/components/schemas/EvidenceMultipartRequest" } }, "application/json": { schema: { $ref: "#/components/schemas/EvidenceRequest" } } } }, responses: response("Evidence created successfully", "EvidenceResponse", 201) },
    get: { tags: ["Portfolio"], summary: "List evidence for an experience", security: portfolioBearerSecurity, parameters: [idParameter("experienceId", "Experience id")], responses: { 200: { description: "Evidence fetched successfully", content: { "application/json": { schema: { $ref: "#/components/schemas/EvidenceListResponse" } } } }, 401: portfolioErrorResponse, 403: portfolioErrorResponse, 404: portfolioErrorResponse } }
  },
  "/api/portfolio/evidence/{id}": {
    patch: { tags: ["Portfolio"], summary: "Update evidence", security: portfolioBearerSecurity, parameters: [idParameter("id", "Evidence id")], requestBody: { required: true, content: { "multipart/form-data": { schema: { $ref: "#/components/schemas/EvidenceUpdateMultipartRequest" } }, "application/json": { schema: { $ref: "#/components/schemas/EvidenceUpdateRequest" } } } }, responses: response("Evidence updated successfully", "EvidenceResponse") },
    delete: { tags: ["Portfolio"], summary: "Delete evidence and its asset", security: portfolioBearerSecurity, parameters: [idParameter("id", "Evidence id")], responses: { 200: { description: "Evidence deleted successfully", content: { "application/json": { schema: { $ref: "#/components/schemas/SuccessResponse" } } } }, 400: portfolioErrorResponse, 401: portfolioErrorResponse, 403: portfolioErrorResponse, 404: portfolioErrorResponse } }
  }
};

const portfolioResponse = (schema: string) => ({
  allOf: [
    { $ref: "#/components/schemas/SuccessResponse" },
    {
      type: "object",
      properties: {
        data: {
          type: "object",
          properties: {
            [schema === "PortfolioProfile"
              ? "portfolio"
              : schema === "PortfolioExperience"
                ? "experience"
                : schema === "PortfolioMoment"
                  ? "moment"
                  : "evidence"]: { $ref: `#/components/schemas/${schema}` }
          }
        }
      }
    }
  ]
});

const portfolioSwaggerSchemas = {
  PortfolioProfile: {
    type: "object",
    properties: {
      id: { type: "string" }, headline: { type: "string" }, about: { type: "string" }, desiredRole: { type: "string" }, slug: { type: "string", example: "nguyen-van-a" }, isPublic: { type: "boolean" }, skills: { type: "array", items: { type: "string" } }, socialLinks: { type: "object", additionalProperties: { type: "string", format: "uri" } }, featuredExperienceIds: { type: "array", maxItems: 6, items: { type: "string" } }, createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" }
    }
  },
  PortfolioProfileRequest: {
    type: "object", additionalProperties: false, description: "slug is required when creating the profile and optional when updating an existing profile. Publish state is changed through the publish/unpublish endpoints.", properties: { headline: { type: "string", maxLength: 180 }, about: { type: "string", maxLength: 5000 }, desiredRole: { type: "string", maxLength: 180 }, slug: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }, skills: { type: "array", items: { type: "string" } }, socialLinks: { type: "object" } }
  },
  FeaturedExperiencesRequest: { type: "object", required: ["featuredExperienceIds"], properties: { featuredExperienceIds: { type: "array", maxItems: 6, items: { type: "string" } } } },
  PortfolioAsset: { type: "object", properties: { id: { type: "string" }, assetType: { type: "string", enum: ["image", "video", "document", "certificate", "other"] }, usage: { type: "string", enum: ["moment-media", "experience-cover", "experience-evidence"] }, secureUrl: { type: "string", format: "uri" }, originalFilename: { type: "string" }, mimeType: { type: "string" }, format: { type: "string", nullable: true }, bytes: { type: "integer", nullable: true }, createdAt: { type: "string", format: "date-time" } } },
  PortfolioExperience: { type: "object", properties: { id: { type: "string" }, type: { type: "string", enum: ["event", "project", "job", "internship", "volunteer", "competition", "workshop", "course", "club", "personal-project", "other"] }, title: { type: "string" }, organization: { type: "string" }, role: { type: "string" }, startDate: { type: "string", format: "date-time", nullable: true }, endDate: { type: "string", format: "date-time", nullable: true }, isCurrent: { type: "boolean" }, location: { type: "string" }, description: { type: "string" }, responsibilities: { type: "array", items: { type: "string" } }, achievements: { type: "array", items: { type: "string" } }, skills: { type: "array", items: { type: "string" } }, coverAsset: { $ref: "#/components/schemas/PortfolioAsset" }, status: { type: "string", enum: ["draft", "published", "archived"] }, visibility: { type: "string", enum: ["private", "portfolio"] }, createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" } } },
  ExperienceRequest: { type: "object", required: ["type", "title"], properties: { type: { type: "string" }, title: { type: "string" }, organization: { type: "string" }, role: { type: "string" }, startDate: { type: "string", format: "date" }, endDate: { type: "string", format: "date" }, isCurrent: { type: "boolean" }, location: { type: "string" }, description: { type: "string" }, responsibilities: { type: "array", items: { type: "string" } }, achievements: { type: "array", items: { type: "string" } }, skills: { type: "array", items: { type: "string" } }, visibility: { type: "string" } } },
  ExperienceUpdateRequest: { type: "object", additionalProperties: false, properties: { type: { type: "string" }, title: { type: "string" }, organization: { type: "string" }, role: { type: "string" }, startDate: { type: "string", format: "date" }, endDate: { type: "string", format: "date" }, isCurrent: { type: "boolean" }, location: { type: "string" }, description: { type: "string" }, responsibilities: { type: "array", items: { type: "string" } }, achievements: { type: "array", items: { type: "string" } }, skills: { type: "array", items: { type: "string" } }, visibility: { type: "string" } } },
  ExperienceCoverRequest: { type: "object", properties: { assetId: { type: "string" }, cover: { type: "string", format: "binary" } } },
  PortfolioMoment: { type: "object", properties: { id: { type: "string" }, experienceId: { type: "string", nullable: true }, caption: { type: "string" }, capturedAt: { type: "string", format: "date-time" }, location: { type: "string" }, skills: { type: "array", items: { type: "string" } }, mediaAssets: { type: "array", items: { $ref: "#/components/schemas/PortfolioAsset" } }, createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" } } },
  MomentMultipartRequest: { type: "object", required: ["media", "capturedAt"], properties: { media: { type: "array", maxItems: 5, items: { type: "string", format: "binary" } }, caption: { type: "string" }, capturedAt: { type: "string", format: "date-time" }, experienceId: { type: "string" }, location: { type: "string" }, skills: { type: "string", description: "JSON array or comma-separated values" }, status: { type: "string", enum: ["draft", "ready"] }, visibility: { type: "string", enum: ["private", "portfolio"] } } },
  MomentUpdateRequest: { type: "object", properties: { caption: { type: "string" }, capturedAt: { type: "string", format: "date-time" }, experienceId: { type: "string", nullable: true }, location: { type: "string" }, skills: { type: "array", items: { type: "string" } }, status: { type: "string" }, visibility: { type: "string" } } },
  MomentAssignmentRequest: { type: "object", required: ["experienceId"], properties: { experienceId: { type: "string" } } },
  PortfolioEvidence: { type: "object", properties: { id: { type: "string" }, experienceId: { type: "string" }, type: { type: "string", enum: ["file", "certificate", "github", "website", "article", "video", "other"] }, title: { type: "string" }, description: { type: "string" }, url: { type: "string", format: "uri", nullable: true }, asset: { $ref: "#/components/schemas/PortfolioAsset" }, createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" } } },
  EvidenceRequest: { type: "object", required: ["type", "title"], properties: { type: { type: "string" }, title: { type: "string" }, description: { type: "string" }, url: { type: "string", format: "uri" }, verificationStatus: { type: "string", enum: ["unverified", "document-provided"] } } },
  EvidenceMultipartRequest: { type: "object", required: ["type", "title"], properties: { type: { type: "string" }, title: { type: "string" }, description: { type: "string" }, url: { type: "string", format: "uri" }, file: { type: "string", format: "binary" } } },
  EvidenceUpdateRequest: { type: "object", properties: { type: { type: "string" }, title: { type: "string" }, description: { type: "string" }, url: { type: "string", format: "uri", nullable: true }, verificationStatus: { type: "string", enum: ["unverified", "document-provided"] } } },
  EvidenceUpdateMultipartRequest: { allOf: [{ $ref: "#/components/schemas/EvidenceUpdateRequest" }], properties: { file: { type: "string", format: "binary" } } },
  PortfolioDomainResponse: portfolioResponse("PortfolioProfile"),
  PortfolioDomainReadResponse: {
    allOf: [
      { $ref: "#/components/schemas/SuccessResponse" },
      {
        type: "object",
        properties: {
          data: {
            type: "object",
            properties: {
              portfolio: {
                allOf: [{ $ref: "#/components/schemas/PortfolioProfile" }],
                nullable: true
              }
            }
          }
        }
      }
    ]
  },
  ExperienceResponse: portfolioResponse("PortfolioExperience"),
  MomentResponse: portfolioResponse("PortfolioMoment"),
  EvidenceResponse: portfolioResponse("PortfolioEvidence"),
  ExperienceListResponse: { allOf: [{ $ref: "#/components/schemas/SuccessResponse" }, { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/PortfolioExperience" } }, pagination: { type: "object" } } }] },
  MomentListResponse: { allOf: [{ $ref: "#/components/schemas/SuccessResponse" }, { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/PortfolioMoment" } }, pagination: { type: "object" } } }] },
  EvidenceListResponse: { allOf: [{ $ref: "#/components/schemas/SuccessResponse" }, { type: "object", properties: { data: { type: "object", properties: { evidence: { type: "array", items: { $ref: "#/components/schemas/PortfolioEvidence" } } } } } }] },
  PublicPortfolioDomainResponse: { allOf: [{ $ref: "#/components/schemas/SuccessResponse" }, { type: "object", properties: { data: { type: "object", properties: { portfolio: { $ref: "#/components/schemas/PortfolioProfile" }, featuredExperiences: { type: "array", items: { $ref: "#/components/schemas/PortfolioExperience" } }, experiences: { type: "array", items: { $ref: "#/components/schemas/PortfolioExperience" } }, moments: { type: "array", items: { $ref: "#/components/schemas/PortfolioMoment" } }, momentsByExperience: { type: "array" }, evidence: { type: "array", items: { $ref: "#/components/schemas/PortfolioEvidence" } } } } } }] }
};

export { portfolioSwaggerPaths, portfolioSwaggerSchemas };
