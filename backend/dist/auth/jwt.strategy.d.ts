import { Strategy } from 'passport-jwt';
import { AuthService, JwtPayload } from './auth.service';
declare const JwtStrategy_base: new (...args: any[]) => Strategy;
export declare class JwtStrategy extends JwtStrategy_base {
    private authService;
    constructor(authService: AuthService);
    validate(payload: JwtPayload): Promise<{
        id: string;
        email: string;
        role: "PATIENT" | "DOCTOR" | "LAB_SCIENTIST" | "ADMIN";
    }>;
}
export {};
