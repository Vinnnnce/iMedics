import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AiGatewayService {
  private readonly logger = new Logger(AiGatewayService.name);
  private readonly aiServiceUrl: string;
  private readonly serviceToken: string;

  constructor(private httpService: HttpService) {
    this.aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    this.serviceToken = process.env.AI_SERVICE_TOKEN || 'dev-service-token';
  }

  async analyseLabResults(payload: any): Promise<any> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/ai/lab/analyse`, payload, {
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Token': this.serviceToken,
          },
          timeout: 60000, // 60 second timeout for AI processing
        }),
      );

      return data;
    } catch (error: any) {
      this.logger.error(`AI analysis failed: ${error.message}`, error.stack);

      // Return fallback: rule engine output only
      return {
        analysis_id: payload.analysis_id,
        status: 'fallback',
        doctor_view: {
          summary: ['AI analysis unavailable. Please review lab values manually.'],
          suggested_followup: [],
          urgency_level: 'routine',
          limitations: 'AI service error. Manual review required.',
        },
        patient_view: {
          language: payload.options?.patient_language || 'en',
          title: 'Results Available',
          body: ['Your lab results are available. Please discuss them with your doctor.'],
          questions_for_doctor: ['What do these results mean?'],
        },
        flags: payload.rule_flags,
        urgency_level: 'routine',
        confidence: { level: 'low', reasons: ['AI service error'] },
        safety: { passed: true, filtered_count: 0, notes: 'Fallback - no AI generated content' },
        metadata: { error: error.message, timestamp: new Date().toISOString() },
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(`${this.aiServiceUrl}/health`, {
          headers: { 'X-Service-Token': this.serviceToken },
          timeout: 5000,
        }),
      );
      return data.status === 'healthy';
    } catch {
      return false;
    }
  }

  async analyseHistory(payload: any): Promise<any> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/ai/history/analyse`, payload, {
          headers: {
            'Content-Type': 'application/json',
            'X-Service-Token': this.serviceToken,
          },
          timeout: 90000, // 90 second timeout for history AI processing
        }),
      );
      return data;
    } catch (error: any) {
      this.logger.error(`History AI analysis failed: ${error.message}`, error.stack);
      throw error;
    }
  }
}
