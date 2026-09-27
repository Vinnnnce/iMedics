import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../common/services/s3.service';
import { AiGatewayService } from '../ai/ai-gateway.service';
import { CreateLabOrderDto } from './dto/create-lab-order.dto';
import { CreateLabResultDto } from './dto/create-lab-result.dto';
export declare class LabsService {
    private prisma;
    private s3Service;
    private aiGateway;
    constructor(prisma: PrismaService, s3Service: S3Service, aiGateway: AiGatewayService);
    createOrder(patientId: string, dto: CreateLabOrderDto, orderedBy: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        panelType: string;
        tests: import("@prisma/client/runtime/library").JsonValue;
        notes: string | null;
        status: import(".prisma/client").$Enums.LabOrderStatus;
        patientId: string;
        orderedBy: string;
    }>;
    getResults(patientId: string): Promise<({
        aiAnalysis: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            metadata: import("@prisma/client/runtime/library").JsonValue;
            status: import(".prisma/client").$Enums.AiAnalysisStatus;
            doctorView: import("@prisma/client/runtime/library").JsonValue | null;
            patientView: import("@prisma/client/runtime/library").JsonValue | null;
            flags: import("@prisma/client/runtime/library").JsonValue;
            urgencyLevel: string;
            confidence: import("@prisma/client/runtime/library").JsonValue;
            safetyReport: import("@prisma/client/runtime/library").JsonValue;
            labResultId: string;
        };
        verifiedBy: {
            id: string;
            name: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        panelType: string;
        testDate: Date;
        labName: string | null;
        values: import("@prisma/client/runtime/library").JsonValue;
        status: import(".prisma/client").$Enums.LabResultStatus;
        patientId: string;
        fileUrl: string | null;
        uploadedById: string | null;
        verifiedById: string | null;
        verifiedAt: Date | null;
    })[]>;
    getResult(patientId: string, resultId: string): Promise<{
        aiAnalysis: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            metadata: import("@prisma/client/runtime/library").JsonValue;
            status: import(".prisma/client").$Enums.AiAnalysisStatus;
            doctorView: import("@prisma/client/runtime/library").JsonValue | null;
            patientView: import("@prisma/client/runtime/library").JsonValue | null;
            flags: import("@prisma/client/runtime/library").JsonValue;
            urgencyLevel: string;
            confidence: import("@prisma/client/runtime/library").JsonValue;
            safetyReport: import("@prisma/client/runtime/library").JsonValue;
            labResultId: string;
        };
        verifiedBy: {
            id: string;
            name: string;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        panelType: string;
        testDate: Date;
        labName: string | null;
        values: import("@prisma/client/runtime/library").JsonValue;
        status: import(".prisma/client").$Enums.LabResultStatus;
        patientId: string;
        fileUrl: string | null;
        uploadedById: string | null;
        verifiedById: string | null;
        verifiedAt: Date | null;
    }>;
    createResult(patientId: string, dto: CreateLabResultDto, file: Express.Multer.File | undefined, uploadedBy: {
        id: string;
        role: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        panelType: string;
        testDate: Date;
        labName: string | null;
        values: import("@prisma/client/runtime/library").JsonValue;
        status: import(".prisma/client").$Enums.LabResultStatus;
        patientId: string;
        fileUrl: string | null;
        uploadedById: string | null;
        verifiedById: string | null;
        verifiedAt: Date | null;
    }>;
    verifyResult(patientId: string, resultId: string, verifiedById: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        panelType: string;
        testDate: Date;
        labName: string | null;
        values: import("@prisma/client/runtime/library").JsonValue;
        status: import(".prisma/client").$Enums.LabResultStatus;
        patientId: string;
        fileUrl: string | null;
        uploadedById: string | null;
        verifiedById: string | null;
        verifiedAt: Date | null;
    }>;
    triggerAIAnalysis(resultId: string): Promise<void>;
    private buildAIPayload;
    private validateValues;
    private computeFlag;
    private isCritical;
    private computeRuleFlags;
}
