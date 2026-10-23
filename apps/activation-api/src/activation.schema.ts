import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ActivationDocument = Activation & Document;

@Schema({ _id: false })
export class StepInfo {
  @Prop({ required: true })
  status: string; // 'OK' | 'FAILED'

  @Prop({ default: Date.now })
  at: Date;
}

@Schema({ _id: false })
export class HistoryItem {
  @Prop({ required: true })
  eventType: string;

  @Prop({ default: Date.now })
  at: Date;
}

@Schema({ _id: false })
export class StepsRecord {
  @Prop({ type: StepInfo })
  billing?: StepInfo;

  @Prop({ type: StepInfo })
  provisioning?: StepInfo;

  @Prop({ type: Object })
  billingCompensation?: {
    status: string;
    at: Date;
    reason?: string;
  };
}

@Schema({ timestamps: true, collection: 'activations' })
export class Activation {
  @Prop({ required: true })
  _id: string; // activationId, e.g. "act-0001"

  @Prop({ required: true, index: true })
  customerId: string;

  @Prop({ required: true })
  planId: string;

  @Prop({ required: true, default: 'PENDING' })
  status: string; // 'PENDING' | 'IN_PROGRESS' | 'ACTIVE' | 'FAILED'

  @Prop({ default: 'none' })
  simulateFailure: string; // 'none' | 'billing' | 'provisioning'

  @Prop({ type: StepsRecord, default: () => ({}) })
  steps: StepsRecord;

  @Prop({ type: [HistoryItem], default: [] })
  history: HistoryItem[];
}

export const ActivationSchema = SchemaFactory.createForClass(Activation);
