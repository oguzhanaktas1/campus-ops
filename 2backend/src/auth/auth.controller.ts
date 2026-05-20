import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { AUTH_COOKIE_NAME, getCookieOptions } from './auth-cookie';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private authRateLimitService: AuthRateLimitService,
  ) {}

  private getClientIp(request: Request): string {
    const forwardedFor = request.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
      return forwardedFor.split(',')[0].trim();
    }
    return request.ip ?? 'unknown';
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() dto: LoginDto,
  ) {
    const ip = this.getClientIp(request);
    const normalizedEmail = dto.email.trim().toLowerCase();
    const ipKey = `login:ip:${ip}`;
    const userKey = `login:email:${normalizedEmail}`;

    await this.authRateLimitService.assertAllowed(ipKey);
    await this.authRateLimitService.assertAllowed(userKey);

    try {
      const result = await this.authService.login(dto.email, dto.password, {
        ipAddress: ip,
        userAgent: request.headers['user-agent'] ?? 'unknown',
      });
      response.cookie(AUTH_COOKIE_NAME, result.access_token, getCookieOptions());
      await this.authRateLimitService.clear(ipKey);
      await this.authRateLimitService.clear(userKey);
      return result;
    } catch (error) {
      await this.authRateLimitService.recordFailure(ipKey);
      await this.authRateLimitService.recordFailure(userKey);
      throw error;
    }
  }

  @Post('register')
  async register(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body() dto: RegisterDto,
  ) {
    const ipKey = `register:ip:${this.getClientIp(request)}`;
    await this.authRateLimitService.assertAllowed(ipKey);

    try {
      const result = await this.authService.register(dto, {
        ipAddress: this.getClientIp(request),
        userAgent: request.headers['user-agent'] ?? 'unknown',
      });
      response.cookie(AUTH_COOKIE_NAME, result.access_token, getCookieOptions());
      await this.authRateLimitService.clear(ipKey);
      return result;
    } catch (error) {
      await this.authRateLimitService.recordFailure(ipKey);
      throw error;
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser('userId') userId: string) {
    return this.authService.getMe(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@CurrentUser('userId') userId: string) {
    return this.authService.getFullProfile(userId);
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(AUTH_COOKIE_NAME, {
      ...getCookieOptions(),
      maxAge: undefined,
    });
    return { success: true };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('STUDENT')
  @Get('student-only')
  studentOnly() {
    return { message: 'Hello Student!' };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @Get('admin-only')
  adminOnly() {
    return { message: 'Welcome to the admin zone.' };
  }
}
