import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

@Entity('users') // Chỉ định tên bảng trong database là 'users'
@Unique(['email']) // Unique constraint on email
@Index(['email']) // Index for faster email lookups
export class User {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id: number;

  /**
   * Email address - must be unique
   * Unique constraint ensures no duplicate emails
   */
  @Column({
    unique: true,
  })
  email: string;

  @Column() // Cột tên người dùng
  username: string;

  @Column() // Cột mật khẩu (nên hash trước khi lưu)
  password: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole; // Role của user (USER, ADMIN, SUPER_ADMIN)

  @Column({
    name: 'is_active',
    type: 'boolean',
    default: true,
  })
  is_active: boolean; // Tài khoản có active không

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  }) // Tự động set thời gian tạo record
  created_at: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
  }) // Tự động update thời gian khi record được sửa
  updated_at: Date;
}
