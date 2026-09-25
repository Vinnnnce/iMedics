import { Module } from '@nestjs/common';
import { AiGatewayService } from './ai-gateway.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  providers: [AiGatewayService],
  exports: [AiGatewayService],
})
export class AiModule {}
