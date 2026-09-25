import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { LabsModule } from './labs/labs.module';
import { AiModule } from './ai/ai.module';
import { PrismaModule } from './prisma/prisma.module';
import { PatientHistoryModule } from './patient-history/patient-history.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    UsersModule,
    LabsModule,
    AiModule,
    PrismaModule,
    PatientHistoryModule,
  ],
})
export class AppModule {}
