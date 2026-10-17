import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import {
  AdminLoginDto,
  ReceiptActionDto,
  UpdatePlanDto,
  ToggleSuperAdminDto,
  BroadcastMessageDto,
} from './dto/admin.dto';
import { Public } from '../../common/decorators/public.decorator';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Public()
  @Post('auth/login')
  async login(@Body() dto: AdminLoginDto) {
    const result = await this.adminService.login(dto.username, dto.password);
    return { success: true, data: result };
  }

  @UseGuards(SuperAdminGuard)
  @Get('auth/me')
  async getMe(@Request() req: any) {
    return {
      success: true,
      data: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        isSuperAdmin: true,
      },
    };
  }

  @UseGuards(SuperAdminGuard)
  @Get('metrics')
  async getMetrics() {
    const metrics = await this.adminService.getMetrics();
    return { success: true, data: metrics };
  }

  @UseGuards(SuperAdminGuard)
  @Get('receipts')
  async getReceipts(
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const result = await this.adminService.getReceipts({
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
    });
    return { success: true, data: result };
  }

  @UseGuards(SuperAdminGuard)
  @Post('receipts/:id/approve')
  async approveReceipt(
    @Param('id') orderId: string,
    @Request() req: any,
    @Body() dto: ReceiptActionDto,
  ) {
    const result = await this.adminService.approveReceipt(
      orderId,
      req.user.id,
      dto.notes,
    );
    return { success: true, ...result };
  }

  @UseGuards(SuperAdminGuard)
  @Post('receipts/:id/reject')
  async rejectReceipt(
    @Param('id') orderId: string,
    @Request() req: any,
    @Body() dto: ReceiptActionDto,
  ) {
    const result = await this.adminService.rejectReceipt(
      orderId,
      req.user.id,
      dto.notes,
    );
    return { success: true, ...result };
  }

  @UseGuards(SuperAdminGuard)
  @Get('users')
  async getUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const result = await this.adminService.getUsers({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
    });
    return { success: true, data: result };
  }

  @UseGuards(SuperAdminGuard)
  @Get('workspaces')
  async getWorkspaces(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const result = await this.adminService.getWorkspaces({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
    });
    return { success: true, data: result };
  }

  @UseGuards(SuperAdminGuard)
  @Patch('workspaces/:id/plan')
  async updateWorkspacePlan(
    @Param('id') workspaceId: string,
    @Body() dto: UpdatePlanDto,
  ) {
    const result = await this.adminService.updateWorkspacePlan(
      workspaceId,
      dto.planCode,
    );
    return { success: true, ...result };
  }

  @UseGuards(SuperAdminGuard)
  @Get('analytics')
  async getAnalytics() {
    const result = await this.adminService.getAnalytics();
    return { success: true, data: result };
  }

  @UseGuards(SuperAdminGuard)
  @Get('activity')
  async getActivity() {
    const result = await this.adminService.getPlatformActivity();
    return { success: true, data: result };
  }

  @UseGuards(SuperAdminGuard)
  @Patch('users/:id/role')
  async toggleUserRole(
    @Param('id') userId: string,
    @Body() dto: ToggleSuperAdminDto,
  ) {
    const result = await this.adminService.toggleUserSuperAdmin(
      userId,
      dto.isSuperAdmin,
    );
    return { success: true, ...result };
  }

  @UseGuards(SuperAdminGuard)
  @Post('broadcast')
  async broadcastAnnouncement(@Body() dto: BroadcastMessageDto) {
    const result = await this.adminService.broadcastAnnouncement(
      dto.message,
      dto.target,
    );
    return { success: true, ...result };
  }
}
