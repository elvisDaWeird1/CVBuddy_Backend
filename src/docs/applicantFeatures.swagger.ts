const bearerSecurity = [{ bearerAuth: [] }];
const idParameter = (name: string) => ({
  name,
  in: "path",
  required: true,
  schema: { type: "string" }
});
const errorResponse = {
  description: "Error response with stable code when available",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ErrorResponse" }
    }
  }
};

const portfolioCollectionSwaggerPaths = {
  "/api/portfolios": {
    get: {
      tags: ["Portfolio"],
      summary: "List the authenticated applicant portfolios",
      security: bearerSecurity,
      responses: {
        200: {
          description: "Portfolio list",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/PortfolioCollectionResponse" }
            }
          }
        },
        401: errorResponse
      }
    },
    post: {
      tags: ["Portfolio"],
      summary: "Create a private portfolio",
      security: bearerSecurity,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["title"],
              additionalProperties: false,
              properties: {
                title: { type: "string", minLength: 2, maxLength: 100 },
                description: { type: "string", maxLength: 2000 }
              }
            }
          }
        }
      },
      responses: {
        201: { description: "Portfolio created" },
        400: errorResponse,
        401: errorResponse,
        409: errorResponse
      }
    }
  },
  "/api/portfolios/{portfolioId}": {
    get: {
      tags: ["Portfolio"],
      summary: "Get an owned portfolio",
      security: bearerSecurity,
      parameters: [idParameter("portfolioId")],
      responses: {
        200: { description: "Portfolio detail" },
        403: errorResponse,
        404: errorResponse
      }
    },
    patch: {
      tags: ["Portfolio"],
      summary: "Update portfolio title or description",
      security: bearerSecurity,
      parameters: [idParameter("portfolioId")],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                title: { type: "string", minLength: 2, maxLength: 100 },
                description: { type: "string", maxLength: 2000 }
              }
            }
          }
        }
      },
      responses: {
        200: { description: "Portfolio updated" },
        400: errorResponse,
        403: errorResponse,
        404: errorResponse
      }
    },
    delete: {
      tags: ["Portfolio"],
      summary: "Delete a portfolio and cascade its children",
      security: bearerSecurity,
      parameters: [idParameter("portfolioId")],
      responses: {
        200: { description: "Delete counts and Cloudinary cleanup failure count" },
        403: errorResponse,
        404: errorResponse
      }
    }
  },
  "/api/portfolios/{portfolioId}/visibility": {
    patch: {
      tags: ["Portfolio"],
      summary: "Publish or unpublish a portfolio",
      security: bearerSecurity,
      parameters: [idParameter("portfolioId")],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["visibility"],
              additionalProperties: false,
              properties: {
                visibility: { type: "string", enum: ["PRIVATE", "PUBLIC"] }
              }
            }
          }
        }
      },
      responses: {
        200: { description: "Visibility updated" },
        400: errorResponse,
        403: errorResponse,
        404: errorResponse
      }
    }
  },
  "/api/portfolios/{portfolioId}/moments": {
    get: {
      tags: ["Portfolio"],
      summary: "List Moments in one owned portfolio",
      security: bearerSecurity,
      parameters: [idParameter("portfolioId")],
      responses: { 200: { description: "Moment list" }, 403: errorResponse, 404: errorResponse }
    },
    post: {
      tags: ["Portfolio"],
      summary: "Upload one image and create a Moment in one portfolio",
      security: bearerSecurity,
      parameters: [idParameter("portfolioId")],
      requestBody: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              required: ["image"],
              properties: {
                image: { type: "string", format: "binary", description: "JPEG, PNG or WebP; maximum 5 MB" },
                caption: { type: "string", maxLength: 500 },
                capturedAt: { type: "string", format: "date-time" }
              }
            }
          }
        }
      },
      responses: {
        201: { description: "Moment created" },
        400: errorResponse,
        403: errorResponse,
        404: errorResponse,
        413: errorResponse,
        502: errorResponse
      }
    }
  },
  "/api/portfolios/{portfolioId}/experiences": {
    get: {
      tags: ["Portfolio"],
      summary: "List Experiences in one owned portfolio",
      security: bearerSecurity,
      parameters: [idParameter("portfolioId")],
      responses: { 200: { description: "Experience list" }, 403: errorResponse, 404: errorResponse }
    },
    post: {
      tags: ["Portfolio"],
      summary: "Create an Experience in one owned portfolio",
      security: bearerSecurity,
      parameters: [idParameter("portfolioId")],
      responses: {
        201: { description: "Experience created" },
        400: errorResponse,
        403: errorResponse,
        404: errorResponse
      }
    }
  },
  "/api/public/portfolios/{slug}": {
    get: {
      tags: ["Portfolio"],
      summary: "Get a public portfolio by stable slug",
      parameters: [idParameter("slug")],
      responses: {
        200: { description: "Public-safe portfolio, Experiences, Moments and Evidence" },
        404: errorResponse
      }
    }
  }
};

