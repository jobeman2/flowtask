import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../database/prisma.service';

@Controller()
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Get()
  rootCheck() {
    return {
      status: 'ok',
      service: 'FlowTask API',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('health')
  checkLiveness() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('health/ready')
  async checkReadiness() {
    let dbStatus = 'healthy';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (e: any) {
      dbStatus = `unhealthy: ${e.message}`;
    }

    return {
      status: dbStatus === 'healthy' ? 'ok' : 'degraded',
      services: {
        database: dbStatus,
        memoryUsage: process.memoryUsage(),
      },
      timestamp: new Date().toISOString(),
    };
  }
}
