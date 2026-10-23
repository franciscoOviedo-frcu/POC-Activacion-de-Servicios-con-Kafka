import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as nodemailer from 'nodemailer';
import { EventEnvelope, EVENT_TYPES } from '@app/contracts';
import { Notification, NotificationDocument } from './notification.schema';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {
    const host = process.env.MAILHOG_HOST || 'localhost';
    const port = Number(process.env.MAILHOG_PORT || 1025);

    this.logger.log(`Configuring SMTP transporter for Mailhog at ${host}:${port}`);
    this.transporter = nodemailer.createTransport({
      host,
      port,
      ignoreTLS: true,
    });
  }

  async processActivationEvent(event: EventEnvelope): Promise<void> {
    const { eventType, correlationId, customerId, payload } = event;
    this.logger.log(`Received ${eventType} for correlationId: ${correlationId}, customer: ${customerId}`);

    if (eventType === EVENT_TYPES.ACTIVATION_COMPLETED) {
      await this.sendActivationSuccessEmail(correlationId, customerId, payload);
    } else if (eventType === EVENT_TYPES.ACTIVATION_FAILED) {
      await this.sendActivationFailureEmail(correlationId, customerId, payload);
    } else {
      this.logger.debug(`Ignored unhandled eventType: ${eventType}`);
    }
  }

  private async sendActivationSuccessEmail(
    activationId: string,
    customerId: string,
    payload: any,
  ): Promise<void> {
    const recipientEmail = `${customerId.toLowerCase()}@example.com`;
    const planId = payload?.planId || 'PLAN-DEFAULT';
    const activatedAt = payload?.activatedAt || new Date().toISOString();

    const subject = `🎉 ¡Bienvenido! Tu plan ${planId} fue activado con éxito`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #16a34a;">¡Activación Exitosa!</h2>
        <p>Estimado/a cliente <strong>${customerId}</strong>,</p>
        <p>Nos complace informarte que la activación de tu servicio de telecomunicaciones ha finalizado correctamente.</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <tr><td style="padding: 8px; background: #f8fafc; font-weight: bold;">ID de Activación:</td><td style="padding: 8px;">${activationId}</td></tr>
          <tr><td style="padding: 8px; background: #f8fafc; font-weight: bold;">Plan Contratado:</td><td style="padding: 8px; color: #0284c7; font-weight: bold;">${planId}</td></tr>
          <tr><td style="padding: 8px; background: #f8fafc; font-weight: bold;">Fecha de Activación:</td><td style="padding: 8px;">${activatedAt}</td></tr>
          <tr><td style="padding: 8px; background: #f8fafc; font-weight: bold;">Facturación:</td><td style="padding: 8px; color: #16a34a;">Cuenta creada y activa</td></tr>
          <tr><td style="padding: 8px; background: #f8fafc; font-weight: bold;">Línea / Red:</td><td style="padding: 8px; color: #16a34a;">Aprovisionamiento completado</td></tr>
        </table>
        <p style="margin-top: 20px; font-size: 13px; color: #64748b;">
          Este proceso fue coordinado asíncronamente mediante eventos en Apache Kafka (UTN FRCU - Sistemas Distribuidos).
        </p>
      </div>
    `;

    await this.dispatchEmail({
      activationId,
      customerId,
      eventType: EVENT_TYPES.ACTIVATION_COMPLETED,
      recipientEmail,
      subject,
      content: html,
    });
  }

  private async sendActivationFailureEmail(
    activationId: string,
    customerId: string,
    payload: any,
  ): Promise<void> {
    const recipientEmail = `${customerId.toLowerCase()}@example.com`;
    const reason = payload?.reason || 'Error desconocido durante el procesamiento';
    const failedStep = payload?.failedStep || 'desconocido';

    const subject = `⚠️ Aviso Importante: No se pudo completar la activación (${activationId})`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #fecaca; border-radius: 8px;">
        <h2 style="color: #dc2626;">Fallo en la Activación del Servicio</h2>
        <p>Estimado/a cliente <strong>${customerId}</strong>,</p>
        <p>Lamentamos informarte que la activación del servicio no pudo completarse debido a un inconveniente técnico.</p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
          <tr><td style="padding: 8px; background: #fef2f2; font-weight: bold;">ID de Activación:</td><td style="padding: 8px;">${activationId}</td></tr>
          <tr><td style="padding: 8px; background: #fef2f2; font-weight: bold;">Paso Fallido:</td><td style="padding: 8px; color: #dc2626; font-weight: bold;">${failedStep}</td></tr>
          <tr><td style="padding: 8px; background: #fef2f2; font-weight: bold;">Motivo:</td><td style="padding: 8px;">${reason}</td></tr>
          <tr><td style="padding: 8px; background: #fef2f2; font-weight: bold;">Compensación:</td><td style="padding: 8px; color: #ea580c;">Transacción compensatoria ejecutada. No se generarán cargos.</td></tr>
        </table>
        <p style="margin-top: 20px; font-size: 13px; color: #64748b;">
          Cualquier recurso asignado preliminarmente ha sido revertido automáticamente por la Saga coreografiada.
        </p>
      </div>
    `;

    await this.dispatchEmail({
      activationId,
      customerId,
      eventType: EVENT_TYPES.ACTIVATION_FAILED,
      recipientEmail,
      subject,
      content: html,
    });
  }

  private async dispatchEmail(data: {
    activationId: string;
    customerId: string;
    eventType: string;
    recipientEmail: string;
    subject: string;
    content: string;
  }): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: '"Telecom Service Activation" <noreply@telecom-poc.local>',
        to: data.recipientEmail,
        subject: data.subject,
        html: data.content,
      });

      await this.notificationModel.create({
        activationId: data.activationId,
        customerId: data.customerId,
        eventType: data.eventType,
        recipientEmail: data.recipientEmail,
        subject: data.subject,
        content: data.content,
        status: 'SENT',
        sentAt: new Date(),
      });

      this.logger.log(`Email successfully delivered to Mailhog for ${data.recipientEmail} [${data.subject}]`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${data.recipientEmail}: ${error.message}`, error.stack);
      await this.notificationModel.create({
        activationId: data.activationId,
        customerId: data.customerId,
        eventType: data.eventType,
        recipientEmail: data.recipientEmail,
        subject: data.subject,
        content: data.content,
        status: 'FAILED',
        errorMessage: error.message,
        sentAt: new Date(),
      });
    }
  }
}
