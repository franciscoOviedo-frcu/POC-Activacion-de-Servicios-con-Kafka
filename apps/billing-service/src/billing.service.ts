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
  BillingAccountCreatedPayload,
  BillingFailedPayload,
  BillingAccountCancelledPayload,
} from '@app/contracts';
import { BillingAccount, BillingAccountDocument } from './billing-account.schema';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectModel(BillingAccount.name)
    private readonly accountModel: Model<BillingAccountDocument>,
    @Inject('KAFKA_PRODUCER')
    private readonly kafkaClient: ClientKafka,
  ) {}

  async processActivationRequested(event: EventEnvelope<ActivationRequestedPayload>): Promise<void> {
    const activationId = event.correlationId;
    const { customerId } = event;
    const { planId, simulateFailure } = event.payload;

    this.logger.log(`Processing ${EVENT_TYPES.ACTIVATION_REQUESTED} for customer: ${customerId}, activation: ${activationId}`);

    // Check if compensation arrived before creation (Race condition edge case)
    const existing = await this.accountModel.findOne({ activationId });
    if (existing && existing.status === 'CANCELLED') {
      this.logger.warn(`Account for ${activationId} was pre-cancelled. Emitting cancellation.`);
      this.emitCancelled(activationId, customerId, 'Pre-cancelled before account creation');
      return;
    }

    // Check simulated business failure
    if (simulateFailure === 'billing') {
      this.logger.warn(`Simulated failure triggered for billing. Activation: ${activationId}`);
      const failureEnvelope: EventEnvelope<BillingFailedPayload> = {
        eventId: uuidv4(),
        eventType: EVENT_TYPES.BILLING_FAILED,
        version: 1,
        occurredAt: new Date().toISOString(),
        correlationId: activationId,
        customerId,
        source: 'billing-service',
        payload: {
          reason: 'Simulated billing service rejection',
          simulated: true,
        },
      };

      this.kafkaClient.emit(TOPICS.BILLING_EVENTS, {
        key: customerId,
        value: failureEnvelope,
      });
      return;
    }

    // Happy path: create billing account
    const account = await this.accountModel.findOneAndUpdate(
      { activationId },
      {
        activationId,
        customerId,
        planId,
        status: 'CREATED',
      },
      { upsert: true, new: true },
    );

    const successEnvelope: EventEnvelope<BillingAccountCreatedPayload> = {
      eventId: uuidv4(),
      eventType: EVENT_TYPES.BILLING_ACCOUNT_CREATED,
      version: 1,
      occurredAt: new Date().toISOString(),
      correlationId: activationId,
      customerId,
      source: 'billing-service',
      payload: {
        accountId: (account._id as any).toString(),
        planId,
        status: 'CREATED',
      },
    };

    this.kafkaClient.emit(TOPICS.BILLING_EVENTS, {
      key: customerId,
      value: successEnvelope,
    });
    this.logger.log(`Billing account created for ${activationId}. Emitted ${EVENT_TYPES.BILLING_ACCOUNT_CREATED}`);
  }

  async processActivationFailed(event: EventEnvelope): Promise<void> {
    const activationId = event.correlationId;
    const { customerId } = event;
    this.logger.log(`Handling compensation for ${activationId} due to ${EVENT_TYPES.ACTIVATION_FAILED}`);

    const account = await this.accountModel.findOne({ activationId });

    if (!account) {
      // Pre-emptive compensation: record tombstone so if creation runs later, it creates directly cancelled
      this.logger.warn(`Account for ${activationId} not found yet. Registering pre-cancellation tombstone.`);
      await this.accountModel.create({
        activationId,
        customerId,
        planId: 'UNKNOWN',
        status: 'CANCELLED',
        cancelledReason: 'Pre-cancelled by ActivationFailed',
      });
      this.emitCancelled(activationId, customerId, 'Pre-cancelled before account creation');
      return;
    }

    if (account.status === 'CANCELLED') {
      this.logger.log(`Account for ${activationId} is already CANCELLED. Idempotent skip.`);
      return;
    }

    account.status = 'CANCELLED';
    account.cancelledReason = event.payload?.reason || 'Compensated after activation failure';
    await account.save();

    this.emitCancelled(activationId, customerId, account.cancelledReason);
  }

  private emitCancelled(activationId: string, customerId: string, reason: string): void {
    const cancelEnvelope: EventEnvelope<BillingAccountCancelledPayload> = {
      eventId: uuidv4(),
      eventType: EVENT_TYPES.BILLING_ACCOUNT_CANCELLED,
      version: 1,
      occurredAt: new Date().toISOString(),
      correlationId: activationId,
      customerId,
      source: 'billing-service',
      payload: {
        reason,
        status: 'CANCELLED',
      },
    };

    this.kafkaClient.emit(TOPICS.BILLING_EVENTS, {
      key: customerId,
      value: cancelEnvelope,
    });
    this.logger.warn(`Emitted ${EVENT_TYPES.BILLING_ACCOUNT_CANCELLED} for ${activationId}`);
  }
}
