import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
export declare const ROLES: readonly ["PATIENT", "DOCTOR", "LAB_SCIENTIST", "ADMIN"];
export type Role = typeof ROLES[number];
export interface JwtPayload {
    sub: string;
    email: string;
    role: Role;
    tokenId?: string;
    exp?: number;
}
export declare class AuthService {
    private usersService;
    private jwtService;
    private redis;
    constructor(usersService: UsersService, jwtService: JwtService);
    signup(dto: {
        email: string;
        password: string;
        role: Role;
        name: string;
    }): Promise<{
        access_token: string;
        refresh_token: string;
        user: {
            id: string;
            email: string;
            role: "PATIENT" | "DOCTOR" | "LAB_SCIENTIST" | "ADMIN";
        };
    }>;
    signin(dto: {
        email: string;
        password: string;
    }): Promise<{
        access_token: string;
        refresh_token: string;
        user: {
            id: string;
            email: string;
            role: "PATIENT" | "DOCTOR" | "LAB_SCIENTIST" | "ADMIN";
        };
    }>;
    refresh(refreshToken: string): Promise<{
        access_token: string;
        refresh_token: string;
        user: {
            id: string;
            email: string;
            role: "PATIENT" | "DOCTOR" | "LAB_SCIENTIST" | "ADMIN";
        };
    }>;
    logout(refreshToken: string): Promise<void>;
    private generateTokens;
}
