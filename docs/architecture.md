# Arquitectura Integral: POC Activación de Servicios con Kafka

> **Institución**: UTN FRCU — Ingeniería en Sistemas de Información  
> **Cátedra**: Sistemas Distribuidos (2026)  
> **Patrón Central**: Coreografía con Agregador + Saga Compensatoria + Particionado Semántico

---

## 1. Topología del Sistema y Componentes

El sistema se compone de 7 componentes desacoplados que interactúan exclusivamente a través de Apache Kafka (modo KRaft) y MongoDB (Replica Set para soporte de transacciones e idempotencia).

```mermaid
flowchart TD
    subgraph Frontend
        UI["Demo UI (React + Vite)\nPuerto 5173\nFormulario + Timeline WS"]
    end

    subgraph EntryPoint
        API["activation-api (NestJS)\nPuerto 3000\nREST /activations + Agregador"]
    end

    subgraph KafkaBroker["Apache Kafka (KRaft Broker :9092)"]
        T1["Topic: activation.requested\n(3 particiones, key=customerId)"]
        T2["Topic: billing.events\n(3 particiones, key=customerId)"]
        T3["Topic: provisioning.events\n(3 particiones, key=customerId)"]
        T4["Topic: activation.events\n(3 particiones, key=customerId)"]
        DLQ["Topics: *.dlq\n(Dead Letter Queues)"]
    end

    subgraph Microservicios
        BILLING["billing-service (NestJS)\nGrupo: billing-svc\nCuentas & Compensación"]
        PROV["provisioning-service (NestJS)\nGrupo: provisioning-svc\nAprovisionamiento de línea"]
        NOTIF["notification-service (NestJS)\nGrupo: notification-svc\nEmails a Mailhog"]
        CRM["crm-analytics-service (NestJS)\nGrupo: crm-analytics-svc\nConsumidor Universal Pasivo"]
        LOYALTY["loyalty-service (Perfil opcional)\nGrupo: loyalty-svc\nReplay histórico offset=0"]
    end

    subgraph Infraestructura
        MONGO[("MongoDB (Replica Set rs0)\nPuerto 27017\nBase aislada por servicio")]
        MAILHOG["Mailhog (SMTP :1025 / Web :8025)"]
        KAFKA_UI["Kafka UI (Kafbat :8080)"]
    end

    UI -->|POST /activations| API
    API -.->|WebSocket timeline| UI
    API -->|Produce ActivationRequested| T1

    T1 -->|Consume| BILLING
    T1 -->|Consume| PROV

    BILLING -->|Produce BillingAccountCreated / Failed| T2
    PROV -->|Produce ProvisioningCompleted / Failed| T3

    T2 -->|Consume| API
    T3 -->|Consume| API

    API -->|Produce ActivationCompleted / Failed| T4

    T4 -->|Consume ActivationFailed| BILLING
    T4 -->|Consume| NOTIF
    NOTIF -->|SMTP| MAILHOG

    T1 -.-> CRM
    T2 -.-> CRM
    T3 -.-> CRM
    T4 -.-> CRM
    T4 -.-> LOYALTY

    API --- MONGO
    BILLING --- MONGO
    PROV --- MONGO
    NOTIF --- MONGO
    CRM --- MONGO
    KAFKA_UI --- KafkaBroker
```

---

## 2. Diagramas de Secuencia

### 2.1. Camino Feliz (Fan-out y Agregación Concurrente)
```mermaid
sequenceDiagram
    autonumber
    actor Cliente as Usuario (UI / REST)
    participant API as activation-api
    participant Kafka as Apache Kafka
    participant Billing as billing-service
    participant Prov as provisioning-service
    participant Notif as notification-service

    Cliente->>API: POST /activations { customerId, planId }
    API->>API: Persiste estado PENDING en Mongo
    API->>Kafka: Produce ActivationRequested (topic: activation.requested, key=customerId)
    API-->>Cliente: 202 Accepted { activationId, status: "PENDING" }

    par Procesamiento en paralelo
        Kafka->>Billing: Consume ActivationRequested
        Billing->>Billing: Crea cuenta facturación (CREATED)
        Billing->>Kafka: Produce BillingAccountCreated (topic: billing.events)
    and
        Kafka->>Prov: Consume ActivationRequested
        Prov->>Prov: Simula aprovisionamiento (1-2s)
        Prov->>Kafka: Produce ProvisioningCompleted (topic: provisioning.events)
    end

    Kafka->>API: Consume BillingAccountCreated & ProvisioningCompleted
    API->>API: Agrega resultados: ambos OK -> Transiciona a ACTIVE
    API->>Kafka: Produce ActivationCompleted (topic: activation.events)
    
    Kafka->>Notif: Consume ActivationCompleted
    Notif->>Notif: Envía email de bienvenida a Mailhog
```

