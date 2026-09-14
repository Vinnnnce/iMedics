import { IsString, IsOptional, IsArray, IsDateString } from 'class-validator';

export class CreateLabOrderDto {
  @IsString()
  panelType: string;

  @IsArray()
  tests: string[];

  @IsOptional()
  @IsString()
  notes?: string;
}
