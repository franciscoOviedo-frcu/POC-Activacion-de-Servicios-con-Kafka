import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { TOPICS, EventEnvelope, ActivationRequestedPayload, EVENT_TYPES } from '@app/contracts';
import { BillingService } from './billing.service';

@Controller()
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(private readonly billingService: BillingService) {}

  @EventPattern(TOPICS.ACTIVATION_REQUESTED)
  async handleActivationRequested(@Payload() event: EventEnvelope<ActivationRequestedPayload>) {
    this.logger.log(`Received ${event?.eventType} for ${event?.correlationId}`);
    if (event?.eventType === EVENT_TYPES.ACTIVATION_REQUESTED) {
      await this.billingService.processActivationRequested(event);
    }
  }

  @EventPattern(TOPICS.ACTIVATION_EVENTS)
  async handleActivationEvents(@Payload() event: EventEnvelope) {
    if (event?.eventType === EVENT_TYPES.ACTIVATION_FAILED) {
      this.logger.log(`Received ${event.eventType} for ${event.correlationId}`);
      await this.billingService.processActivationFailed(event);
    }
  }
}
