import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class UserDto {
  @IsString()
  @IsNotEmpty({ message: 'Username không được để trống' })
  @Matches(/^[a-z0-9]+$/, {
    message: 'Username chỉ được chứa chữ thường và số',
  })
  username: string;

  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Email không được để trống' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Password không được để trống' })
  @MinLength(6, { message: 'Password phải ít nhất 6 ký tự' })
  password: string;
}
