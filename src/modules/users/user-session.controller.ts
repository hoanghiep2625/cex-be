import {
  Controller,
  Post,
  Get,
  Delete,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Param,
} from '@nestjs/common';
import { UserSessionService } from './user-session.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('user-sessions')
@UseGuards(JwtAuthGuard)
export class UserSessionController {
  constructor(private readonly userSessionService: UserSessionService) {}

  /**
   * Generate new listenKey for WebSocket connection
   * POST /user-sessions/listen-key
   */
  @Post('listen-key')
  @HttpCode(HttpStatus.CREATED)
  async generateListenKey(@Request() req: any) {
    const { listenKey, expiresIn } =
      await this.userSessionService.createListenKey(
        req.user.id,
        req.ip,
        req.headers['user-agent'],
      );

    return {
      statusCode: 201,
      message: 'ListenKey generated successfully',
      data: {
        listenKey,
        expiresIn, // seconds
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      },
    };
  }

  /**
   * Refresh listenKey (extend expiration)
   * PUT /user-sessions/listen-key/:listenKey
   */
  @Post('listen-key/:listenKey/refresh')
  @HttpCode(HttpStatus.OK)
  async refreshListenKey(
    @Request() req: any,
    @Param('listenKey') listenKey: string,
  ) {
    // Verify the listenKey belongs to current user
    const session = await this.userSessionService.validateListenKey(listenKey);

    if (!session || session.user_id !== req.user.id) {
      return {
        statusCode: 403,
        message: 'Forbidden',
        data: null,
      };
    }

    const success = await this.userSessionService.refreshListenKey(listenKey);

    return {
      statusCode: success ? 200 : 400,
      message: success ? 'ListenKey refreshed' : 'Failed to refresh listenKey',
      data: { success },
    };
  }

  /**
   * Revoke listenKey (disconnect WebSocket)
   * DELETE /user-sessions/listen-key/:listenKey
   */
  @Delete('listen-key/:listenKey')
  @HttpCode(HttpStatus.OK)
  async revokeListenKey(
    @Request() req: any,
    @Param('listenKey') listenKey: string,
  ) {
    // Verify the listenKey belongs to current user
    const session = await this.userSessionService.validateListenKey(listenKey);

    if (!session || session.user_id !== req.user.id) {
      return {
        statusCode: 403,
        message: 'Forbidden',
        data: null,
      };
    }

    const success = await this.userSessionService.revokeListenKey(listenKey);

    return {
      statusCode: success ? 200 : 400,
      message: success ? 'ListenKey revoked' : 'Failed to revoke listenKey',
      data: { success },
    };
  }

  /**
   * Get all active sessions for current user
   * GET /user-sessions
   */
  @Get()
  async getSessions(@Request() req: any) {
    const sessions = await this.userSessionService.getUserSessions(req.user.id);

    return {
      statusCode: 200,
      message: 'Sessions retrieved successfully',
      data: sessions.map((s) => ({
        id: s.id,
        listenKey: s.listen_key.substring(0, 8) + '...',
        ipAddress: s.ip_address,
        createdAt: s.created_at,
        expiresAt: s.expires_at,
        isValid: s.isValid(),
      })),
    };
  }
}
