import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { CONSUMER_GROUPS } from '@app/contracts';

async function bootstrap() {
  const logger = new Logger('BillingServiceBootstrap');
  const kafkaBrokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'billing-service-client',
        brokers: kafkaBrokers,
      },
      consumer: {
        groupId: CONSUMER_GROUPS.BILLING,
      },
    },
  });

  await app.listen();
  logger.log(`Billing Microservice connected to Kafka at ${kafkaBrokers} with group ${CONSUMER_GROUPS.BILLING}`);
}
bootstrap();
