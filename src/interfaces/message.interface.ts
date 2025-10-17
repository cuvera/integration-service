export interface IMessageProducer {
  sendMessage(queue: string, message: any): Promise<boolean>;
  close(): Promise<void>;
  isConnected(): boolean;
}