import { HttpService } from '@nestjs/axios';
export declare class AiGatewayService {
    private httpService;
    private readonly logger;
    private readonly aiServiceUrl;
    private readonly serviceToken;
    constructor(httpService: HttpService);
    analyseLabResults(payload: any): Promise<any>;
    healthCheck(): Promise<boolean>;
    analyseHistory(payload: any): Promise<any>;
}
