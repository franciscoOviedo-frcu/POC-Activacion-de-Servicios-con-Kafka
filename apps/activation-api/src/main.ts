import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { CONSUMER_GROUPS } from '@app/contracts';

async function bootstrap() {
  const logger = new Logger('ActivationApiBootstrap');
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const kafkaBrokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'activation-api-consumer',
        brokers: kafkaBrokers,
      },
      consumer: {
        groupId: CONSUMER_GROUPS.ACTIVATION_API,
      },
    },
  });

  await app.startAllMicroservices();
  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Activation API running on HTTP port ${port} and listening to Kafka at ${kafkaBrokers}`);
}
bootstrap();
