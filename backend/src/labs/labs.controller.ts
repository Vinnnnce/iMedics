import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { LabsService } from './labs.service';
import { CreateLabOrderDto } from './dto/create-lab-order.dto';
import { CreateLabResultDto } from './dto/create-lab-result.dto';

@Controller('labs')
@UseGuards(RolesGuard)
export class LabsController {
  constructor(private readonly labsService: LabsService) {}

  @Post(':patientId/orders')
  @Roles('DOCTOR', 'LAB_SCIENTIST', 'ADMIN')
  async createOrder(
    @Param('patientId') patientId: string,
    @Body() dto: CreateLabOrderDto,
    @Req() req: any,
  ) {
    return this.labsService.createOrder(patientId, dto, req.user.id);
  }

  @Get(':patientId/results')
  @Roles('PATIENT', 'DOCTOR', 'LAB_SCIENTIST', 'ADMIN')
  async getResults(@Param('patientId') patientId: string, @Req() req: any) {
    // Patients can only access their own results
    if (req.user.role === 'PATIENT' && req.user.id !== patientId) {
      throw new ForbiddenException('Cannot access other patients\' results');
    }
    return this.labsService.getResults(patientId);
  }

  @Get(':patientId/results/:resultId')
  @Roles('PATIENT', 'DOCTOR', 'LAB_SCIENTIST', 'ADMIN')
  async getResult(
    @Param('patientId') patientId: string,
    @Param('resultId') resultId: string,
    @Req() req: any,
  ) {
    if (req.user.role === 'PATIENT' && req.user.id !== patientId) {
      throw new ForbiddenException('Cannot access other patients\' results');
    }
    const result = await this.labsService.getResult(patientId, resultId);
    if (!result) {
      throw new NotFoundException('Lab result not found');
    }
    return result;
  }

  @Post(':patientId/results')
  @Roles('PATIENT', 'DOCTOR', 'LAB_SCIENTIST', 'ADMIN')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async createResult(
    @Param('patientId') patientId: string,
    @Body() dto: CreateLabResultDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (req.user.role === 'PATIENT' && req.user.id !== patientId) {
      throw new ForbiddenException('Cannot upload results for other patients');
    }

    const result = await this.labsService.createResult(patientId, dto, file, req.user);

    // Trigger AI analysis asynchronously
    this.labsService.triggerAIAnalysis(result.id).catch((err) => {
      console.error('AI analysis failed:', err);
    });

    return result;
  }

  @Patch(':patientId/results/:resultId/verify')
  @Roles('LAB_SCIENTIST', 'ADMIN')
  async verifyResult(
    @Param('patientId') patientId: string,
    @Param('resultId') resultId: string,
    @Req() req: any,
  ) {
    return this.labsService.verifyResult(patientId, resultId, req.user.id);
  }
}
