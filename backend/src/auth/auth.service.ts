import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';

export const ROLES = ['PATIENT', 'DOCTOR', 'LAB_SCIENTIST', 'ADMIN'] as const;
export type Role = typeof ROLES[number];

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  tokenId?: string;
  exp?: number;
}

@Injectable()
export class AuthService {
  private redis: Redis;

  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  async signup(dto: { email: string; password: string; role: Role; name: string }) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new UnauthorizedException('Email already registered');
    }

    const hashed = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.create({
      ...dto,
      password: hashed,
    });

    return this.generateTokens(user.id, user.email, user.role);
  }

  async signin(dto: { email: string; password: string }) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(user.id, user.email, user.role);
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      }) as JwtPayload;

      // Check if token is blacklisted
      const blacklisted = await this.redis.get(`bl:${payload.tokenId}`);
      if (blacklisted) {
        throw new UnauthorizedException('Token revoked');
      }

      return this.generateTokens(payload.sub, payload.email, payload.role);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      }) as JwtPayload;

      // Blacklist the refresh token
      const ttl = payload.exp! - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await this.redis.set(`bl:${payload.tokenId}`, '1', 'EX', ttl);
      }
    } catch {
      // Token is invalid anyway, no-op
    }
  }

  private async generateTokens(userId: string, email: string, role: Role) {
    const tokenId = uuidv4();
    const payload: JwtPayload = { sub: userId, email, role, tokenId };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: '7d',
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: { id: userId, email, role },
    };
  }
}
