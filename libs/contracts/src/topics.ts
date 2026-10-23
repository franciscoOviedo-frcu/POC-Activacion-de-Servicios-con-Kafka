export const TOPICS = {
  ACTIVATION_REQUESTED: 'activation.requested',
  BILLING_EVENTS: 'billing.events',
  PROVISIONING_EVENTS: 'provisioning.events',
  ACTIVATION_EVENTS: 'activation.events',
} as const;

export const CONSUMER_GROUPS = {
  ACTIVATION_API: 'activation-api-svc',
  BILLING: 'billing-svc',
  PROVISIONING: 'provisioning-svc',
  NOTIFICATION: 'notification-svc',
  CRM_ANALYTICS: 'crm-analytics-svc',
  LOYALTY: 'loyalty-svc',
} as const;
