import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Cuvera-core API',
      version: '1.0.0',
      description: 'A simple Express API with MongoDB and TypeScript',
      contact: {
        name: 'API Support',
        email: 'cuvera@example.com',
      },
    },
    servers: [
      {
        url: `${process.env.BASE_URL}/api/v1`,
        description: 'Development server',
      },
    ],
  },
  apis: ['./src/routes/*.ts'], // Path to the API docs
};

const specs = swaggerJsdoc(options);

export const setupSwagger = (app: Express): void => {
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(specs, {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'API Documentation',
    })
  );
};
