import { Controller, Get, Patch, Body, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@Controller('users')
@UseGuards(RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  async getMe(@Req() req: any) {
    const user = await this.usersService.findById(req.user.id);
    const { password, ...safe } = user;
    return safe;
  }

  @Patch('me')
  @Roles('PATIENT', 'DOCTOR', 'LAB_SCIENTIST', 'ADMIN')
  async updateMe(@Req() req: any, @Body() dto: any) {
    const updated = await this.usersService.update(req.user.id, dto);
    const { password, ...safe } = updated;
    return safe;
  }
}
