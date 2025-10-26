import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

@Entity('user_sessions')
@Index(['user_id', 'listen_key'])
@Index(['listen_key'])
@Index(['expires_at'])
export class UserSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('int')
  user_id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column('varchar', { length: 255, unique: true })
  listen_key: string;

  @Column('varchar', { length: 255, nullable: true })
  ip_address: string;

  @Column('varchar', { length: 255, nullable: true })
  user_agent: string;

  @Column('timestamp')
  expires_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  /**
   * Check if session is expired
   */
  isExpired(): boolean {
    return new Date() > this.expires_at;
  }

  /**
   * Check if session is valid
   */
  isValid(): boolean {
    return !this.isExpired();
  }
}
