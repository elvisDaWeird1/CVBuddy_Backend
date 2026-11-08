import { portfolioSwaggerPaths, portfolioSwaggerSchemas } from "./portfolio.swagger";
import {
  applicantFeatureSwaggerPaths,
  applicantFeatureSwaggerSchemas
} from "./applicantFeatures.swagger";
import { adminSwaggerPaths, adminSwaggerSchemas } from "./admin.swagger";

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
  "/api/auth/google": {
    post: {
      tags: ["Auth"],
      summary: "Authenticate or register an applicant with a Google ID token",
      description: "Verifies the Google ID token signature, issuer, audience (GOOGLE_CLIENT_ID), expiry, and email_verified claim. Returns 201 for a newly created APPLICANT account, 200 for a returning Google-linked account, or 409 GOOGLE_ACCOUNT_LINK_REQUIRED with a short-lived linkToken when the email belongs to an existing unlinked password account.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/GoogleAuthRequest"
            },
            example: {
              idToken: "eyJhbGciOiJSUzI1NiIsImtpZCI6Ij..."
            }
          }
        }
      },
      responses: {
        200: {
          description: "Google login successful",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/GoogleAuthSuccessResponse"
              }
            }
          }
        },
        201: {
          description: "Google account registered successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/GoogleAuthSuccessResponse"
              }
            }
          }
        },
        400: errorResponse,
        401: errorResponse,
        403: errorResponse,
        409: {
          description: "Account link required or Google subject mismatch",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/GoogleAuthLinkRequiredResponse"
              }
            }
          }
        },
        503: errorResponse
      }
    }
  },
  "/api/auth/google/link": {
    post: {
      tags: ["Auth"],
      summary: "Link a Google identity to an existing password account",
      description: "Verifies the Google ID token, the short-lived signed linkToken challenge from POST /api/auth/google, and the account current CVBuddy password before atomically linking googleSubject and adding GOOGLE to authMethods.",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/GoogleLinkRequest"
            },
            example: {
              idToken: "eyJhbGciOiJSUzI1NiIsImtpZCI6Ij...",
              password: "Applicant@123",
              linkToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            }
          }
        }
      },
      responses: {
        200: {
          description: "Google account linked successfully",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/GoogleAuthSuccessResponse"
              }
            }
          }
        },
        400: errorResponse,
        401: errorResponse,
        403: errorResponse,
        404: errorResponse,
        409: errorResponse,
        503: errorResponse
      }
    }
  },
  "/api/auth/logout": {
    post: {
      tags: ["Auth"],
      summary: "Logout current account",
      description: "Revokes the presented bearer token. Reusing it returns 401.",
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
  "/api/uploads/avatar": {
    post: {
      tags: ["Upload"],
      summary: "Upload my avatar and update my applicant profile",
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
                  description: "JPG, JPEG, PNG, or WEBP image file"
                }
              }
            }
          }
        }
      },
      responses: {
        201: {
          description: "Upload successful",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/AvatarUploadResponse"
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
  "/api/uploads/portfolio-photo": {
    post: {
      tags: ["Upload"],
      summary: "Upload a standalone portfolio photo",
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
                  format: "binary",
                  description: "JPG, JPEG, PNG, or WEBP image file"
                }
              }
            }
          }
        }
      },
      responses: {
        201: {
          description: "Upload successful",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/UploadResponse"
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
  "/api/uploads/cv": {
    post: {
      tags: ["Upload"],
      summary: "Upload a standalone CV file",
      security: bearerSecurity,
      requestBody: {
        required: true,
        content: {
          "multipart/form-data": {
            schema: {
              type: "object",
              required: ["file"],
              properties: {
                file: {
                  type: "string",
                  format: "binary",
                  description: "PDF or DOCX CV file; maximum 5 MB"
                }
              }
            }
          }
        }
      },
      responses: {
        201: {
          description: "Upload successful",
          content: {
            "application/json": {
              schema: {
                $ref: "#/components/schemas/UploadResponse"
              }
            }
          }
        },
        400: errorResponse,
        401: errorResponse,
        403: errorResponse,
        413: errorResponse
      }
    }
  },
  "/api/uploads/cv/{id}/download": {
    get: {
      tags: ["Upload"],
      summary: "Download my saved CV with its original filename",
      security: bearerSecurity,
      parameters: [cvIdParameter],
      responses: {
        200: {
          description: "CV file download",
          content: {
            "application/octet-stream": {
              schema: {
                type: "string",
                format: "binary"
              }
            }
          },
          headers: {
            "Content-Disposition": {
              schema: {
                type: "string",
                example: "attachment; filename*=UTF-8''Nguyen%20Van%20A%20CV.docx"
              }
            },
            "Content-Type": {
              schema: {
                type: "string",
                example: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              }
            }
          }
        },
        400: errorResponse,
        401: errorResponse,
        403: errorResponse,
        404: errorResponse,
        502: errorResponse
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
              required: ["file"],
              properties: {
                file: {
                  type: "string",
                  format: "binary",
                  description: "PDF or DOCX CV file; maximum 5 MB"
                },
                title: {
                  type: "string",
                  maxLength: 150,
                  description: "Optional; defaults to the original filename without extension",
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
        404: errorResponse,
        413: errorResponse,
        502: errorResponse
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
        404: errorResponse,
        502: errorResponse,
        503: errorResponse,
        504: errorResponse
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
        404: errorResponse,
        502: errorResponse,
        503: errorResponse,
        504: errorResponse
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
        404: errorResponse,
        502: errorResponse,
        503: errorResponse,
        504: errorResponse
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
      deprecated: true,
      description: "Legacy write. Disabled by default in production; use /api/portfolio/me instead.",
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
        404: errorResponse,
        410: errorResponse
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
      deprecated: true,
      description: "Legacy write. Disabled by default in production; use /api/portfolio instead.",
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
              imageUrl: "https://res.cloudinary.com/demo/image/upload/v1711111111/cvbuddy/portfolio/66a111111111111111111111-1783000000000.jpg",
              imagePublicId: "cvbuddy/portfolio/66a111111111111111111111-1783000000000",
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
        404: errorResponse,
        410: errorResponse
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
      deprecated: true,
      description: "Legacy write. Disabled by default in production; use /api/portfolio instead.",
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
        404: errorResponse,
        410: errorResponse
      }
    },
    delete: {
      tags: ["Portfolio"],
      summary: "Delete my portfolio item",
      deprecated: true,
      description: "Legacy write. Disabled by default in production; use /api/portfolio instead.",
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
        404: errorResponse,
        410: errorResponse
      }
    }
  },
  "/api/mobile/portfolio/photos": {
    post: {
      tags: ["Mobile"],
      summary: "Upload photo from mobile app to portfolio",
      deprecated: true,
      description: "Legacy write. Disabled by default in production; use the canonical Portfolio API instead.",
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
        403: errorResponse,
        410: errorResponse
      }
    }
  },
  "/api/health/ready": {
    get: {
      tags: ["Health"],
      summary: "Check backend readiness",
      responses: {
        200: { description: "Backend is ready" },
        503: { description: "A required dependency or configuration is not ready" }
      }
    }
  },
  ...portfolioSwaggerPaths,
  ...applicantFeatureSwaggerPaths,
  ...adminSwaggerPaths
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
        code: {
          type: "string",
          example: "FILE_TOO_LARGE"
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
              },
              code: {
                type: "string",
                example: "VALIDATION_FAILED"
              }
            }
          }
        }
      }
    },
    UploadResult: {
      type: "object",
      properties: {
        url: {
          type: "string",
          example: "https://res.cloudinary.com/demo/image/upload/v1711111111/cvbuddy/portfolio/66a111111111111111111111-1783000000000.jpg"
        },
        secureUrl: {
          type: "string",
          example: "https://res.cloudinary.com/demo/image/upload/v1711111111/cvbuddy/portfolio/66a111111111111111111111-1783000000000.jpg"
        },
        publicId: {
          type: "string",
          example: "cvbuddy/portfolio/66a111111111111111111111-1783000000000"
        },
        resourceType: {
          type: "string",
          example: "image"
        },
        format: {
          type: "string",
          example: "jpg"
        },
        bytes: {
          type: "number",
          example: 204800
        },
        originalFilename: {
          type: "string",
          example: "photo.jpg"
        },
        originalName: {
          type: "string",
          example: "photo.jpg"
        },
        mimeType: {
          type: "string",
          example: "image/jpeg"
        },
        size: {
          type: "number",
          example: 204800
        }
      }
    },
    UploadResponse: {
      allOf: [
        {
          $ref: "#/components/schemas/SuccessResponse"
        },
        {
          type: "object",
          properties: {
            data: {
              $ref: "#/components/schemas/UploadResult"
            }
          }
        }
      ]
    },
    AvatarUploadResponse: {
      allOf: [
        {
          $ref: "#/components/schemas/SuccessResponse"
        },
        {
          type: "object",
          properties: {
            data: {
              allOf: [
                {
                  $ref: "#/components/schemas/UploadResult"
                },
                {
                  type: "object",
                  properties: {
                    profile: {
                      $ref: "#/components/schemas/ApplicantProfile"
                    }
                  }
                }
              ]
            }
          }
        }
      ]
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
        },
        authMethods: {
          type: "array",
          items: {
            type: "string",
            enum: ["PASSWORD", "GOOGLE"]
          },
          example: ["PASSWORD", "GOOGLE"]
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
          example: "https://res.cloudinary.com/demo/image/upload/v1711111111/cvbuddy/applicant-avatar/66a111111111111111111111-avatar.jpg"
        },
        avatarPublicId: {
          type: "string",
          example: "cvbuddy/applicant-avatar/66a111111111111111111111-avatar"
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
          example: "https://res.cloudinary.com/demo/raw/upload/v1711111111/cvbuddy/cvs/66a111111111111111111111-1783000000000-nguyen-van-a-cv.docx"
        },
        filePublicId: {
          type: "string",
          example: "cvbuddy/cvs/66a111111111111111111111-1783000000000-nguyen-van-a-cv.docx"
        },
        fileResourceType: {
          type: "string",
          example: "raw"
        },
        fileType: {
          type: "string",
          example: "docx"
        },
        fileSize: {
          type: "number",
          example: 512000
        },
        originalName: {
          type: "string",
          example: "Nguyen Van A CV.docx"
        },
        previewAvailable: {
          type: "boolean",
          example: false
        },
        downloadAvailable: {
          type: "boolean",
          example: true
        },
        mimeType: {
          type: "string",
          example: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        },
        size: {
          type: "number",
          example: 512000
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
      description: "Public Node API request. A complete industrySlug, verticalSlug, and targetRole selects the canonical targeted /v1/cv/analyze flow.",
      properties: {
        industrySlug: {
          type: "string",
          example: "ai_software"
        },
        verticalSlug: {
          type: "string",
          example: "machine_learning"
        },
        targetRole: {
          type: "string",
          example: "AI Engineer Intern"
        },
        cvText: {
          type: "string",
          example: "Nguyen Van A\nBackend developer intern\nSkills: Node.js, Express, MongoDB..."
        },
        companyModel: {
          type: "string",
          enum: ["corporate", "startup_agency"],
          example: "corporate"
        },
        language: {
          type: "string",
          enum: ["vi", "en", "both"],
          example: "en"
        },
        jdExtract: {
          type: "object",
          description: "Optional pre-parsed JD data. targetRole remains the authoritative role title.",
          properties: {
            company_name: { type: "string", example: "Example Labs" },
            required_keywords: {
              type: "array",
              items: { type: "string" },
              example: ["Python", "PyTorch"]
            },
            preferred_keywords: {
              type: "array",
              items: { type: "string" },
              example: ["MLOps"]
            },
            responsibilities: {
              type: "array",
              items: { type: "string" },
              example: ["Train and evaluate models"]
            }
          }
        },
        llmModel: {
          type: "string",
          enum: ["qwen/qwen3.8-27b", "openai/gpt-oss-120b"],
          example: "openai/gpt-oss-120b"
        },
        extractionMode: {
          type: "string",
          enum: ["local", "ai", "hybrid"],
          example: "hybrid"
        },
        strictIndustryMatch: {
          type: "boolean",
          default: false
        },
        sourceLang: {
          type: "string",
          example: "vi"
        },
        translationMode: {
          type: "string",
          enum: ["literal", "cv_native"],
          example: "cv_native"
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
          example: "{\"overall_score\":82,\"meta\":{\"source\":\"groq\",\"provider\":\"groq\"}}"
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
        errorCode: {
          type: "string",
          nullable: true,
          example: "AI_SERVICE_TIMEOUT"
        },
        industrySlug: {
          type: "string",
          example: "marketing"
        },
        targetRole: {
          type: "string",
          example: "Marketing Intern"
        },
        workflowId: {
          type: "string",
          nullable: true
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
          example: "https://res.cloudinary.com/demo/image/upload/v1711111111/cvbuddy/portfolio/66a111111111111111111111-1783000000000.jpg"
        },
        imagePublicId: {
          type: "string",
          example: "cvbuddy/portfolio/66a111111111111111111111-1783000000000"
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
        imagePublicId: {
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
        imagePublicId: {
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
    GoogleAuthRequest: {
      type: "object",
      required: ["idToken"],
      properties: {
        idToken: {
          type: "string",
          description: "Google ID token credential returned by Google Identity Services"
        }
      }
    },
    GoogleLinkRequest: {
      type: "object",
      required: ["idToken", "password", "linkToken"],
      properties: {
        idToken: {
          type: "string",
          description: "Google ID token credential returned by Google Identity Services"
        },
        password: {
          type: "string",
          format: "password",
          description: "Current CVBuddy password for the existing account"
        },
        linkToken: {
          type: "string",
          description: "Short-lived signed challenge token returned by POST /api/auth/google"
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
    GoogleAuthSuccessResponse: {
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
                requireLink: {
                  type: "boolean",
                  example: false
                },
                isNewAccount: {
                  type: "boolean",
                  example: true
                },
                needsProfileCompletion: {
                  type: "boolean",
                  example: false
                },
                token: {
                  type: "string",
                  example: "jwt_token_here"
                },
                account: {
                  $ref: "#/components/schemas/Account"
                },
                profile: {
                  nullable: true,
                  type: "object",
                  properties: {
                    id: {
                      type: "string",
                      example: "66a222222222222222222222"
                    },
                    fullName: {
                      type: "string",
                      example: "Nguyen Minh Anh"
                    },
                    avatarUrl: {
                      type: "string",
                      example: "https://lh3.googleusercontent.com/a/avatar"
                    },
                    isComplete: {
                      type: "boolean",
                      example: true
                    }
                  }
                }
              }
            }
          }
        }
      ]
    },
    GoogleAuthLinkRequiredResponse: {
      allOf: [
        {
          $ref: "#/components/schemas/ErrorResponse"
        },
        {
          type: "object",
          properties: {
            code: {
              type: "string",
              example: "GOOGLE_ACCOUNT_LINK_REQUIRED"
            },
            requireLink: {
              type: "boolean",
              example: true
            },
            email: {
              type: "string",
              format: "email",
              example: "applicant@example.com"
            },
            linkToken: {
              type: "string",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
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
    ...portfolioSwaggerSchemas,
    ...applicantFeatureSwaggerSchemas,
    ...adminSwaggerSchemas
  }
};

export {
  swaggerComponents,
  swaggerPaths
};
