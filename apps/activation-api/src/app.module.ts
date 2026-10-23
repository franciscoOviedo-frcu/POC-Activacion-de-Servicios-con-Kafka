import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { Activation, ActivationSchema } from './activation.schema';
import { ActivationController } from './activation.controller';
import { ActivationService } from './activation.service';
import { ActivationGateway } from './activation.gateway';

@Module({
  imports: [
    MongooseModule.forRoot(
      process.env.MONGO_URI || 'mongodb://localhost:27017/activation_api_db?replicaSet=rs0&directConnection=true',
    ),
    MongooseModule.forFeature([{ name: Activation.name, schema: ActivationSchema }]),
    ClientsModule.register([
      {
        name: 'KAFKA_PRODUCER',
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'activation-api-producer',
            brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
          },
          producer: {
            allowAutoTopicCreation: true,
          },
        },
      },
    ]),
  ],
  controllers: [ActivationController],
  providers: [ActivationService, ActivationGateway],
})
export class AppModule {}
