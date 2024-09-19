// src/swaggerConfig.ts
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';


const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Calendar System API',
    version: '1.0.0',
    description: 'API documentation for Calendar System',
  },
  servers: [
    {
      url: 'http://localhost:8080', // Change to your server URL
      description: 'Development server',
    },
  ],
};

const options = {
    swaggerDefinition,
    apis: ['./src/routes/calendarRoutes.ts', './src/controllers/calendarController.ts', './src/index.ts'], // Path to the API docs
  };
  
//C:\Users\Asus\Desktop\current_pro\cal_sys\src\controllers\calendarController.ts
//C:\Users\Asus\Desktop\current_pro\cal_sys\src\routes\calendarRoutes.ts
const swaggerSpec = swaggerJsdoc(options);

export const setupSwagger = (app: Express) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
};
