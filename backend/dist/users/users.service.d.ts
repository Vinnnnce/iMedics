import { PrismaService } from '../prisma/prisma.service';
export declare class UsersService {
    private prisma;
    constructor(prisma: PrismaService);
    findByEmail(email: string): Promise<{
        id: string;
        email: string;
        password: string;
        role: import(".prisma/client").$Enums.Role;
        name: string;
        phone: string | null;
        dateOfBirth: Date | null;
        sex: string | null;
        language: string;
        conditions: import("@prisma/client/runtime/library").JsonValue;
        medications: import("@prisma/client/runtime/library").JsonValue;
        insuranceInfo: import("@prisma/client/runtime/library").JsonValue | null;
        kycVerified: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    findById(id: string): Promise<{
        id: string;
        email: string;
        password: string;
        role: import(".prisma/client").$Enums.Role;
        name: string;
        phone: string | null;
        dateOfBirth: Date | null;
        sex: string | null;
        language: string;
        conditions: import("@prisma/client/runtime/library").JsonValue;
        medications: import("@prisma/client/runtime/library").JsonValue;
        insuranceInfo: import("@prisma/client/runtime/library").JsonValue | null;
        kycVerified: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    create(data: {
        email: string;
        password: string;
        role: string;
        name: string;
    }): Promise<{
        id: string;
        email: string;
        password: string;
        role: import(".prisma/client").$Enums.Role;
        name: string;
        phone: string | null;
        dateOfBirth: Date | null;
        sex: string | null;
        language: string;
        conditions: import("@prisma/client/runtime/library").JsonValue;
        medications: import("@prisma/client/runtime/library").JsonValue;
        insuranceInfo: import("@prisma/client/runtime/library").JsonValue | null;
        kycVerified: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    update(id: string, data: Partial<{
        name: string;
        phone: string;
        dateOfBirth: Date;
        sex: string;
        language: string;
        conditions: any;
        medications: any;
        insuranceInfo: any;
    }>): Promise<{
        id: string;
        email: string;
        password: string;
        role: import(".prisma/client").$Enums.Role;
        name: string;
        phone: string | null;
        dateOfBirth: Date | null;
        sex: string | null;
        language: string;
        conditions: import("@prisma/client/runtime/library").JsonValue;
        medications: import("@prisma/client/runtime/library").JsonValue;
        insuranceInfo: import("@prisma/client/runtime/library").JsonValue | null;
        kycVerified: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
