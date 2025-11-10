import amqp, { ChannelModel, ConfirmChannel } from 'amqplib';
import { logger } from '@cuvera/commons';

export interface ProducerConfig {
  url?: string;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
  heartbeat?: number;
  prefetch?: number;
}

export interface IMessageProducer {
    sendMessage(queue: string, message: any): Promise<boolean>;
    close(): Promise<void>;
    isConnected(): boolean;
  }

export class MessageProducer implements IMessageProducer {
  private connection: ChannelModel | null = null;
  private channel: ConfirmChannel | null = null;
  private isInitialized = false;
  private reconnectAttempts = 0;
  private config: ProducerConfig;
  private isShuttingDown = false;

  constructor(config: ProducerConfig = {}) {
    this.config = {
      url: config.url || process.env.RABBITMQ_URL || 'amqp://localhost',
      reconnectDelay: config.reconnectDelay || 5000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      heartbeat: config.heartbeat || 60,
      prefetch: config.prefetch || 10
    };
  }
  // Initialize connection with proper error handling and heartbeat
  // Initialize connection with proper error handling
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.debug('Connecting to RabbitMQ...');
      // Create connection with heartbeat
      this.connection = await amqp.connect(this.config.url!, {
        heartbeat: this.config.heartbeat
      });
      // Create confirm channel for reliable publishing
      this.channel = await this.connection.createConfirmChannel();
      
      // Set prefetch for flow control
      await this.channel.prefetch(this.config.prefetch!);

      // Setup connection event handlers
      this.connection.on('error', this.handleConnectionError.bind(this));
      this.connection.on('close', this.handleConnectionClose.bind(this));
      this.connection.on('blocked', this.handleConnectionBlocked.bind(this));
      this.connection.on('unblocked', this.handleConnectionUnblocked.bind(this));

      // Setup channel event handlers  
      this.channel.on('error', this.handleChannelError.bind(this));
      this.channel.on('close', this.handleChannelClose.bind(this));

      this.isInitialized = true;
      this.reconnectAttempts = 0;
      console.log('RabbitMQ connected successfully');
      logger.debug('RabbitMQ connected successfully');

    } catch (error) {
      console.error(`Failed to connect to RabbitMQ: ${error}`);
      logger.error(`Failed to connect to RabbitMQ: ${error}`);
      
      if (!this.isShuttingDown) {
        await this.attemptReconnect();
      }
      
      throw error;
    }
  }

  // Send message to queue (direct routing)
  async sendMessage(queue: string, message: any): Promise<boolean> {
    await this.ensureConnection();

    if (!this.channel) {
      throw new Error('Channel not available');
    }

    try {
      // Assert queue exists with durable option
      await this.channel.assertQueue(queue, { 
        durable: true,
        exclusive: false,
        autoDelete: false
      });

      // Prepare message
      const options = {
        persistent: true,
        contentType: 'application/json',
        timestamp: Date.now(),
        messageId: this.generateMessageId()
      };

      // Send with confirmation
      return new Promise((resolve, reject) => {
        this.channel!.sendToQueue(queue, Buffer.from(JSON.stringify(message)), options, (err: any) => {
          if (err) {
            logger.error(`Failed to send message to queue ${queue}: ${err}`);
            reject(err);
          } else {
            logger.debug(`Message sent to queue: ${queue}`);
            resolve(true);
          }
        });
      });

    } catch (error) {
      logger.error(`Error sending message to queue ${queue}: ${error}`);
      throw error;
    }
  }

  // Ensure connection is active
  private async ensureConnection(): Promise<void> {
    if (!this.isInitialized || !this.connection) {
      await this.initialize();
    }
  }

  // Generate unique message ID
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  // Connection error handler
  private handleConnectionError(error: Error): void {
    logger.error('RabbitMQ connection error:', error);
    this.isInitialized = false;
  }

  // Connection close handler  
  private handleConnectionClose(): void {
    logger.warn('RabbitMQ connection closed');
    this.isInitialized = false;
    
    if (!this.isShuttingDown) {
      this.attemptReconnect();
    }
  }

  // Connection blocked handler
  private handleConnectionBlocked(reason: string): void {
    logger.warn('RabbitMQ connection blocked:', { reason });
  }

  // Connection unblocked handler
  private handleConnectionUnblocked(): void {
    logger.debug('RabbitMQ connection unblocked');
  }

  // Channel error handler
  private handleChannelError(error: Error): void {
    logger.error('RabbitMQ channel error:', error);
  }

  // Channel close handler
  private handleChannelClose(): void {
    logger.warn('RabbitMQ channel closed');
  }

  // Reconnection logic
  private async attemptReconnect(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    if (this.reconnectAttempts >= this.config.maxReconnectAttempts!) {
      logger.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    logger.debug(`Attempting to reconnect (${this.reconnectAttempts}/${this.config.maxReconnectAttempts})...`);

    await this.delay(this.config.reconnectDelay!);

    try {
      await this.initialize();
    } catch (error) {
      logger.error(`Reconnection failed: ${error}`);
      // Will trigger another reconnect attempt via connection close handler
    }
  }

  // Utility delay function
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Check if producer is connected
  isConnected(): boolean {
    return this.isInitialized && 
           this.connection !== null && 
           this.channel !== null;
  }

  // Graceful shutdown
  async close(): Promise<void> {
    this.isShuttingDown = true;
    
    try {
      logger.debug(`Closing RabbitMQ connection...`);

      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }

      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }

      this.isInitialized = false;
      logger.debug(`RabbitMQ connection closed successfully`);

    } catch (error) {
      logger.error(`Error closing RabbitMQ connection: ${error}`);
      throw error;
    }
  }
}

export const producer = new MessageProducer();