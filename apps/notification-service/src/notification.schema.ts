import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ required: true, index: true })
  activationId: string;

  @Prop({ required: true, index: true })
  customerId: string;

  @Prop({ required: true })
  eventType: string;

  @Prop({ required: true })
  recipientEmail: string;

  @Prop({ required: true })
  subject: string;

  @Prop({ required: true })
  content: string;

  @Prop({ required: true, enum: ['SENT', 'FAILED'] })
  status: string;

  @Prop()
  errorMessage?: string;

  @Prop({ default: Date.now })
  sentAt: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
