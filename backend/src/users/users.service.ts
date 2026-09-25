import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(data: { email: string; password: string; role: string; name: string }) {
    return this.prisma.user.create({ data: { ...data, role: data.role as any } });
  }

  async update(id: string, data: Partial<{ name: string; phone: string; dateOfBirth: Date; sex: string; language: string; conditions: any; medications: any; insuranceInfo: any }>) {
    return this.prisma.user.update({ where: { id }, data });
  }
}
