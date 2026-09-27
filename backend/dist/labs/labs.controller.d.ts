import { LabsService } from './labs.service';
import { CreateLabOrderDto } from './dto/create-lab-order.dto';
import { CreateLabResultDto } from './dto/create-lab-result.dto';
export declare class LabsController {
    private readonly labsService;
    constructor(labsService: LabsService);
    createOrder(patientId: string, dto: CreateLabOrderDto, req: any): Promise<{
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
    getResults(patientId: string, req: any): Promise<({
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
    getResult(patientId: string, resultId: string, req: any): Promise<{
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
    createResult(patientId: string, dto: CreateLabResultDto, file: Express.Multer.File, req: any): Promise<{
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
    verifyResult(patientId: string, resultId: string, req: any): Promise<{
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
}
