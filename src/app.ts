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
import { extractUserPrincipal } from '@cuvera/commons';
import { 
  createProducer 
} from '@cuvera/commons';
// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Start the scheduler
if (process.env.NODE_ENV !== 'test') {
  schedulerService.start();
}

// Security middleware
app.use(helmet());
app.use(cors());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(extractUserPrincipal());


// Setup Swagger documentation
setupSwagger(app);

// Health check route
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'Server is running!',
        timestamp: new Date().toISOString(),
    });
});

// API routes
app.use('/api/v1/teams', teamsRoutes);
app.use('/api/v1/google-calendar', googleCalendarRoutes);

// Handle undefined routes
app.all('*', (req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global error handling middleware
app.use(globalErrorHandler);

process.on('unhandledRejection', async (err: Error) => {
    console.error('UNHANDLED REJECTION! Shutting down...');
    console.error(err.name, err);
    try {
      await close();
    } catch (error) {
      console.error('Error closing RabbitMQ connection:', error);
    }
    server.close(() => {
      process.exit(1);
    });
  });
  
// Start server
const server = app.listen(PORT, async () => {
    try {
      const producer = createProducer({
        url: process.env.RABBITMQ_URL!,
        heartbeat: 30,
        prefetch: 20
      });
      await producer.initialize();
      console.log(` Server running on port ${PORT}`);
      console.log(` API Documentation available at http://localhost:${PORT}/api-docs`);
      console.log(` Health check available at http://localhost:${PORT}/cuvera-integration-service/health`);
  
      // 🟢 Start cron scheduler (jobs run only if SCHEDULER_ENABLED=true)
    } catch (error) {
      console.error('Failed to initialize services:', error);
    }
  });

export default app;
