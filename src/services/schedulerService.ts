import { schedule, ScheduledTask } from 'node-cron';
import { logger } from '@cuvera/commons';
import { googleCalendarService } from './googleCalendarService';

export class SchedulerService {
  private static instance: SchedulerService;
  private cronJob: ScheduledTask | null = null;
  private isRunning = false;

  private constructor() { }

  public static getInstance(): SchedulerService {
    if (!SchedulerService.instance) {
      SchedulerService.instance = new SchedulerService();
    }
    return SchedulerService.instance;
  }


  public start(): void {
    if (this.isRunning) {
      logger.warn('Scheduler is already running');
      return;
    }

    // Schedule job to run every hour
    this.cronJob = schedule('0 * * * *', async () => {
      try {
        logger.info('⏰ Running scheduled job: processCalendarEvents');
        await googleCalendarService.processRecurringEvents();
        //await googleCalendarService.getCuveraCalendarEvents();
      } catch (error: any) {
        logger.error('Error in scheduled job:', error);
      }
    }, {
      timezone: 'UTC'
    });

    this.isRunning = true;
    logger.info('Scheduler started successfully');
  }

  /**
   * Stop the scheduler
   */
  public stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      this.isRunning = false;
      logger.info('Scheduler stopped successfully');
    } else {
      logger.warn('No active cron job to stop');
    }
  }

  /**
   * Restart the scheduler
   */
  public restart(): void {
    this.stop();
    this.start();
  }

  /**
   * Check if the scheduler is currently running
   */
  public isSchedulerRunning(): boolean {
    return this.isRunning;
  }
}

export const schedulerService = SchedulerService.getInstance();