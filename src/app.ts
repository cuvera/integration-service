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


dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

(async () => {
  await connectDB();
  // Initialize service-specific configuration via config service
  initializeConfig({
    serviceName: process.env.SERVICE_NAME,
  });

  await producer.initialize();

})();

app.use(cors());
app.use('/logos', express.static('public/logos'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(extractUserPrincipal());

// if (process.env.NODE_ENV === 'development') {
//   app.use((req, _res, next) => {
//     req.user = {
//       userId: '68c7b828f3f92a7f537b536d',
//       tenantId: '689ddc0411e4209395942bee',
//     };
//     next();
//   });
// } else {
//   app.use(extractUserPrincipal());
// }

// API routes
app.use('/api/v1/teams', teamsRoutes);
app.use('/api/v1/google-calendar', googleCalendarRoutes);

setupSwagger(app);

const baseRouter = express.Router();

baseRouter.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running!',
    timestamp: new Date().toISOString(),
  });
});




app.use('/cuvera-core-service', baseRouter);

app.all('*', (req, _res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

process.on('unhandledRejection', async (err: Error) => {
  console.error('UNHANDLED REJECTION! Shutting down...');
  console.error(err.name, err);
  try {
    await producer.close();
  } catch (error) {
    console.error('Error closing RabbitMQ connection:', error);
  }
  server.close(() => {
    process.exit(1);
  });
});

app.use(globalErrorHandler);

const server = app.listen(PORT, async () => {
  try {
    await producer.initialize();
    schedulerService.start();
    console.log(` Server running on port ${PORT}`);
    console.log(` API Documentation available at http://localhost:${PORT}/api-docs`);
    console.log(` Health check available at http://localhost:${PORT}/cuvera-core-service/health`);

  } catch (error) {
    console.error('Failed to initialize services:', error);
    await shutdown(1);
  }
});

async function shutdown(code = 0) {
  try {
  } catch (e) {
    console.error('Error stopping scheduler:', e);
  }

  return new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
      process.exit(code);
    });
  });
}


process.on('unhandledRejection', (err: any) => {
  console.error('UNHANDLED REJECTION! Shutting down...', err);
});

process.on('uncaughtException', (err: any) => {
  console.error('UNCAUGHT EXCEPTION! Shutting down...', err);
});

process.on('SIGINT', () => { void shutdown(0); });
process.on('SIGTERM', () => { void shutdown(0); });

export default app;
