import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { CurrentPrincipal } from '../../common/auth/current-principal.decorator';
import { Public } from '../../common/auth/public.decorator';

import { AuthService } from './auth.service';
import { AadhaarLinkDto, LogoutDto, RefreshTokenDto, SendOtpDto, VerifyOtpDto } from './dto';

import type { OtpChallengeResponse, TokenResponse } from './dto';
import type { AuthenticatedPrincipal } from '../../common/auth/jwt-claims';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('send-otp')
  sendOtp(@Body() dto: SendOtpDto): Promise<OtpChallengeResponse> {
    return this.auth.sendOtp(dto);
  }

  @Public()
  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto): Promise<TokenResponse> {
    return this.auth.verifyOtp(dto);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto): Promise<TokenResponse> {
    return this.auth.refresh(dto);
  }

  @ApiBearerAuth()
  @Post('logout')
  logout(
    @Body() dto: LogoutDto,
    @CurrentPrincipal() _principal: AuthenticatedPrincipal,
  ): Promise<{ status: 'logged_out' }> {
    return this.auth.logout(dto);
  }

  @ApiBearerAuth()
  @Post('aadhaar-link')
  aadhaarLink(
    @Body() dto: AadhaarLinkDto,
    @CurrentPrincipal() _principal: AuthenticatedPrincipal,
  ): { status: 'digilocker_broker_pending' } {
    return this.auth.aadhaarLink(dto);
  }
}
