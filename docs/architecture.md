# POC Activación de Servicios con Kafka — Arquitectura del Sistema

## 1. Visión General
Esta prueba de concepto (POC) valida el diseño de una arquitectura reactiva basada en eventos utilizando Apache Kafka en modo KRaft, NestJS microservicios y MongoDB en Replica Set.

## 2. Decisiones de Arquitectura
1. **Coreografía con Agregador**:
   - `activation-api` expone la interfaz cliente y publica el evento raíz `ActivationRequested`.
   - `billing-service` y `provisioning-service` reaccionan de manera desacoplada en paralelo.
   - `activation-api` consume los eventos de resultado de ambos servicios, agrega el estado y determina el estado final (`ACTIVE` o `FAILED`).

2. **Garantía de Orden con Particionado Semántico**:
   - La clave de partición en todos los topics de negocio es `customerId`.
   - Esto garantiza que todas las activaciones y transacciones de un mismo cliente se asignen a la misma partición, conservando el orden cronológico.

3. **Manejo de Errores y Compensación (Saga)**:
   - Los errores de negocio (`simulateFailure`) generan eventos explícitos (`BillingFailed`, `ProvisioningFailed`).
   - Al ocurrir un fallo, `activation-api` publica `ActivationFailed`, lo que dispara la transacción compensatoria en `billing-service` (`BillingAccountCancelled`).
   - Se mitiga la condición de carrera registrando una pre-cancelación si `ActivationFailed` arriba antes de la creación de la cuenta.

4. **Idempotencia y DLQ**:
   - Cada consumidor registra el `eventId` en la colección `processed_events` con índice único.
   - Reintentos con backoff (1s, 2s, 4s). Al superar el límite técnico, el mensaje se envía a `<topic>.dlq`.
