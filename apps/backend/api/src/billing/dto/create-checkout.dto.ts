import { IsEnum, IsOptional } from 'class-validator';

export class CreateCheckoutDto {
  @IsEnum(['PRO', 'AGENCY'])
  plan: 'PRO' | 'AGENCY';

  @IsEnum(['MONTHLY', 'YEARLY'])
  @IsOptional()
  billingCycle?: 'MONTHLY' | 'YEARLY';
}
