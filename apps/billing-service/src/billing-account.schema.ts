import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BillingAccountDocument = BillingAccount & Document;

@Schema({ timestamps: true, collection: 'billing_accounts' })
export class BillingAccount {
  @Prop({ required: true, unique: true, index: true })
  activationId: string;

  @Prop({ required: true })
  customerId: string;

  @Prop({ required: true })
  planId: string;

  @Prop({ required: true, default: 'CREATED' })
  status: string; // 'CREATED' | 'CANCELLED'

  @Prop({ default: null })
  cancelledReason?: string;
}

export const BillingAccountSchema = SchemaFactory.createForClass(BillingAccount);
