import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import connectDB from './config/database';
import teamsRoutes from './routes/teamsRoutes';
import googleCalendarRoutes from './routes/googleCalendarRoutes';
import { globalErrorHandler } from './middlewares/errorHandler';
import { setupSwagger } from './config/swagger';
import { AppError } from './utils/appError';
import { schedulerService } from './services/schedulerService';
import { extractUserPrincipal, initializeConfig } from '@cuvera/commons';
import { producer } from './messaging/producer';
import { emailConfig } from './config/emailConfig';
import { EmailService } from './services/emailService';

// Initialize environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['EMAIL_USER', 'EMAIL_PASSWORD', 'SERVICE_NAME'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize services
let emailService: EmailService;
let server: ReturnType<typeof app.listen>;

async function initializeApp() {
  try {
    // 1. Connect to database
    await connectDB();

    // 2. Initialize email service
    emailService = new EmailService(emailConfig);
    await emailService.connect();
    await emailService.startMonitoring();

    // 3. Initialize other services
    initializeConfig({
      serviceName: process.env.SERVICE_NAME!,
    });
    await producer.initialize();

    // 4. Start scheduler
    schedulerService.start();

    // 5. Start the server
    server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`API Documentation available at http://localhost:${PORT}/api-docs`);
      console.log(`Health check available at http://localhost:${PORT}/cuvera-core-service/health`);
    });

  } catch (error) {
    console.error('Failed to initialize application:', error);
    await shutdown(1);
  }
}

// Middleware
app.use(cors());
app.use('/logos', express.static('public/logos'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(extractUserPrincipal());

// API routes
app.use('/api/v1/teams', teamsRoutes);
app.use('/api/v1/google-calendar', googleCalendarRoutes);

// Setup Swagger
setupSwagger(app);

// Health check endpoint
const baseRouter = express.Router();
baseRouter.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running!',
    timestamp: new Date().toISOString(),
  });
});
app.use('/cuvera-core-service', baseRouter);

// 404 handler
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Error handling middleware
app.use(globalErrorHandler);

// Graceful shutdown
async function shutdown(code = 0) {
  try {
    console.log('Shutting down gracefully...');

    if (emailService) {
      await emailService.disconnect().catch(console.error);
    }

    // if (schedulerService) {
    //   await schedulerService.stop().catch(console.error);
    // }

    if (producer) {
      await producer.close().catch(console.error);
    }

    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => {
          console.log('Server closed');
          resolve();
        });
      });
    }

    console.log('Shutdown complete');
    process.exit(code);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Handle process events
process.on('unhandledRejection', (reason: Error) => {
  console.error('UNHANDLED REJECTION! Shutting down...');
  console.error(reason);
  void shutdown(1);
});

process.on('uncaughtException', (error: Error) => {
  console.error('UNCAUGHT EXCEPTION! Shutting down...');
  console.error(error);
  void shutdown(1);
});

process.on('SIGTERM', () => void shutdown(0));
process.on('SIGINT', () => void shutdown(0));

// Start the application
initializeApp().catch((error) => {
  console.error('Fatal error during initialization:', error);
  process.exit(1);
});

export default app;