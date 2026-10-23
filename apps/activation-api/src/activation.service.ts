import { Injectable, Logger, Inject, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClientKafka } from '@nestjs/microservices';
import { v4 as uuidv4 } from 'uuid';
import {
  EventEnvelope,
  EVENT_TYPES,
  TOPICS,
  ActivationRequestedPayload,
  ActivationCompletedPayload,
  ActivationFailedPayload,
} from '@app/contracts';
import { Activation, ActivationDocument } from './activation.schema';
import { CreateActivationDto } from './dto/create-activation.dto';
import { ActivationGateway } from './activation.gateway';

@Injectable()
export class ActivationService {
  private readonly logger = new Logger(ActivationService.name);

  constructor(
    @InjectModel(Activation.name)
    private readonly activationModel: Model<ActivationDocument>,
    @Inject('KAFKA_PRODUCER')
    private readonly kafkaClient: ClientKafka,
    private readonly gateway: ActivationGateway,
  ) {}

  async create(dto: CreateActivationDto): Promise<Activation> {
    const activationId = `act-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const failureMode = dto.simulateFailure || 'none';

    this.logger.log(`Creating activation ${activationId} for customer ${dto.customerId}`);

    const newActivation = new this.activationModel({
      _id: activationId,
      customerId: dto.customerId,
      planId: dto.planId,
      status: 'PENDING',
      simulateFailure: failureMode,
      steps: {},
      history: [
        {
          eventType: EVENT_TYPES.ACTIVATION_REQUESTED,
          at: new Date(),
        },
      ],
    });

    const saved = await newActivation.save();

    const envelope: EventEnvelope<ActivationRequestedPayload> = {
      eventId: uuidv4(),
      eventType: EVENT_TYPES.ACTIVATION_REQUESTED,
      version: 1,
      occurredAt: new Date().toISOString(),
      correlationId: activationId,
      customerId: dto.customerId,
      source: 'activation-api',
      payload: {
        planId: dto.planId,
        channel: dto.channel || 'web',
        simulateFailure: failureMode,
      },
    };

    // Publish to Kafka: key is customerId to ensure strict partition ordering
    this.kafkaClient.emit(TOPICS.ACTIVATION_REQUESTED, {
      key: dto.customerId,
      value: envelope,
    });

    this.logger.log(`Published ${EVENT_TYPES.ACTIVATION_REQUESTED} for correlationId: ${activationId}`);
    
    // Broadcast creation over WebSocket
    this.gateway.notifyActivationUpdate(saved, envelope);

    return saved;
  }

  async findAll(limit = 20): Promise<Activation[]> {
    return this.activationModel.find().sort({ createdAt: -1 }).limit(limit).exec();
  }

  async findById(activationId: string): Promise<Activation> {
    const doc = await this.activationModel.findById(activationId).exec();
    if (!doc) {
      throw new NotFoundException(`Activation with ID ${activationId} not found`);
    }
    return doc;
  }

  async handleBillingResult(event: EventEnvelope): Promise<void> {
    const activationId = event.correlationId;
    this.logger.log(`Processing billing result [${event.eventType}] for activation ${activationId}`);

    const activation = await this.activationModel.findById(activationId);
    if (!activation) {
      this.logger.warn(`Activation ${activationId} not found when processing billing result`);
      return;
    }

    if (!activation.steps) {
      activation.steps = {};
    }

    // Handle compensation event (BillingAccountCancelled)
    if (event.eventType === EVENT_TYPES.BILLING_ACCOUNT_CANCELLED) {
      activation.steps.billingCompensation = {
        status: 'CANCELLED',
        at: new Date(),
        reason: event.payload?.reason,
      };

      activation.history.push({
        eventType: event.eventType,
        at: new Date(),
      });

      const updated = await activation.save();
      this.gateway.notifyActivationUpdate(updated, event);
      this.logger.warn(`Registered ${EVENT_TYPES.BILLING_ACCOUNT_CANCELLED} compensation for ${activationId}`);
      return;
    }

    const isSuccess = event.eventType === EVENT_TYPES.BILLING_ACCOUNT_CREATED;
    const stepStatus = isSuccess ? 'OK' : 'FAILED';

    activation.steps.billing = {
      status: stepStatus,
      at: new Date(),
    };

    activation.history.push({
      eventType: event.eventType,
      at: new Date(),
    });

    if (activation.status === 'PENDING') {
      activation.status = 'IN_PROGRESS';
    }

    await this.evaluateSaga(activation, event);
  }

  async handleProvisioningResult(event: EventEnvelope): Promise<void> {
    const activationId = event.correlationId;
    this.logger.log(`Processing provisioning result [${event.eventType}] for activation ${activationId}`);

    const activation = await this.activationModel.findById(activationId);
    if (!activation) {
      this.logger.warn(`Activation ${activationId} not found when processing provisioning result`);
      return;
    }

    const isSuccess = event.eventType === EVENT_TYPES.PROVISIONING_COMPLETED;
    const stepStatus = isSuccess ? 'OK' : 'FAILED';

    if (!activation.steps) {
      activation.steps = {};
    }
    activation.steps.provisioning = {
      status: stepStatus,
      at: new Date(),
    };

    activation.history.push({
      eventType: event.eventType,
      at: new Date(),
    });

    if (activation.status === 'PENDING') {
      activation.status = 'IN_PROGRESS';
    }

    await this.evaluateSaga(activation, event);
  }

  private async evaluateSaga(activation: ActivationDocument, triggeringEvent: EventEnvelope): Promise<void> {
    const { billing, provisioning } = activation.steps || {};

    // If already finalized (ACTIVE or FAILED), do not re-evaluate or emit duplicate terminal events
    if (activation.status === 'ACTIVE' || activation.status === 'FAILED') {
      const saved = await activation.save();
      this.gateway.notifyActivationUpdate(saved, triggeringEvent);
      return;
    }

    // Failure case: any step failed
    if (billing?.status === 'FAILED' || provisioning?.status === 'FAILED') {
      activation.status = 'FAILED';
      const failedStep = billing?.status === 'FAILED' ? 'billing' : 'provisioning';

      activation.history.push({
        eventType: EVENT_TYPES.ACTIVATION_FAILED,
        at: new Date(),
      });

      const saved = await activation.save();
      this.logger.warn(`Activation ${activation._id} transitioned to FAILED. Step failed: ${failedStep}`);

      const failureEnvelope: EventEnvelope<ActivationFailedPayload> = {
        eventId: uuidv4(),
        eventType: EVENT_TYPES.ACTIVATION_FAILED,
        version: 1,
        occurredAt: new Date().toISOString(),
        correlationId: activation._id,
        customerId: activation.customerId,
        source: 'activation-api',
        payload: {
          reason: `Step failed: ${failedStep}`,
          failedStep,
        },
      };

      this.kafkaClient.emit(TOPICS.ACTIVATION_EVENTS, {
        key: activation.customerId,
        value: failureEnvelope,
      });

      this.gateway.notifyActivationUpdate(saved, failureEnvelope);
      return;
    }

    // Success case: both steps confirmed OK
    if (billing?.status === 'OK' && provisioning?.status === 'OK') {
      activation.status = 'ACTIVE';

      activation.history.push({
        eventType: EVENT_TYPES.ACTIVATION_COMPLETED,
        at: new Date(),
      });

      const saved = await activation.save();
      this.logger.log(`Activation ${activation._id} transitioned to ACTIVE.`);

      const successEnvelope: EventEnvelope<ActivationCompletedPayload> = {
        eventId: uuidv4(),
        eventType: EVENT_TYPES.ACTIVATION_COMPLETED,
        version: 1,
        occurredAt: new Date().toISOString(),
        correlationId: activation._id,
        customerId: activation.customerId,
        source: 'activation-api',
        payload: {
          planId: activation.planId,
          activatedAt: new Date().toISOString(),
        },
      };

      this.kafkaClient.emit(TOPICS.ACTIVATION_EVENTS, {
        key: activation.customerId,
        value: successEnvelope,
      });

      this.gateway.notifyActivationUpdate(saved, successEnvelope);
      return;
    }

    // Still awaiting other step
    const saved = await activation.save();
    this.gateway.notifyActivationUpdate(saved, triggeringEvent);
  }
}
