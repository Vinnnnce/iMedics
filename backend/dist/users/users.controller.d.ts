import { UsersService } from './users.service';
export declare class UsersController {
    private usersService;
    constructor(usersService: UsersService);
    getMe(req: any): Promise<{
        id: string;
        email: string;
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
    updateMe(req: any, dto: any): Promise<{
        id: string;
        email: string;
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
