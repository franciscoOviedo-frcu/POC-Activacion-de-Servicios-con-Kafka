import { Controller, Post, Get, Body, Param, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { TOPICS, EventEnvelope } from '@app/contracts';
import { ActivationService } from './activation.service';
import { CreateActivationDto } from './dto/create-activation.dto';

@Controller('activations')
export class ActivationController {
  private readonly logger = new Logger(ActivationController.name);

  constructor(private readonly activationService: ActivationService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async create(@Body() dto: CreateActivationDto) {
    const activation = await this.activationService.create(dto);
    return {
      activationId: activation._id,
      customerId: activation.customerId,
      planId: activation.planId,
      status: activation.status,
      createdAt: (activation as any).createdAt,
    };
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.activationService.findById(id);
  }

  @EventPattern(TOPICS.BILLING_EVENTS)
  async handleBillingEvents(@Payload() event: EventEnvelope) {
    this.logger.log(`Received billing event: ${event?.eventType} for ${event?.correlationId}`);
    if (event?.correlationId) {
      await this.activationService.handleBillingResult(event);
    }
  }

  @EventPattern(TOPICS.PROVISIONING_EVENTS)
  async handleProvisioningEvents(@Payload() event: EventEnvelope) {
    this.logger.log(`Received provisioning event: ${event?.eventType} for ${event?.correlationId}`);
    if (event?.correlationId) {
      await this.activationService.handleProvisioningResult(event);
    }
  }
}
