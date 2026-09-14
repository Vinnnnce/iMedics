import { IsString, IsEnum, MinLength, IsEmail } from 'class-validator';
import { Role, ROLES } from '../auth.service';

export class SignupDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsEnum(ROLES)
  role: Role;

  @IsString()
  @MinLength(2)
  name: string;
}
