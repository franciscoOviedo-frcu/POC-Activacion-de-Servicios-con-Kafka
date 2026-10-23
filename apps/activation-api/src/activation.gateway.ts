import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ActivationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ActivationGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected via WebSocket: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from WebSocket: ${client.id}`);
  }

  notifyActivationUpdate(activation: any, lastEvent?: any) {
    if (!this.server) {
      return;
    }
    this.logger.log(`Emitting WebSocket 'activation:update' for ${activation._id || activation.id} (${activation.status})`);
    this.server.emit('activation:update', {
      activation,
      lastEvent,
      timestamp: new Date().toISOString(),
    });
  }
}
