# Guion de Demostración (5 Escenarios)

| # | Escenario | Comando / Acción | Resultado Esperado | Concepto Demostrado |
|---|-----------|-------------------|---------------------|---------------------|
| 1 | **Camino Feliz** | Contratar plan con `simulateFailure: 'none'` | Timeline con 4 eventos en verde; email de bienvenida en Mailhog. | Fan-out: un evento, varias reacciones en paralelo. |
| 2 | **Fallo y Compensación** | Contratar plan con `simulateFailure: 'provisioning'` | `ProvisioningFailed` -> `ActivationFailed` -> `BillingAccountCancelled`. Email de error. | Saga coreografiada con compensación sin acoplamiento RPC. |
| 3 | **Servicio Caído (Resiliencia)** | `docker compose stop notification-service`, crear 3 activaciones, `docker compose start notification-service` | Kafka UI muestra lag = 3; al volver procesa los 3 sin pérdidas. | Desacople temporal y persistencia de offsets en Kafka. |
| 4 | **Escalamiento** | `docker compose up -d --scale billing-service=2` | Kafka UI muestra rebalanceo de particiones entre 2 instancias del grupo `billing-svc`. | Consumer groups y particionamiento horizontal. |
| 5 | **Nuevo Consumidor (Replay)** | `docker compose --profile loyalty up -d loyalty-service` | Procesa todo el historial con `auto.offset.reset=earliest` sin tocar a los demás. | Replay del log histórico e inmutabilidad de eventos. |
