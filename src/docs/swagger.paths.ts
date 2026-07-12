import { portfolioSwaggerPaths, portfolioSwaggerSchemas } from "./portfolio.swagger";

const errorResponse = {
  description: "Error response",
  content: {
    "application/json": {
      schema: {
        $ref: "#/components/schemas/ErrorResponse"
      }
    }
  }
};

const bearerSecurity = [
  {
    bearerAuth: []
  }
];

const cvIdParameter = {
  name: "id",
  in: "path",
  required: true,
  description: "CV document id",
  schema: {
    type: "string",
    example: "66a111111111111111111111"
  }
};

const aiCvIdParameter = {
  name: "cvId",
  in: "path",
  required: true,
  description: "CV document id",
  schema: {
    type: "string",
    example: "66a333333333333333333333"
  }
};

const aiResultIdParameter = {
  name: "id",
  in: "path",
  required: true,
  description: "AI result id",
  schema: {
    type: "string",
    example: "66a444444444444444444444"
  }
};

const portfolioIdParameter = {
  name: "portfolioId",
  in: "path",
  required: true,
  description: "Portfolio id",
  schema: {
    type: "string",
    example: "66a555555555555555555555"
  }
};

const portfolioItemIdParameter = {
  name: "id",
  in: "path",
  required: true,
  description: "Portfolio item id",
  schema: {
    type: "string",
    example: "66a666666666666666666666"
  }
};