### 2.2. Fallo de Negocio y Compensación en Saga (Sin RPC)
```mermaid
sequenceDiagram
    autonumber
    actor Cliente as Usuario (UI)
    participant API as activation-api
    participant Kafka as Apache Kafka
    participant Billing as billing-service
    participant Prov as provisioning-service
    participant Notif as notification-service

    Cliente->>API: POST /activations { simulateFailure: "provisioning" }
    API->>Kafka: Produce ActivationRequested
    API-->>Cliente: 202 Accepted

    par
        Kafka->>Billing: Consume ActivationRequested
        Billing->>Billing: Crea cuenta (CREATED)
        Billing->>Kafka: Produce BillingAccountCreated
    and
        Kafka->>Prov: Consume ActivationRequested
        Prov->>Prov: Falla aprovisionamiento
        Prov->>Kafka: Produce ProvisioningFailed (topic: provisioning.events)
    end

    Kafka->>API: Consume ProvisioningFailed
    API->>API: Detecta fallo -> Transiciona a FAILED
    API->>Kafka: Produce ActivationFailed (topic: activation.events)

    Kafka->>Billing: Consume ActivationFailed (disparador de compensación)
    Billing->>Billing: Anula cuenta -> estado CANCELLED
    Billing->>Kafka: Produce BillingAccountCancelled (topic: billing.events)

    Kafka->>Notif: Consume ActivationFailed
    Notif->>Notif: Envía email de notificación de error a Mailhog
```

---

## 3. Máquina de Estados de la Activación

```mermaid
stateDiagram-v2
    [*] --> PENDING: POST /activations
    PENDING --> IN_PROGRESS: Llega primer resultado (Billing o Provisioning)
    
    IN_PROGRESS --> ACTIVE: Billing OK AND Provisioning OK
    IN_PROGRESS --> FAILED: Billing FAILED OR Provisioning FAILED
    
    PENDING --> FAILED: Si el primer resultado recibido es FAILED
    
    ACTIVE --> [*]: Estado Final (Activación Exitosa)
    FAILED --> [*]: Estado Final (Saga compensada)
```

---

## 4. Sobre Común de Eventos (`EventEnvelope`)

Todos los eventos comparten la misma estructura externa; el atributo `payload` contiene los datos específicos del hecho de dominio:

```json
{
  "eventId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "eventType": "ActivationRequested",
  "version": 1,
  "occurredAt": "2026-09-27T16:40:00Z",
  "correlationId": "act-mvleajlr-10xd",
  "customerId": "C-1234",
  "source": "activation-api",
  "payload": {
    "planId": "FIBRA-1000MB",
    "channel": "web",
    "simulateFailure": "none"
  }
}
```

### Justificación de Atributos:
- `eventId`: UUID único fundamental para la deduplicación e **idempotencia**.
- `customerId`: Clave semántica de particionamiento. Asegura que todos los eventos del cliente viajen a la misma partición y sean consumidos en estricto orden cronológico.
- `correlationId`: Identificador del proceso de negocio (`activationId`). Permite trazar la saga de punta a punta.
- `version`: Facilita la evolución de contratos (*schema evolution*) sin romper consumidores existentes.

---

## 5. Estrategia de Idempotencia y Tolerancia a Fallos

1. **Idempotencia en Consumidores**:
   - Cada servicio cuenta con una colección `processed_events` con índice único sobre `eventId` y un TTL de 7 días.
   - Si Kafka reenvía un mensaje por rebalanceo o caída transitoria, el consumidor detecta el duplicado (`duplicate key`), descarta el efecto secundario y confirma el offset.
2. **Separación de Fallos de Negocio vs. Fallos Técnicos**:
   - **Fallo de Negocio**: Es parte del dominio. Se publica un evento (`ProvisioningFailed`, `BillingFailed`), la saga transiciona a `FAILED` y se ejecuta la compensación.
   - **Fallo Técnico** (BD inaccesible, red caída, parse error): Se reintenta 3 veces con backoff exponencial/lineal (1s, 2s, 4s). Al agotar reintentos, el mensaje se despacha al topic `<topic>.dlq` con los headers de error y se commitea el offset para **no bloquear la partición**.
