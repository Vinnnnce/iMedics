import { Module } from '@nestjs/common';
import { PatientHistoryController } from './patient-history.controller';
import { PatientHistoryService } from './patient-history.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, AiModule],
  controllers: [PatientHistoryController],
  providers: [PatientHistoryService],
  exports: [PatientHistoryService],
})
export class PatientHistoryModule {}
