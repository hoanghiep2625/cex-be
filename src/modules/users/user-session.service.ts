import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { UserSession } from './entities/user-session.entity';
import * as crypto from 'crypto';

@Injectable()
export class UserSessionService {
  private logger = new Logger('UserSessionService');
  private readonly LISTEN_KEY_TTL = 60 * 60 * 1000; // 60 minutes (ms)

  constructor(
    @InjectRepository(UserSession)
    private readonly sessionRepository: Repository<UserSession>,
  ) {}

  /**
   * Create a new listenKey for WebSocket connection
   */
  async createListenKey(
    userId: number,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{ listenKey: string; expiresIn: number }> {
    try {
      // Generate unique listenKey
      const listenKey = `${crypto.randomBytes(16).toString('hex')}`;

      // Calculate expiration time (60 minutes from now)
      const expiresAt = new Date(Date.now() + this.LISTEN_KEY_TTL);

      // Create session
      const session = this.sessionRepository.create({
        user_id: userId,
        listen_key: listenKey,
        ip_address: ipAddress,
        user_agent: userAgent,
        expires_at: expiresAt,
      });

      await this.sessionRepository.save(session);

      this.logger.log(
        `✅ ListenKey created for user ${userId}: ${listenKey.substring(0, 8)}...`,
      );

      return {
        listenKey,
        expiresIn: this.LISTEN_KEY_TTL / 1000, // Convert to seconds
      };
    } catch (err) {
      this.logger.error('Failed to create listenKey:', err);
      throw err;
    }
  }

  /**
   * Validate listenKey
   */
  async validateListenKey(listenKey: string): Promise<UserSession | null> {
    try {
      const session = await this.sessionRepository.findOne({
        where: { listen_key: listenKey },
        relations: ['user'],
      });

      if (!session) {
        this.logger.warn(
          `❌ ListenKey not found: ${listenKey.substring(0, 8)}...`,
        );
        return null;
      }

      if (session.isExpired()) {
        this.logger.warn(
          `❌ ListenKey expired: ${listenKey.substring(0, 8)}...`,
        );
        await this.sessionRepository.remove(session);
        return null;
      }

      return session;
    } catch (err) {
      this.logger.error('Failed to validate listenKey:', err);
      return null;
    }
  }

  /**
   * Refresh listenKey (extend expiration)
   */
  async refreshListenKey(listenKey: string): Promise<boolean> {
    try {
      const session = await this.sessionRepository.findOne({
        where: { listen_key: listenKey },
      });

      if (!session) {
        return false;
      }

      // Extend expiration by 60 minutes
      session.expires_at = new Date(Date.now() + this.LISTEN_KEY_TTL);
      await this.sessionRepository.save(session);

      this.logger.log(
        `✅ ListenKey refreshed for user ${session.user_id}: ${listenKey.substring(0, 8)}...`,
      );

      return true;
    } catch (err) {
      this.logger.error('Failed to refresh listenKey:', err);
      return false;
    }
  }

  /**
   * Revoke listenKey
   */
  async revokeListenKey(listenKey: string): Promise<boolean> {
    try {
      const result = await this.sessionRepository.delete({
        listen_key: listenKey,
      });

      if (result.affected > 0) {
        this.logger.log(
          `✅ ListenKey revoked: ${listenKey.substring(0, 8)}...`,
        );
        return true;
      }

      return false;
    } catch (err) {
      this.logger.error('Failed to revoke listenKey:', err);
      return false;
    }
  }

  /**
   * Cleanup expired sessions (cron job)
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      const result = await this.sessionRepository.delete({
        expires_at: LessThan(new Date()),
      });

      if (result.affected > 0) {
        this.logger.log(`🧹 Cleaned up ${result.affected} expired sessions`);
      }

      return result.affected || 0;
    } catch (err) {
      this.logger.error('Failed to cleanup expired sessions:', err);
      return 0;
    }
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: number): Promise<UserSession[]> {
    try {
      return await this.sessionRepository.find({
        where: { user_id: userId },
        order: { created_at: 'DESC' },
      });
    } catch (err) {
      this.logger.error(`Failed to get sessions for user ${userId}:`, err);
      return [];
    }
  }
}
