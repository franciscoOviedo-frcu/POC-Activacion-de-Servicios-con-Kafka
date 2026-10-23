import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClientKafka } from '@nestjs/microservices';
import { v4 as uuidv4 } from 'uuid';
import {
  EventEnvelope,
  EVENT_TYPES,
  TOPICS,
  ActivationRequestedPayload,
  ProvisioningCompletedPayload,
  ProvisioningFailedPayload,
} from '@app/contracts';
import { ProvisioningOrder, ProvisioningOrderDocument } from './provisioning-order.schema';

@Injectable()
export class ProvisioningService {
  private readonly logger = new Logger(ProvisioningService.name);

  constructor(
    @InjectModel(ProvisioningOrder.name)
    private readonly orderModel: Model<ProvisioningOrderDocument>,
    @Inject('KAFKA_PRODUCER')
    private readonly kafkaClient: ClientKafka,
  ) {}

  async processActivationRequested(event: EventEnvelope<ActivationRequestedPayload>): Promise<void> {
    const activationId = event.correlationId;
    const { customerId } = event;
    const { planId, simulateFailure } = event.payload;

    this.logger.log(`Provisioning requested for activation: ${activationId}, customer: ${customerId}`);

    // Simulate provisioning latency (1 to 2 seconds)
    const delay = Math.floor(Math.random() * 1000) + 1000;
    this.logger.log(`Simulating provisioning network latency: ${delay}ms...`);
    await new Promise((resolve) => setTimeout(resolve, delay));

    // Check simulated business failure
    if (simulateFailure === 'provisioning') {
      this.logger.warn(`Simulated failure triggered for provisioning. Activation: ${activationId}`);
      await this.orderModel.findOneAndUpdate(
        { activationId },
        {
          activationId,
          customerId,
          planId,
          status: 'FAILED',
          failureReason: 'Simulated provisioning infrastructure failure',
        },
        { upsert: true, new: true },
      );

      const failureEnvelope: EventEnvelope<ProvisioningFailedPayload> = {
        eventId: uuidv4(),
        eventType: EVENT_TYPES.PROVISIONING_FAILED,
        version: 1,
        occurredAt: new Date().toISOString(),
        correlationId: activationId,
        customerId,
        source: 'provisioning-service',
        payload: {
          reason: 'Simulated provisioning infrastructure failure',
          simulated: true,
        },
      };

      this.kafkaClient.emit(TOPICS.PROVISIONING_EVENTS, {
        key: customerId,
        value: failureEnvelope,
      });
      return;
    }

    // Happy path: provisioning successful
    const order = await this.orderModel.findOneAndUpdate(
      { activationId },
      {
        activationId,
        customerId,
        planId,
        status: 'COMPLETED',
      },
      { upsert: true, new: true },
    );

    const successEnvelope: EventEnvelope<ProvisioningCompletedPayload> = {
      eventId: uuidv4(),
      eventType: EVENT_TYPES.PROVISIONING_COMPLETED,
      version: 1,
      occurredAt: new Date().toISOString(),
      correlationId: activationId,
      customerId,
      source: 'provisioning-service',
      payload: {
        orderId: (order._id as any).toString(),
        planId,
        provisionedAt: new Date().toISOString(),
      },
    };

    this.kafkaClient.emit(TOPICS.PROVISIONING_EVENTS, {
      key: customerId,
      value: successEnvelope,
    });
    this.logger.log(`Provisioning successfully completed for ${activationId}. Emitted ${EVENT_TYPES.PROVISIONING_COMPLETED}`);
  }
}
