import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateGenericRequestDto {
  @IsNotEmpty()
  @IsString()
  typeKey!: string; // 🔥 Ünlem eklendi

  @IsNotEmpty()
  @IsString()
  title!: string; // 🔥 Ünlem eklendi

  @IsNotEmpty()
  @IsString()
  description!: string; // 🔥 Ünlem eklendi

  @IsNotEmpty()
  @IsString()
  priority!: string; // 🔥 Ünlem eklendi

  @IsOptional()
  @IsString()
  preferredDate?: string;

  @IsOptional()
  @IsString()
  preferredTime?: string;

  // 🔥 İŞTE NESTJS'İN KAPIDA SİLDİĞİ, BİZİM EKSİK BIRAKTIĞIMIZ ALAN 🔥
  @IsOptional()
  @IsString()
  facultyUserId?: string;
}
