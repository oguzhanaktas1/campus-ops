import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { File, FileCategory } from '@prisma/client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../core/prisma/prisma.service';
import { assertSafeUpload, buildStorageObjectKey } from './file-security';

@Injectable()
export class FilesService {
  private readonly supabase: SupabaseClient | null;

  constructor(private readonly prisma: PrismaService) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;
    this.supabase =
      supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
  }

  private getClient(): SupabaseClient {
    if (!this.supabase) {
      throw new InternalServerErrorException(
        'File storage is not configured for signed URL generation.',
      );
    }

    return this.supabase;
  }

  extractObjectPath(storagePath: string): string {
    if (!storagePath) return storagePath;

    if (!/^https?:\/\//i.test(storagePath)) {
      return storagePath;
    }

    try {
      const parsed = new URL(storagePath);
      const markers = ['/object/public/', '/object/sign/', '/object/authenticated/'];
      const matchedMarker = markers.find((marker) => parsed.pathname.includes(marker));

      if (!matchedMarker) {
        return storagePath;
      }

      const pathAfterMarker = parsed.pathname.split(matchedMarker)[1] ?? '';
      const firstSlashIndex = pathAfterMarker.indexOf('/');
      if (firstSlashIndex === -1) {
        return storagePath;
      }

      return decodeURIComponent(pathAfterMarker.slice(firstSlashIndex + 1));
    } catch {
      return storagePath;
    }
  }

  async createSignedUrl(
    file: Pick<File, 'bucketName' | 'storagePath'>,
  ): Promise<string | null> {
    const objectPath = this.extractObjectPath(file.storagePath);
    if (!objectPath || /^https?:\/\//i.test(objectPath)) {
      return null;
    }

    const { data, error } = await this.getClient().storage
      .from(file.bucketName)
      .createSignedUrl(objectPath, 60 * 60);

    if (error || !data?.signedUrl) {
      return null;
    }

    return data.signedUrl;
  }

  async uploadGeneralFile(userId: string, file: Express.Multer.File) {
    assertSafeUpload(file);

    const objectPath = buildStorageObjectKey(userId, file.originalname);

    const UPLOAD_TIMEOUT_MS = 60_000;

    const uploadPromise = this.getClient().storage
      .from('campusops-files')
      .upload(objectPath, file.buffer, { contentType: file.mimetype });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('UPLOAD_TIMEOUT')), UPLOAD_TIMEOUT_MS),
    );

    let result: Awaited<typeof uploadPromise>;
    try {
      result = await Promise.race([uploadPromise, timeoutPromise]);
    } catch (err: any) {
      throw new InternalServerErrorException(
        err?.message === 'UPLOAD_TIMEOUT'
          ? 'File upload timed out. Please try again.'
          : `Supabase Error: ${String(err?.message ?? err)}`,
      );
    }

    if (result.error) {
      throw new InternalServerErrorException(`Supabase Error: ${result.error.message}`);
    }

    const savedFile = await this.prisma.file.create({
      data: {
        storageProvider: 'SUPABASE',
        bucketName: 'campusops-files',
        storagePath: objectPath,
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        fileSizeBytes: file.size,
        fileCategory: FileCategory.DOCUMENT,
        uploadedByUserId: userId,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        actionType: 'UPLOAD',
        entityType: 'File',
        entityId: savedFile.id,
      },
    });

    return savedFile;
  }

  async buildAttachmentResponse(
    file: Pick<
      File,
      'id' | 'originalFileName' | 'fileSizeBytes' | 'mimeType' | 'bucketName' | 'storagePath'
    >,
  ) {
    return {
      id: file.id,
      name: file.originalFileName,
      size: file.fileSizeBytes,
      mimeType: file.mimeType,
      url: await this.createSignedUrl(file),
    };
  }
}
