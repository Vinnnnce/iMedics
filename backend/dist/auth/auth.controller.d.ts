import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { SigninDto } from './dto/signin.dto';
import { RefreshDto } from './dto/refresh.dto';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    signup(dto: SignupDto): Promise<{
        access_token: string;
        refresh_token: string;
        user: {
            id: string;
            email: string;
            role: "PATIENT" | "DOCTOR" | "LAB_SCIENTIST" | "ADMIN";
        };
    }>;
    signin(dto: SigninDto): Promise<{
        access_token: string;
        refresh_token: string;
        user: {
            id: string;
            email: string;
            role: "PATIENT" | "DOCTOR" | "LAB_SCIENTIST" | "ADMIN";
        };
    }>;
    refresh(dto: RefreshDto): Promise<{
        access_token: string;
        refresh_token: string;
        user: {
            id: string;
            email: string;
            role: "PATIENT" | "DOCTOR" | "LAB_SCIENTIST" | "ADMIN";
        };
    }>;
    logout(dto: RefreshDto): Promise<{
        status: string;
        message: string;
    }>;
}
