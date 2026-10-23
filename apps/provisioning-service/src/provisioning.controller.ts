import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { TOPICS, EventEnvelope, ActivationRequestedPayload, EVENT_TYPES } from '@app/contracts';
import { ProvisioningService } from './provisioning.service';

@Controller()
export class ProvisioningController {
  private readonly logger = new Logger(ProvisioningController.name);

  constructor(private readonly provisioningService: ProvisioningService) {}

  @EventPattern(TOPICS.ACTIVATION_REQUESTED)
  async handleActivationRequested(@Payload() event: EventEnvelope<ActivationRequestedPayload>) {
    this.logger.log(`Received ${event?.eventType} for ${event?.correlationId}`);
    if (event?.eventType === EVENT_TYPES.ACTIVATION_REQUESTED) {
      await this.provisioningService.processActivationRequested(event);
    }
  }
}
