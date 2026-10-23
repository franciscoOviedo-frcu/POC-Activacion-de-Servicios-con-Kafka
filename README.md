# POC Activación de Servicios con Kafka

> **Universidad Tecnológica Nacional — Facultad Regional Concepción del Uruguay (UTN FRCU)**  
> **Ingeniería en Sistemas de Información — Sistemas Distribuidos (2026)**

Esta Prueba de Concepto (POC) demuestra que la activación de servicios de telecomunicaciones puede resolverse de forma reactiva y escalable publicando un único evento en **Apache Kafka**, coordinando la facturación, el aprovisionamiento, las notificaciones y la analítica mediante eventos, sin llamadas síncronas (RPC/HTTP) entre los servicios de negocio.

---

## 🏛️ Arquitectura y Patrones Implementados

- **Coreografía con Agregador**: `activation-api` inicia la saga con `ActivationRequested` y reacciona de forma asíncrona a los resultados de `billing` y `provisioning`, manteniendo el desacople y exponiendo el estado final.
- **Sagas Compensatorias**: Cualquier fallo de negocio en aprovisionamiento o facturación desencadena la compensación automática (`ActivationFailed` -> `BillingAccountCancelled`).
- **Particionado Semántico**: Clave de partición obligatoria `customerId` para garantizar orden absoluto por cliente en todas las particiones.
- **Tolerancia a Fallos y DLQ**: Reintentos automáticos para fallos de infraestructura y derivación a colas de mensajes muertos (`*.dlq`) sin frenar las particiones.
- **Persistencia Aislada e Idempotencia**: Cada microservicio cuenta con su propia base en **MongoDB en Replica Set** (`rs0`) con control de duplicados mediante `processed_events`.

---

## 📁 Estructura del Repositorio

```text
├── apps/
│   ├── activation-api/       # REST, WebSocket y Agregador de la Saga (Puerto 3000)
│   ├── billing-service/      # Facturación y Transacciones Compensatorias
│   ├── provisioning-service/ # Aprovisionamiento simulado con retardo
│   ├── notification-service/ # Notificaciones por correo electrónico a Mailhog
│   ├── crm-analytics-service/# Consumidor pasivo de todos los topics
│   └── demo-ui/              # Frontend React + Vite con timeline en vivo
├── libs/
│   ├── contracts/            # Definición tipada de eventos, sobre común y tópicos
│   └── kafka-toolkit/        # Helpers de idempotencia, reintentos y DLQ
├── docker/
│   └── create-topics.sh      # Inicialización de tópicos (3 particiones c/u)
├── docs/
│   ├── architecture.md       # Diagramas de secuencia, topología y estados
│   ├── demo-script.md        # Guión paso a paso de los 5 escenarios
│   └── plan_poc_servicios_kafka.md # Plan de desarrollo y análisis técnico
├── scripts/
│   ├── test-phase1.js        # Test automatizado: Camino Feliz (RF-01 a RF-05)
│   └── test-failure.js       # Test automatizado: Fallo forzado y Compensación (RF-06)
├── docker-compose.yml        # Orquestación de infraestructura y servicios
└── package.json              # Monorepo NestJS con npm workspaces
```

---

## 🚀 Inicio Rápido (Quick Start)

### 1. Requisitos Previos
- Docker Desktop (con soporte WSL2 o Linux containers activo)
- Node.js >= 20 y npm >= 10

### 2. Levantar el Entorno Completo con Docker Compose
```bash
# Levantar infraestructura base y microservicios
docker compose up -d
```

### 3. Servicios Expuestos
| Servicio | Interfaz | URL / Puerto |
| :--- | :--- | :--- |
| **activation-api** | REST API & WebSocket | [http://localhost:3000](http://localhost:3000) |
| **Kafka UI (Kafbat)** | Monitoreo de topics, offsets y lag | [http://localhost:8080](http://localhost:8080) |
| **Mailhog** | Bandeja de entrada simulada | [http://localhost:8025](http://localhost:8025) |
| **MongoDB** | Replica Set `rs0` | `mongodb://localhost:27017` |
| **Kafka Broker** | Broker KRaft | `localhost:9092` |

---

## 🧪 Pruebas de Verificación Automatizadas

Ejecutar las pruebas de verificación de la saga distribuidas:

```bash
# 1. Probar Camino Feliz (Ambos servicios confirman OK -> Estado ACTIVE)
node scripts/test-phase1.js

# 2. Probar Fallo Forzado y Compensación (Fallo en prov -> Cancelación en billing -> Estado FAILED)
node scripts/test-failure.js
```

---

## 📖 Documentación Detallada
- [Diagramas de Arquitectura y Secuencia](file:///c:/Users/Fran/source/repos/POC%20Servicios%20Kafka%202/docs/architecture.md)
- [Guión de los 5 Escenarios de Demostración](file:///c:/Users/Fran/source/repos/POC%20Servicios%20Kafka%202/docs/demo-script.md)
- [Plan de Desarrollo y Análisis Conceptual](file:///c:/Users/Fran/source/repos/POC%20Servicios%20Kafka%202/docs/plan_poc_servicios_kafka.md)