const swaggerPaths = {
  "/api/health": {
    get: {
      tags: ["Health"],
      summary: "Check backend health",
      responses: {
        200: {
          description: "Backend is running",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/SuccessResponse"
              },
              example: {
                success: true,
                message: "CVBuddy backend is running"
              }
            }
          }
        }
      }
    }
  },
  "/api/auth/register/applicant": {
    post: {
      tags: ["Auth"],
      summary: "Register an applicant account",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/RegisterApplicantRequest"
            },
            example: {
              email: "applicant@example.com",
              password: "Applicant@123",
              fullName: "Nguyen Van A"
            }
          }
        }
      },
      responses: {
        201: {
          description: "Applicant registered successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/RegisterApplicantResponse"
              }
            }
          }
        },
        400: errorResponse,
        409: errorResponse
      }
    }
  },
  "/api/auth/register/company": {
    post: {
      tags: ["Auth"],
      summary: "Register a company account",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/RegisterCompanyRequest"
            },
            example: {
              email: "company@example.com",
              password: "Company@123",
              companyName: "ABC Company"
            }
          }
        }
      },
      responses: {
        201: {
          description: "Company registered successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/RegisterCompanyResponse"
              }
            }
          }
        },
        400: errorResponse,
        409: errorResponse
      }
    }
  },
  "/api/auth/login": {
    post: {
      tags: ["Auth"],
      summary: "Login and receive a JWT token",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/LoginRequest"
            },
            example: {
              email: "applicant@example.com",
              password: "Applicant@123"
            }
          }
        }
      },
      responses: {
        200: {
          description: "Login successful",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/LoginResponse"
              },
              example: {
                success: true,
                message: "Login successful",
                data: {
                  token: "jwt_token_here",
                  account: {
                    id: "66a111111111111111111111",
                    email: "applicant@example.com",
                    role: "APPLICANT",
                    status: "ACTIVE"
                  }
                }
              }
            }
          }
        },
        400: errorResponse,
        401: errorResponse,
        403: errorResponse
      }
    }
  },
  "/api/auth/logout": {
    post: {
      tags: ["Auth"],
      summary: "Logout current account",
      security: bearerSecurity,
      responses: {
        200: {
          description: "Logout successful",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/SuccessResponse"
              },
              example: {
                success: true,
                message: "Logout successful"
              }
            }
          }
        },
        401: errorResponse
      }
    }
  },
  "/api/auth/me": {
    get: {
      tags: ["Auth"],
      summary: "Get current authenticated account",
      security: bearerSecurity,
      responses: {
        200: {
          description: "Current account fetched successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CurrentAccountResponse"
              }
            }
          }
        },
        401: errorResponse
      }
    }
  },
  "/api/auth/change-password": {
    patch: {
      tags: ["Auth"],
      summary: "Change current account password",
      security: bearerSecurity,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/ChangePasswordRequest"
            },
            example: {
              currentPassword: "Applicant@123",
              newPassword: "NewPassword@123"
            }
          }
        }
      },
      responses: {
        200: {
          description: "Password changed successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/SuccessResponse"
              },
              example: {
                success: true,
                message: "Password changed successfully"
              }
            }
          }
        },
        400: errorResponse,
        401: errorResponse,
        403: errorResponse
      }
    }
  },
  "/api/applicant-profile/me": {
    get: {
      tags: ["Applicant Profile"],
      summary: "Get my applicant profile",
      security: bearerSecurity,
      responses: {
        200: {
          description: "Applicant profile fetched successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ApplicantProfileResponse"
              }
            }
          }
        },
        401: errorResponse,
        403: errorResponse,
        404: errorResponse
      }
    },
    patch: {
      tags: ["Applicant Profile"],
      summary: "Update my applicant profile",
      security: bearerSecurity,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/UpdateApplicantProfileRequest"
            },
            example: {
              phone: "0900000000",
              university: "FPT University",
              major: "Software Engineering",
              location: "Can Tho",
              headline: "Junior Backend Developer",
              summary: "I am looking for internship opportunities.",
              careerGoal: "Become a backend developer.",
              avatarUrl: "https://example.com/avatar.jpg"
            }
          }
        }
      },
      responses: {
        200: {
          description: "Applicant profile updated successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/ApplicantProfileResponse"
              }
            }
          }
        },
        400: errorResponse,
        401: errorResponse,
        403: errorResponse,
        404: errorResponse
      }
    }
  },
  "/api/cvs": {
    post: {
      tags: ["CV"],
      summary: "Upload a CV file",
      security: bearerSecurity,
      requestBody: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              required: ["file", "title"],
              properties: {
                file: {
                  type: "string",
                  format: "binary",
                  description: "PDF or DOCX CV file"
                },
                title: {
                  type: "string",
                  example: "My Backend Developer CV"
                },
                language: {
                  type: "string",
                  enum: ["VI", "EN"],
                  example: "VI"
                }
              }
            }
          }
        }
      },
      responses: {
        201: {
          description: "CV uploaded successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CvResponse"
              }
            }
          }
        },
        400: errorResponse,
        401: errorResponse,
        403: errorResponse,
        404: errorResponse
      }
    },
    get: {
      tags: ["CV"],
      summary: "Get my CV list",
      security: bearerSecurity,
      responses: {
        200: {
          description: "CV list fetched successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CvListResponse"
              }
            }
          }
        },
        401: errorResponse,
        403: errorResponse,
        404: errorResponse
      }
    }
  },
  "/api/cvs/{id}": {
    get: {
      tags: ["CV"],
      summary: "Get my CV detail",
      security: bearerSecurity,
      parameters: [cvIdParameter],
      responses: {
        200: {
          description: "CV fetched successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/CvResponse"
              }
            }
          }
        },
        400: errorResponse,
        401: errorResponse,
        403: errorResponse,
        404: errorResponse
      }
    },
    delete: {
      tags: ["CV"],
      summary: "Soft delete my CV",
      security: bearerSecurity,
      parameters: [cvIdParameter],
      responses: {
        200: {
          description: "CV deleted successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/SuccessResponse"
              },
              example: {
                success: true,
                message: "CV deleted successfully"
              }
            }
          }
        },
        400: errorResponse,
        401: errorResponse,
        403: errorResponse,
        404: errorResponse
      }
    }
  },
  "/api/ai/cvs/{cvId}/feedback": {
    post: {
      tags: ["AI"],
      summary: "Generate AI feedback for my CV",
      security: bearerSecurity,
      parameters: [aiCvIdParameter],
      requestBody: {
        required: false,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/AiCvRequest"
            }
          }
        }
      },
      responses: {
        200: {
          description: "AI feedback generated successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/AiResultResponse"
              }
            }
          }
        },
        400: errorResponse,
        401: errorResponse,
        403: errorResponse,
        404: errorResponse
      }
    }
  },
  "/api/ai/cvs/{cvId}/score": {
    post: {
      tags: ["AI"],
      summary: "Score my CV with AI",
      security: bearerSecurity,
      parameters: [aiCvIdParameter],
      requestBody: {
        required: false,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/AiCvRequest"
            }
          }
        }
      },
      responses: {
        200: {
          description: "CV score generated successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/AiResultResponse"
              }
            }
          }
        },
        400: errorResponse,
        401: errorResponse,
        403: errorResponse,
        404: errorResponse
      }
    }
  },
  "/api/ai/cvs/{cvId}/translate-to-english": {
    post: {
      tags: ["AI"],
      summary: "Translate my CV to English",
      security: bearerSecurity,
      parameters: [aiCvIdParameter],
      requestBody: {
        required: false,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/AiCvRequest"
            }
          }
        }
      },
      responses: {
        200: {
          description: "CV translated to English successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/AiResultResponse"
              }
            }
          }
        },
        400: errorResponse,
        401: errorResponse,
        403: errorResponse,
        404: errorResponse
      }
    }
  },
  "/api/ai/results": {
    get: {
      tags: ["AI"],
      summary: "Get my AI result history",
      security: bearerSecurity,
      parameters: [
        {
          name: "aiType",
          in: "query",
          required: false,
          schema: {
            type: "string",
            enum: ["CV_FEEDBACK", "CV_TRANSLATION", "CV_SCORING", "JOB_RECOMMENDATION"]
          }
        },
        {
          name: "status",
          in: "query",
          required: false,
          schema: {
            type: "string",
            enum: ["PENDING", "COMPLETED", "FAILED"]
          }
        }
      ],
      responses: {
        200: {
          description: "AI results fetched successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/AiResultListResponse"
              }
            }
          }
        },
        400: errorResponse,
        401: errorResponse,
        403: errorResponse
      }
    }
  },
  "/api/ai/results/{id}": {
    get: {
      tags: ["AI"],
      summary: "Get my AI result detail",
      security: bearerSecurity,
      parameters: [aiResultIdParameter],
      responses: {
        200: {
          description: "AI result fetched successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/AiResultResponse"
              }
            }
          }
        },
        400: errorResponse,
        401: errorResponse,
        403: errorResponse,
        404: errorResponse
      }
    }
  },
  "/api/portfolios": {
    post: {
      tags: ["Portfolio"],
      summary: "Create my portfolio",
      security: bearerSecurity,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/CreatePortfolioRequest"
            },
            example: {
              title: "Nguyen Van A Portfolio",
              introduction: "A portfolio showing my projects and learning activities.",
              visibility: "PRIVATE",
              coverImageUrl: "https://example.com/cover.jpg"
            }
          }
        }
      },
      responses: {
        201: {
          description: "Portfolio created successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/PortfolioResponse"
              }
            }
          }
        },
        400: errorResponse,
        401: errorResponse,
        403: errorResponse,
        409: errorResponse
      }
    }
  },
  "/api/portfolios/me": {
    get: {
      tags: ["Portfolio"],
      summary: "Get my portfolio",
      security: bearerSecurity,
      responses: {
        200: {
          description: "Portfolio fetched successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/PortfolioResponse"
              }
            }
          }
        },
        401: errorResponse,
        403: errorResponse,
        404: errorResponse
      }
    },
    patch: {
      tags: ["Portfolio"],
      summary: "Update my portfolio",
      security: bearerSecurity,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/UpdatePortfolioRequest"
            },
            example: {
              title: "Updated Portfolio",
              introduction: "Updated introduction",
              visibility: "PUBLIC",
              coverImageUrl: "https://example.com/new-cover.jpg"
            }
          }
        }
      },
      responses: {
        200: {
          description: "Portfolio updated successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/PortfolioResponse"
              }
            }
          }
        },
        400: errorResponse,
        401: errorResponse,
        403: errorResponse,
        404: errorResponse
      }
    }
  },
  "/api/portfolios/public/{portfolioId}": {
    get: {
      tags: ["Portfolio"],
      summary: "Get public portfolio",
      parameters: [portfolioIdParameter],
      responses: {
        200: {
          description: "Public portfolio fetched successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/PublicPortfolioResponse"
              }
            }
          }
        },
        400: errorResponse,
        404: errorResponse
      }
    }
  },
  "/api/portfolio-items": {
    post: {
      tags: ["Portfolio"],
      summary: "Create portfolio item",
      security: bearerSecurity,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/CreatePortfolioItemRequest"
            },
            example: {
              title: "Career Workshop",
              description: "I joined a career orientation workshop.",
              imageUrl: "https://example.com/photo.jpg",
              eventName: "Career Workshop 2026",
              eventRole: "Participant",
              eventDate: "2026-06-20",
              location: "Can Tho",
              visibility: "PUBLIC"
            }
          }
        }
      },
      responses: {
        201: {
          description: "Portfolio item created successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/PortfolioItemResponse"
              }
            }
          }
        },
        400: errorResponse,
        401: errorResponse,
        403: errorResponse,
        404: errorResponse
      }
    }
  },
  "/api/portfolio-items/me": {
    get: {
      tags: ["Portfolio"],
      summary: "Get my portfolio items",
      security: bearerSecurity,
      responses: {
        200: {
          description: "Portfolio items fetched successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/PortfolioItemListResponse"
              }
            }
          }
        },
        401: errorResponse,
        403: errorResponse,
        404: errorResponse
      }
    }
  },
  "/api/portfolio-items/{id}": {
    get: {
      tags: ["Portfolio"],
      summary: "Get my portfolio item detail",
      security: bearerSecurity,
      parameters: [portfolioItemIdParameter],
      responses: {
        200: {
          description: "Portfolio item fetched successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/PortfolioItemResponse"
              }
            }
          }
        },
        400: errorResponse,
        401: errorResponse,
        403: errorResponse,
        404: errorResponse
      }
    },
    patch: {
      tags: ["Portfolio"],
      summary: "Update my portfolio item",
      security: bearerSecurity,
      parameters: [portfolioItemIdParameter],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/UpdatePortfolioItemRequest"
            },
            example: {
              title: "Updated title",
              description: "Updated description",
              eventName: "Updated event",
              eventRole: "Organizer",
              eventDate: "2026-06-21",
              location: "Ho Chi Minh City",
              visibility: "PRIVATE"
            }
          }
        }
      },
      responses: {
        200: {
          description: "Portfolio item updated successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/PortfolioItemResponse"
              }
            }
          }
        },
        400: errorResponse,
        401: errorResponse,
        403: errorResponse,
        404: errorResponse
      }
    },
    delete: {
      tags: ["Portfolio"],
      summary: "Delete my portfolio item",
      security: bearerSecurity,
      parameters: [portfolioItemIdParameter],
      responses: {
        200: {
          description: "Portfolio item deleted successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/SuccessResponse"
              },
              example: {
                success: true,
                message: "Portfolio item deleted successfully"
              }
            }
          }
        },
        400: errorResponse,
        401: errorResponse,
        403: errorResponse,
        404: errorResponse
      }
    }
  },
  "/api/mobile/portfolio/photos": {
    post: {
      tags: ["Mobile"],
      summary: "Upload photo from mobile app to portfolio",
      security: bearerSecurity,
      requestBody: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              required: ["image"],
              properties: {
                image: {
                  type: "string",
                  format: "binary"
                },
                title: {
                  type: "string"
                },
                description: {
                  type: "string"
                },
                eventName: {
                  type: "string"
                },
                eventRole: {
                  type: "string"
                },
                eventDate: {
                  type: "string",
                  format: "date"
                },
                location: {
                  type: "string"
                },
                visibility: {
                  type: "string",
                  enum: ["PRIVATE", "PUBLIC"]
                }
              }
            }
          }
        }
      },
      responses: {
        201: {
          description: "Photo uploaded to portfolio successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/PortfolioItemResponse"
              }
            }
          }
        },
        400: errorResponse,
        401: errorResponse,
        403: errorResponse
      }
    }
  },
  ...portfolioSwaggerPaths
};

