import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { File } from '@prisma/client';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class FilesService {
  private readonly supabase: SupabaseClient | null;

  constructor() {
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
      .createSignedUrl(objectPath, 60 * 10);

    if (error || !data?.signedUrl) {
      return null;
    }

    return data.signedUrl;
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
