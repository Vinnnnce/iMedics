import { IsString, IsArray, IsDateString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class LabValueDto {
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  loinc?: string;

  @IsString()
  name: string;

  value: number;

  @IsString()
  unit: string;

  @IsOptional()
  refLow?: number;

  @IsOptional()
  refHigh?: number;
}

export class CreateLabResultDto {
  @IsString()
  panelType: string;

  @IsDateString()
  testDate: string;

  @IsOptional()
  @IsString()
  labName?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LabValueDto)
  values: LabValueDto[];
}
