import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ProvisioningOrder, ProvisioningOrderSchema } from './provisioning-order.schema';
import { ProvisioningController } from './provisioning.controller';
import { ProvisioningService } from './provisioning.service';

@Module({
  imports: [
    MongooseModule.forRoot(
      process.env.MONGO_URI || 'mongodb://localhost:27017/provisioning_db?replicaSet=rs0&directConnection=true',
    ),
    MongooseModule.forFeature([{ name: ProvisioningOrder.name, schema: ProvisioningOrderSchema }]),
    ClientsModule.register([
      {
        name: 'KAFKA_PRODUCER',
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'provisioning-service-producer',
            brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
          },
          producer: {
            allowAutoTopicCreation: true,
          },
        },
      },
    ]),
  ],
  controllers: [ProvisioningController],
  providers: [ProvisioningService],
})
export class AppModule {}
