import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { TOPICS, EventEnvelope } from '@app/contracts';
import { NotificationService } from './notification.service';

@Controller()
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(private readonly notificationService: NotificationService) {}

  @EventPattern(TOPICS.ACTIVATION_EVENTS)
  async handleActivationEvents(@Payload() event: EventEnvelope): Promise<void> {
    this.logger.log(`Received activation event in notification-service: ${event?.eventType} for ${event?.correlationId}`);
    if (event?.correlationId) {
      await this.notificationService.processActivationEvent(event);
    }
  }
}
