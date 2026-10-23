export interface EventEnvelope<T = any> {
  eventId: string;
  eventType: string;
  version: number;
  occurredAt: string;
  correlationId: string; // activationId
  customerId: string;
  source: string;
  payload: T;
}

export const EVENT_TYPES = {
  ACTIVATION_REQUESTED: 'ActivationRequested',
  BILLING_ACCOUNT_CREATED: 'BillingAccountCreated',
  BILLING_FAILED: 'BillingFailed',
  BILLING_ACCOUNT_CANCELLED: 'BillingAccountCancelled',
  PROVISIONING_COMPLETED: 'ProvisioningCompleted',
  PROVISIONING_FAILED: 'ProvisioningFailed',
  ACTIVATION_COMPLETED: 'ActivationCompleted',
  ACTIVATION_FAILED: 'ActivationFailed',
} as const;

export type SimulateFailureMode = 'none' | 'billing' | 'provisioning';

export interface ActivationRequestedPayload {
  planId: string;
  channel?: string;
  simulateFailure?: SimulateFailureMode;
}

export interface BillingAccountCreatedPayload {
  accountId: string;
  planId: string;
  status: 'CREATED';
}

export interface BillingFailedPayload {
  reason: string;
  simulated: boolean;
}

export interface BillingAccountCancelledPayload {
  accountId?: string;
  reason: string;
  status: 'CANCELLED';
}

export interface ProvisioningCompletedPayload {
  orderId: string;
  planId: string;
  provisionedAt: string;
}

export interface ProvisioningFailedPayload {
  reason: string;
  simulated: boolean;
}

export interface ActivationCompletedPayload {
  planId: string;
  activatedAt: string;
}

export interface ActivationFailedPayload {
  reason: string;
  failedStep: 'billing' | 'provisioning' | 'unknown';
}
