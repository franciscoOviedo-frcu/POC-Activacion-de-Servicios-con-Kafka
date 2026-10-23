import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ProvisioningOrderDocument = ProvisioningOrder & Document;

@Schema({ timestamps: true, collection: 'provisioning_orders' })
export class ProvisioningOrder {
  @Prop({ required: true, unique: true, index: true })
  activationId: string;

  @Prop({ required: true })
  customerId: string;

  @Prop({ required: true })
  planId: string;

  @Prop({ required: true, default: 'COMPLETED' })
  status: string; // 'COMPLETED' | 'FAILED'

  @Prop({ default: null })
  failureReason?: string;
}

export const ProvisioningOrderSchema = SchemaFactory.createForClass(ProvisioningOrder);
