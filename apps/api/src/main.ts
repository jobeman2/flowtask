import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';


async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const isProduction = configService.get<string>('NODE_ENV') === 'production';
  const port = configService.get<number>('PORT') || 4000;

  // Real-world production allowed origins:
  // 1. Configured CORS_ORIGINS
  // 2. Official Vercel production deployment
  // 3. Telegram web domains
  const configuredOrigins = configService.get<string>('CORS_ORIGINS')?.split(',') || [];
  const allowedOrigins = [
    ...configuredOrigins,
    'https://flowtask-web-six.vercel.app',
    'https://flowtask.ethiodeploy.com',
    'https://web.telegram.org',
    'https://t.me',
  ].map((o) => o.trim().replace(/\/$/, ''));

  // 1. Production Security Headers (Helmet)
  app.use(
    helmet({
      frameguard: false, // Telegram Mini Apps run inside iframes
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hidePoweredBy: true, // Hide 'X-Powered-By: Express' signature
      hsts: isProduction
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
      noSniff: true, // Prevent MIME-type sniffing
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    })
  );

  app.use(compression());
  app.use(cookieParser());

  // 2. Strict CORS Lockdown
  app.enableCors({
    origin: (origin, callback) => {
      // Allow non-browser server-to-server calls (e.g. Telegram Webhooks, health checks, cron)
      if (!origin) {
        return callback(null, true);
      }

      const cleanOrigin = origin.replace(/\/$/, '');

      // In development mode, permit localhost and tunnel domains
      if (!isProduction) {
        if (
          cleanOrigin.includes('localhost') ||
          cleanOrigin.includes('127.0.0.1') ||
          cleanOrigin.includes('trycloudflare.com') ||
          cleanOrigin.includes('vercel.app')
        ) {
          return callback(null, true);
        }
      }

      // Check against strict whitelist
      const isAllowed =
        allowedOrigins.includes(cleanOrigin) ||
        cleanOrigin.endsWith('.vercel.app') ||
        cleanOrigin.endsWith('.telegram.org') ||
        cleanOrigin.endsWith('.ethiodeploy.com');

      if (isAllowed) {
        return callback(null, true);
      }

      logger.warn(`🛑 Blocked unauthorized CORS origin: ${origin}`);
      return callback(new Error('Cross-Origin Request Blocked by Security Policy'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-workspace-id',
      'x-telegram-bot-api-secret-token',
      'x-sms-secret',
    ],
    maxAge: 86400, // Preflight cache: 24 hours
  });

  // Global prefix
  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'health/ready'],
  });

  // 3. Request Payload Sanitization & Anti-Tampering
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: {
        enableImplicitConversion: true,
      },
    })
  );

  // 4. Production API Cloaking (Hide Swagger Docs in Production)
  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('FlowTask API')
      .setDescription('Telegram Task Manager SaaS Core API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
    logger.log(`📚 Swagger documentation active at: http://localhost:${port}/docs`);
  } else {
    logger.log('🔒 Production mode: Swagger docs cloaked and disabled for security.');
  }

  await app.listen(port);
  logger.log(`🚀 FlowTask API is securely running on port: ${port}`);
}

bootstrap();
