#!/bin/bash
set -e

echo "Waiting for Kafka to be ready at kafka:9092..."
cub kafka-ready -b kafka:9092 1 30 || /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka:9092 --list > /dev/null 2>&1 || sleep 10

TOPICS=(
  "activation.requested"
  "billing.events"
  "provisioning.events"
  "activation.events"
  "activation.requested.dlq"
  "billing.events.dlq"
  "provisioning.events.dlq"
  "activation.events.dlq"
)

echo "Creating Kafka topics with 3 partitions and replication factor 1..."
for TOPIC in "${TOPICS[@]}"; do
  /opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka:9092 \
    --create --if-not-exists \
    --topic "$TOPIC" \
    --partitions 3 \
    --replication-factor 1 \
    --config retention.ms=604800000
  echo "Topic $TOPIC ready."
done

echo "All topics successfully initialized."
/opt/kafka/bin/kafka-topics.sh --bootstrap-server kafka:9092 --list
