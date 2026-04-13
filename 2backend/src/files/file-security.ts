import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
]);

export const MAX_SINGLE_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_MULTI_FILE_COUNT = 5;

export function sanitizeFileName(originalName: string): string {
  const trimmed = originalName.trim();
  const withoutPaths = trimmed.split(/[/\\]/).pop() ?? 'file';
  const normalized = withoutPaths.replace(/[^a-zA-Z0-9._-]/g, '_');
  const collapsed = normalized.replace(/_+/g, '_');
  const safe = collapsed.slice(0, 120);
  return safe.length > 0 ? safe : 'file';
}

export function assertSafeUpload(file: Express.Multer.File | undefined) {
  if (!file) {
    throw new BadRequestException('File is required.');
  }

  if (file.size > MAX_SINGLE_FILE_BYTES) {
    throw new PayloadTooLargeException('File exceeds the 10 MB upload limit.');
  }

  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new BadRequestException('File type is not allowed.');
  }

  const sanitizedName = sanitizeFileName(file.originalname);
  if (!sanitizedName.includes('.')) {
    throw new BadRequestException('File extension is required.');
  }
}

export function buildStorageObjectKey(userId: string, originalName: string): string {
  return `${userId}/${Date.now()}-${sanitizeFileName(originalName)}`;
}
