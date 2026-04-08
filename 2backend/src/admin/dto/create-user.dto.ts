import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsEnum,
} from 'class-validator';
import { Gender } from '@prisma/client';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: 'İsim alanı boş bırakılamaz' })
  firstName: string;

  @IsString()
  @IsNotEmpty({ message: 'Soyisim alanı boş bırakılamaz' })
  lastName: string;

  @IsEmail({}, { message: 'Geçerli bir e-posta adresi giriniz' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(6, { message: 'Şifre en az 6 karakter olmalıdır' })
  password: string;

  @IsString()
  @IsNotEmpty()
  roleId: string;

  @IsString()
  @IsNotEmpty()
  roleName: string;

  // --- DİNAMİK / OPSİYONEL ALANLAR ---

  @IsString()
  @IsOptional()
  studentNumber?: string;

  @IsString()
  @IsOptional()
  staffNumber?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsEnum(Gender, { message: 'Cinsiyet sadece MALE veya FEMALE olabilir' })
  @IsOptional()
  gender?: Gender;
}