const applicantFeatureSwaggerPaths = {
  ...portfolioCollectionSwaggerPaths,
  "/api/applicant-profile/me/avatar": {
    patch: {
      tags: ["Applicant Profile"],
      summary: "Upload and replace the authenticated applicant avatar",
      security: bearerSecurity,
      requestBody: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              required: ["avatar"],
              properties: {
                avatar: {
                  type: "string",
                  format: "binary",
                  description: "JPEG, PNG or WebP; maximum 5 MB"
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: "Avatar updated successfully",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApplicantAvatarResponse" }
            }
          }
        },
        400: errorResponse,
        401: errorResponse,
        404: errorResponse,
        413: errorResponse,
        502: errorResponse
      }
    }
  },
  "/api/cvs/{id}/download": {
    get: {
      tags: ["CV"],
      summary: "Download an owned CV with its original filename",
      security: bearerSecurity,
      parameters: [idParameter("id")],
      responses: {
        200: {
          description: "CV binary attachment",
          headers: {
            "Content-Disposition": {
              schema: { type: "string" }
            }
          },
          content: {
            "application/pdf": { schema: { type: "string", format: "binary" } },
            "application/msword": { schema: { type: "string", format: "binary" } },
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
              schema: { type: "string", format: "binary" }
            }
          }
        },
        401: errorResponse,
        403: errorResponse,
        404: errorResponse,
        409: errorResponse,
        502: errorResponse
      }
    }
  },
  "/api/cvs/{id}/preview": {
    get: {
      tags: ["CV"],
      summary: "Render an owned PDF CV inline",
      description: "DOC and DOCX return 415 CV_PREVIEW_UNSUPPORTED.",
      security: bearerSecurity,
      parameters: [idParameter("id")],
      responses: {
        200: {
          description: "PDF binary with Content-Disposition inline",
          content: {
            "application/pdf": { schema: { type: "string", format: "binary" } }
          }
        },
        401: errorResponse,
        403: errorResponse,
        404: errorResponse,
        409: errorResponse,
        415: errorResponse
      }
    }
  },
  "/api/ai/cvs/{cvId}/review": {
    post: {
      tags: ["AI"],
      summary: "Review a CV using the CV_FEEDBACK result type",
      security: bearerSecurity,
      parameters: [idParameter("cvId")],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/AiCareerTargetRequest" }
          }
        }
      },
      responses: {
        200: { description: "CV review result" },
        400: errorResponse,
        401: errorResponse,
        404: errorResponse,
        415: errorResponse,
        502: errorResponse,
        503: errorResponse,
        504: errorResponse
      }
    }
  },
  "/api/ai/cvs/{cvId}/translate-and-score": {
    post: {
      tags: ["AI"],
      summary: "Translate a CV to English and score it as one workflow",
      description: "Synchronous orchestration that persists two AI Result records and preserves partial success.",
      security: bearerSecurity,
      parameters: [idParameter("cvId")],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/AiCareerTargetRequest" }
          }
        }
      },
      responses: {
        200: {
          description: "Completed or failed workflow with per-step status and result ids",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AiWorkflowResponse" }
            }
          }
        },
        400: errorResponse,
        401: errorResponse,
        404: errorResponse
      }
    }
  }
};

const applicantFeatureSwaggerSchemas = {
  PortfolioCollectionItem: {
    type: "object",
    properties: {
      id: { type: "string" },
      title: { type: "string" },
      description: { type: "string" },
      coverImageUrl: { type: "string" },
      visibility: { type: "string", enum: ["PRIVATE", "PUBLIC"] },
      slug: { type: "string" },
      publicUrl: { type: "string" },
      momentCount: { type: "integer" },
      experienceCount: { type: "integer" },
      publishedAt: { type: "string", format: "date-time", nullable: true },
      updatedAt: { type: "string", format: "date-time" }
    }
  },
  PortfolioCollectionResponse: {
    type: "object",
    properties: {
      success: { type: "boolean", example: true },
      message: { type: "string" },
      data: {
        type: "object",
        properties: {
          portfolios: {
            type: "array",
            items: { $ref: "#/components/schemas/PortfolioCollectionItem" }
          }
        }
      }
    }
  },
  ApplicantAvatarResponse: {
    type: "object",
    properties: {
      success: { type: "boolean", example: true },
      message: { type: "string", example: "Avatar updated successfully" },
      data: {
        type: "object",
        properties: {
          applicantProfile: { $ref: "#/components/schemas/ApplicantProfile" }
        }
      }
    }
  },
  AiCareerTargetRequest: {
    type: "object",
    required: ["industrySlug", "targetRole"],
    additionalProperties: false,
    properties: {
      industrySlug: { type: "string", example: "marketing" },
      targetRole: {
        type: "string",
        minLength: 2,
        maxLength: 150,
        example: "Marketing Intern"
      }
    }
  },
  AiWorkflowResponse: {
    type: "object",
    properties: {
      success: { type: "boolean", example: true },
      message: { type: "string" },
      data: {
        type: "object",
        properties: {
          workflow: {
            type: "object",
            properties: {
              id: { type: "string" },
              status: { type: "string", enum: ["COMPLETED", "FAILED"] },
              cvId: { type: "string" },
              industrySlug: { type: "string" },
              targetRole: { type: "string" },
              resultIds: { type: "object" },
              steps: { type: "object" }
            }
          }
        }
      }
    }
  }
};

export {
  applicantFeatureSwaggerPaths,
  applicantFeatureSwaggerSchemas
};
