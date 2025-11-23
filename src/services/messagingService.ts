import { generateKafkaMessage, logger } from "@cuvera/commons";
import { topics } from "../config/rabbitmq";
import { producer } from "../messaging/producer";

export class MessagingService {
    async sendCalendarEventsMessage(payloads: any): Promise<boolean> {
        try {
            const topic = {
                eventType: topics.googleCalendar,
            };
            const messages = generateKafkaMessage(payloads, {
                tenantId: '689ddc0411e4209395942bee',
                eventType: topic.eventType,
            });
            await producer.sendMessage(topics.googleCalendar, messages);
            return true;
        } catch (error) {
            logger.error(`Warning: Failed to send message to RabbitMQ: ${error}`);
            return false;
        }
    }
}

export const messagingService = new MessagingService();
