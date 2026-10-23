import { IsNotEmpty, IsOptional, IsString, IsIn } from 'class-validator';
import { SimulateFailureMode } from '@app/contracts';

export class CreateActivationDto {
  @IsNotEmpty()
  @IsString()
  customerId: string;

  @IsNotEmpty()
  @IsString()
  planId: string;

  @IsOptional()
  @IsIn(['none', 'billing', 'provisioning'])
  simulateFailure?: SimulateFailureMode;

  @IsOptional()
  @IsString()
  channel?: string;
}
