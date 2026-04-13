import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { AuthRateLimitService } from './auth-rate-limit.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      global: true,
      secret:
        process.env.JWT_SECRET ??
        (process.env.NODE_ENV === 'production'
          ? (() => {
              throw new Error('JWT_SECRET must be configured in production.');
            })()
          : 'dev-only-insecure-secret-change-me'),
      signOptions: { expiresIn: '8h' },
    }),
  ],
  providers: [
    AuthService,
    JwtStrategy,
    RolesGuard,
    PermissionsGuard,
    AuthRateLimitService,
  ],
  controllers: [AuthController],
  exports: [RolesGuard, PermissionsGuard],
})
export class AuthModule {}
