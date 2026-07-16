import swaggerJSDoc from "swagger-jsdoc";

import { swaggerComponents, swaggerPaths } from "../docs/swagger.paths";

const port = process.env.PORT || 5000;

const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "CVBuddy Backend API",
      version: "1.0.0",
      description: "API documentation for CVBuddy Backend MVP"
    },
    servers: [
      {
        url: `http://localhost:${port}`,
        description: "Local development server"
      }
    ],
    tags: [
      {
        name: "Health",
        description: "Backend health check"
      },
      {
        name: "Auth",
        description: "Authentication and account APIs"
      },
      {
        name: "Applicant Profile",
        description: "Applicant profile APIs"
      },
      {
        name: "CV",
        description: "CV upload and management APIs"
      },
      {
        name: "Upload",
        description: "Cloudinary-backed file upload APIs"
      },
      {
        name: "AI",
        description: "AI CV feedback, scoring, translation, and result history APIs"
      },
      {
        name: "Portfolio",
        description: "Portfolio and portfolio item APIs"
      },
      {
        name: "Mobile",
        description: "Mobile photo sync APIs"
      }
    ],
    components: swaggerComponents,
    paths: swaggerPaths
  },
  apis: []
});

const swaggerUiOptions = {
  customSiteTitle: "CVBuddy Backend API Docs",
  swaggerOptions: {
    persistAuthorization: true
  }
};

export {
  swaggerSpec,
  swaggerUiOptions
};
