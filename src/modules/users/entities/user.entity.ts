import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

/**
 * User Entity - Định nghĩa cấu trúc bảng users trong database
 * Sử dụng TypeORM decorators để map class với database table
 */
@Entity('users') // Chỉ định tên bảng trong database là 'users'
export class User {
  @PrimaryGeneratedColumn() // Tự động tăng primary key
  id: number;

  @Column({ unique: true }) // Cột email, phải là duy nhất (không trùng lặp)
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
  isActive: boolean; // Tài khoản có active không

  @CreateDateColumn() // Tự động set thời gian tạo record
  createdAt: Date;

  @UpdateDateColumn() // Tự động update thời gian khi record được sửa
  updatedAt: Date;
}