const swaggerComponents = {
  securitySchemes: {
    bearerAuth: {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT"
    }
  },
  schemas: {
    SuccessResponse: {
      type: "object",
      properties: {
        success: {
          type: "boolean",
          example: true
        },
        message: {
          type: "string",
          example: "Action completed successfully"
        },
        data: {
          type: "object"
        }
      }
    },
    ErrorResponse: {
      type: "object",
      properties: {
        success: {
          type: "boolean",
          example: false
        },
        message: {
          type: "string",
          example: "Validation failed"
        },
        errors: {
          type: "array",
          items: {
            type: "object",
            properties: {
              field: {
                type: "string",
                example: "email"
              },
              message: {
                type: "string",
                example: "Email is required"
              }
            }
          }
        }
      }
    },
    Account: {
      type: "object",
      properties: {
        id: {
          type: "string",
          example: "66a111111111111111111111"
        },
        email: {
          type: "string",
          format: "email",
          example: "applicant@example.com"
        },
        role: {
          type: "string",
          enum: ["APPLICANT", "COMPANY", "ADMIN"],
          example: "APPLICANT"
        },
        status: {
          type: "string",
          enum: ["ACTIVE", "INACTIVE", "SUSPENDED"],
          example: "ACTIVE"
        }
      }
    },
    ApplicantProfile: {
      type: "object",
      properties: {
        id: {
          type: "string",
          example: "66a222222222222222222222"
        },
        accountId: {
          type: "string",
          example: "66a111111111111111111111"
        },
        fullName: {
          type: "string",
          example: "Nguyen Van A"
        },
        phone: {
          type: "string",
          example: "0900000000"
        },
        university: {
          type: "string",
          example: "FPT University"
        },
        major: {
          type: "string",
          example: "Software Engineering"
        },
        location: {
          type: "string",
          example: "Can Tho"
        },
        headline: {
          type: "string",
          example: "Junior Backend Developer"
        },
        summary: {
          type: "string",
          example: "I am looking for internship opportunities."
        },
        careerGoal: {
          type: "string",
          example: "Become a backend developer."
        },
        avatarUrl: {
          type: "string",
          example: "https://example.com/avatar.jpg"
        }
      }
    },
    Cv: {
      type: "object",
      properties: {
        id: {
          type: "string",
          example: "66a333333333333333333333"
        },
        applicantProfileId: {
          type: "string",
          example: "66a222222222222222222222"
        },
        title: {
          type: "string",
          example: "My Backend Developer CV"
        },
        fileUrl: {
          type: "string",
          example: "/uploads/cvs/my-backend-developer-cv-1711111111111.pdf"
        },
        fileType: {
          type: "string",
          example: "pdf"
        },
        fileSize: {
          type: "number",
          example: 204800
        },
        language: {
          type: "string",
          enum: ["VI", "EN"],
          example: "VI"
        },
        status: {
          type: "string",
          enum: ["ACTIVE", "DELETED"],
          example: "ACTIVE"
        },
        extractedText: {
          type: "string",
          example: "Extracted CV text..."
        },
        uploadedAt: {
          type: "string",
          format: "date-time"
        },
        createdAt: {
          type: "string",
          format: "date-time"
        },
        updatedAt: {
          type: "string",
          format: "date-time"
        }
      }
    },
    AiCvRequest: {
      type: "object",
      properties: {
        targetRole: {
          type: "string",
          example: "Backend Developer"
        },
        cvText: {
          type: "string",
          example: "Nguyen Van A\nBackend developer intern\nSkills: Node.js, Express, MongoDB..."
        }
      }
    },
    AiResult: {
      type: "object",
      properties: {
        id: {
          type: "string",
          example: "66a444444444444444444444"
        },
        accountId: {
          type: "string",
          example: "66a111111111111111111111"
        },
        cvDocumentId: {
          type: "string",
          example: "66a333333333333333333333"
        },
        relatedJobId: {
          type: "string",
          nullable: true,
          example: null
        },
        aiType: {
          type: "string",
          enum: ["CV_FEEDBACK", "CV_TRANSLATION", "CV_SCORING", "JOB_RECOMMENDATION"],
          example: "CV_FEEDBACK"
        },
        status: {
          type: "string",
          enum: ["PENDING", "COMPLETED", "FAILED"],
          example: "COMPLETED"
        },
        inputText: {
          type: "string",
          example: "CV text used for AI processing..."
        },
        resultText: {
          type: "string",
          example: "{\"summary\":\"Mock CV feedback\",\"strengths\":[\"Clear technical skills\"]}"
        },
        result: {
          description: "Parsed structured result for detail/action responses; resultText remains for backward compatibility",
          nullable: true,
          oneOf: [
            { type: "object" },
            { type: "string" }
          ]
        },
        score: {
          type: "number",
          nullable: true,
          example: 78
        },
        errorMessage: {
          type: "string",
          nullable: true,
          example: null
        },
        createdAt: {
          type: "string",
          format: "date-time"
        },
        completedAt: {
          type: "string",
          format: "date-time",
          nullable: true
        }
      }
    },
    Portfolio: {
      type: "object",
      properties: {
        id: {
          type: "string",
          example: "66a555555555555555555555"
        },
        applicantProfileId: {
          type: "string",
          example: "66a222222222222222222222"
        },
        title: {
          type: "string",
          example: "Nguyen Van A Portfolio"
        },
        introduction: {
          type: "string",
          example: "A portfolio showing my projects and learning activities."
        },
        visibility: {
          type: "string",
          enum: ["PRIVATE", "PUBLIC"],
          example: "PUBLIC"
        },
        coverImageUrl: {
          type: "string",
          example: "https://example.com/cover.jpg"
        },
        createdAt: {
          type: "string",
          format: "date-time"
        },
        updatedAt: {
          type: "string",
          format: "date-time"
        }
      }
    },
    PortfolioItem: {
      type: "object",
      properties: {
        id: {
          type: "string",
          example: "66a666666666666666666666"
        },
        portfolioId: {
          type: "string",
          example: "66a555555555555555555555"
        },
        title: {
          type: "string",
          example: "Career Workshop"
        },
        description: {
          type: "string",
          example: "I joined a career orientation workshop."
        },
        imageUrl: {
          type: "string",
          example: "/uploads/portfolio/career-workshop-1711111111111.jpg"
        },
        eventName: {
          type: "string",
          example: "Career Workshop 2026"
        },
        eventRole: {
          type: "string",
          example: "Participant"
        },
        eventDate: {
          type: "string",
          format: "date-time"
        },
        location: {
          type: "string",
          example: "Can Tho"
        },
        visibility: {
          type: "string",
          enum: ["PRIVATE", "PUBLIC"],
          example: "PUBLIC"
        },
        createdFromMobile: {
          type: "boolean",
          example: true
        },
        createdAt: {
          type: "string",
          format: "date-time"
        },
        updatedAt: {
          type: "string",
          format: "date-time"
        }
      }
    },
    CreatePortfolioRequest: {
      type: "object",
      required: ["title"],
      properties: {
        title: {
          type: "string"
        },
        introduction: {
          type: "string"
        },
        visibility: {
          type: "string",
          enum: ["PRIVATE", "PUBLIC"]
        },
        coverImageUrl: {
          type: "string"
        }
      }
    },
    UpdatePortfolioRequest: {
      type: "object",
      properties: {
        title: {
          type: "string"
        },
        introduction: {
          type: "string"
        },
        visibility: {
          type: "string",
          enum: ["PRIVATE", "PUBLIC"]
        },
        coverImageUrl: {
          type: "string"
        }
      }
    },
    CreatePortfolioItemRequest: {
      type: "object",
      required: ["title"],
      properties: {
        title: {
          type: "string"
        },
        description: {
          type: "string"
        },
        imageUrl: {
          type: "string"
        },
        eventName: {
          type: "string"
        },
        eventRole: {
          type: "string"
        },
        eventDate: {
          type: "string",
          format: "date"
        },
        location: {
          type: "string"
        },
        visibility: {
          type: "string",
          enum: ["PRIVATE", "PUBLIC"]
        }
      }
    },
    UpdatePortfolioItemRequest: {
      type: "object",
      properties: {
        title: {
          type: "string"
        },
        description: {
          type: "string"
        },
        imageUrl: {
          type: "string"
        },
        eventName: {
          type: "string"
        },
        eventRole: {
          type: "string"
        },
        eventDate: {
          type: "string",
          format: "date"
        },
        location: {
          type: "string"
        },
        visibility: {
          type: "string",
          enum: ["PRIVATE", "PUBLIC"]
        }
      }
    },
    RegisterApplicantRequest: {
      type: "object",
      required: ["email", "password", "fullName"],
      properties: {
        email: {
          type: "string",
          format: "email"
        },
        password: {
          type: "string",
          format: "password"
        },
        fullName: {
          type: "string"
        }
      }
    },
    RegisterCompanyRequest: {
      type: "object",
      required: ["email", "password", "companyName"],
      properties: {
        email: {
          type: "string",
          format: "email"
        },
        password: {
          type: "string",
          format: "password"
        },
        companyName: {
          type: "string"
        }
      }
    },
    LoginRequest: {
      type: "object",
      required: ["email", "password"],
      properties: {
        email: {
          type: "string",
          format: "email"
        },
        password: {
          type: "string",
          format: "password"
        }
      }
    },
    ChangePasswordRequest: {
      type: "object",
      required: ["currentPassword", "newPassword"],
      properties: {
        currentPassword: {
          type: "string",
          format: "password"
        },
        newPassword: {
          type: "string",
          format: "password"
        }
      }
    },
    UpdateApplicantProfileRequest: {
      type: "object",
      properties: {
        fullName: {
          type: "string"
        },
        phone: {
          type: "string"
        },
        university: {
          type: "string"
        },
        major: {
          type: "string"
        },
        location: {
          type: "string"
        },
        headline: {
          type: "string"
        },
        summary: {
          type: "string"
        },
        careerGoal: {
          type: "string"
        },
        avatarUrl: {
          type: "string"
        }
      }
    },
    RegisterApplicantResponse: {
      allOf: [
        {
          $ref: "#/components/schemas/SuccessResponse"
        },
        {
          type: "object",
          properties: {
            data: {
              type: "object",
              properties: {
                account: {
                  $ref: "#/components/schemas/Account"
                },
                profile: {
                  type: "object",
                  properties: {
                    id: {
                      type: "string",
                      example: "66a222222222222222222222"
                    },
                    fullName: {
                      type: "string",
                      example: "Nguyen Van A"
                    }
                  }
                }
              }
            }
          }
        }
      ]
    },
    RegisterCompanyResponse: {
      allOf: [
        {
          $ref: "#/components/schemas/SuccessResponse"
        },
        {
          type: "object",
          properties: {
            data: {
              type: "object",
              properties: {
                account: {
                  $ref: "#/components/schemas/Account"
                },
                profile: {
                  type: "object",
                  properties: {
                    id: {
                      type: "string",
                      example: "66a444444444444444444444"
                    },
                    companyName: {
                      type: "string",
                      example: "ABC Company"
                    }
                  }
                }
              }
            }
          }
        }
      ]
    },
    LoginResponse: {
      allOf: [
        {
          $ref: "#/components/schemas/SuccessResponse"
        },
        {
          type: "object",
          properties: {
            data: {
              type: "object",
              properties: {
                token: {
                  type: "string",
                  example: "jwt_token_here"
                },
                account: {
                  $ref: "#/components/schemas/Account"
                }
              }
            }
          }
        }
      ]
    },
    CurrentAccountResponse: {
      allOf: [
        {
          $ref: "#/components/schemas/SuccessResponse"
        },
        {
          type: "object",
          properties: {
            data: {
              type: "object",
              properties: {
                account: {
                  $ref: "#/components/schemas/Account"
                },
                profile: {
                  nullable: true,
                  oneOf: [
                    {
                      type: "object"
                    },
                    {
                      $ref: "#/components/schemas/ApplicantProfile"
                    }
                  ]
                }
              }
            }
          }
        }
      ]
    },
    ApplicantProfileResponse: {
      allOf: [
        {
          $ref: "#/components/schemas/SuccessResponse"
        },
        {
          type: "object",
          properties: {
            data: {
              type: "object",
              properties: {
                profile: {
                  $ref: "#/components/schemas/ApplicantProfile"
                }
              }
            }
          }
        }
      ]
    },
    CvResponse: {
      allOf: [
        {
          $ref: "#/components/schemas/SuccessResponse"
        },
        {
          type: "object",
          properties: {
            data: {
              type: "object",
              properties: {
                cv: {
                  $ref: "#/components/schemas/Cv"
                }
              }
            }
          }
        }
      ]
    },
    CvListResponse: {
      allOf: [
        {
          $ref: "#/components/schemas/SuccessResponse"
        },
        {
          type: "object",
          properties: {
            data: {
              type: "object",
              properties: {
                cvs: {
                  type: "array",
                  items: {
                    $ref: "#/components/schemas/Cv"
                  }
                }
              }
            }
          }
        }
      ]
    },
    AiResultResponse: {
      allOf: [
        {
          $ref: "#/components/schemas/SuccessResponse"
        },
        {
          type: "object",
          properties: {
            data: {
              type: "object",
              properties: {
                aiResult: {
                  $ref: "#/components/schemas/AiResult"
                }
              }
            }
          }
        }
      ]
    },
    AiResultListResponse: {
      allOf: [
        {
          $ref: "#/components/schemas/SuccessResponse"
        },
        {
          type: "object",
          properties: {
            data: {
              type: "object",
              properties: {
                aiResults: {
                  type: "array",
                  items: {
                    $ref: "#/components/schemas/AiResult"
                  }
                }
              }
            }
          }
        }
      ]
    },
    PortfolioResponse: {
      allOf: [
        {
          $ref: "#/components/schemas/SuccessResponse"
        },
        {
          type: "object",
          properties: {
            data: {
              type: "object",
              properties: {
                portfolio: {
                  oneOf: [
                    {
                      type: "object"
                    },
                    {
                      $ref: "#/components/schemas/Portfolio"
                    }
                  ]
                }
              }
            }
          }
        }
      ]
    },
    PublicPortfolioResponse: {
      allOf: [
        {
          $ref: "#/components/schemas/SuccessResponse"
        },
        {
          type: "object",
          properties: {
            data: {
              type: "object",
              properties: {
                portfolio: {
                  $ref: "#/components/schemas/Portfolio"
                },
                items: {
                  type: "array",
                  items: {
                    $ref: "#/components/schemas/PortfolioItem"
                  }
                }
              }
            }
          }
        }
      ]
    },
    PortfolioItemResponse: {
      allOf: [
        {
          $ref: "#/components/schemas/SuccessResponse"
        },
        {
          type: "object",
          properties: {
            data: {
              type: "object",
              properties: {
                portfolioItem: {
                  $ref: "#/components/schemas/PortfolioItem"
                }
              }
            }
          }
        }
      ]
    },
    PortfolioItemListResponse: {
      allOf: [
        {
          $ref: "#/components/schemas/SuccessResponse"
        },
        {
          type: "object",
          properties: {
            data: {
              type: "object",
              properties: {
                portfolioItems: {
                  type: "array",
                  items: {
                    $ref: "#/components/schemas/PortfolioItem"
                  }
                }
              }
            }
          }
        }
      ]
    },
    ...portfolioSwaggerSchemas
  }
};

export {
  swaggerComponents,
  swaggerPaths
};
