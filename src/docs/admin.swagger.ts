const bearerSecurity = [{ bearerAuth: [] }];
const errorResponse = {
  description: "Authentication or authorization error",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/ErrorResponse" }
    }
  }
};

const adminSwaggerPaths = {
  "/api/admin/metrics/overview": {
    get: {
      tags: ["Admin"],
      summary: "Get aggregate user metrics",
      description: "Admin-only counts for Applicant and Company accounts. Admin accounts are excluded.",
      security: bearerSecurity,
      responses: {
        200: {
          description: "Read-only user metrics overview",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/AdminMetricsOverviewResponse" }
            }
          }
        },
        401: errorResponse,
        403: errorResponse
      }
    }
  }
};

const adminSwaggerSchemas = {
  AdminMetricsOverview: {
    type: "object",
    required: [
      "totalUsers",
      "applicants",
      "companies",
      "activeUsers",
      "newUsersLast7Days",
      "generatedAt"
    ],
    additionalProperties: false,
    properties: {
      totalUsers: { type: "integer", minimum: 0, example: 125 },
      applicants: { type: "integer", minimum: 0, example: 100 },
      companies: { type: "integer", minimum: 0, example: 25 },
      activeUsers: { type: "integer", minimum: 0, example: 118 },
      newUsersLast7Days: { type: "integer", minimum: 0, example: 14 },
      generatedAt: { type: "string", format: "date-time" }
    }
  },
  AdminMetricsOverviewResponse: {
    allOf: [
      { $ref: "#/components/schemas/SuccessResponse" },
      {
        type: "object",
        properties: {
          data: { $ref: "#/components/schemas/AdminMetricsOverview" }
        }
      }
    ]
  }
};

export {
  adminSwaggerPaths,
  adminSwaggerSchemas
};
