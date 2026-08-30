import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { dirname, extname, join } from 'path';
import { randomUUID } from 'crypto';

export type StoredFile = {
  /** Storage key. For S3 this is the object key; for local disk, the path under uploads/. */
  key: string;
  /** What the client should use to fetch the file back. */
  url: string;
};

const LOCAL_ROOT = 'uploads';

/**
 * File storage for uploaded documents.
 *
 * PaaS hosts (Render, Railway, Fly, Heroku) give containers an ephemeral
 * filesystem: anything written to local disk is destroyed on the next restart
 * or deploy. Storing voucher attachments there loses them silently, so in
 * production this service requires S3-compatible object storage and refuses to
 * start without it. Local disk stays available for development only.
 *
 * Works with any S3-compatible provider — AWS S3, Cloudflare R2, DigitalOcean
 * Spaces, Backblaze B2, MinIO — via STORAGE_ENDPOINT.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucket = process.env.STORAGE_BUCKET ?? '';
  private readonly client: S3Client | null;

  constructor() {
    this.client = this.bucket ? this.createClient() : null;
  }

  onModuleInit() {
    if (this.isRemote) {
      this.logger.log(`File storage: S3-compatible bucket "${this.bucket}"`);
      return;
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'STORAGE_BUCKET is not set. In production, uploads must go to S3-compatible object storage — ' +
          'a container filesystem is wiped on every restart and deploy, which would destroy uploaded ' +
          'documents silently. See DEPLOYMENT.md for the STORAGE_* variables.',
      );
    }

    this.logger.warn(
      'File storage: local disk (development only). Uploads will not survive a container restart.',
    );
  }

  get isRemote(): boolean {
    return this.client !== null;
  }

  async put(
    prefix: string,
    file: { originalname: string; buffer: Buffer; mimetype?: string },
  ): Promise<StoredFile> {
    const key = `${prefix}/${Date.now()}-${randomUUID()}${extname(file.originalname)}`;

    if (this.client) {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
      return { key, url: `/files/${encodeURIComponent(key)}` };
    }

    const target = join(process.cwd(), LOCAL_ROOT, key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.buffer);
    return { key, url: `/${LOCAL_ROOT}/${key}` };
  }

  /**
   * A short-lived signed URL for a stored object. Attachments are financial
   * records, so the bucket stays private and links expire rather than being
   * publicly readable.
   */
  async signedUrl(key: string, expiresInSeconds = 300): Promise<string> {
    if (!this.client) {
      return `/${LOCAL_ROOT}/${key}`;
    }

    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    );
  }

  async remove(key: string): Promise<void> {
    if (this.client) {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
      return;
    }

    await unlink(join(process.cwd(), LOCAL_ROOT, key)).catch(() => undefined);
  }

  private createClient(): S3Client {
    const endpoint = process.env.STORAGE_ENDPOINT;
    return new S3Client({
      region: process.env.STORAGE_REGION ?? 'auto',
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      ...(process.env.STORAGE_ACCESS_KEY_ID && process.env.STORAGE_SECRET_ACCESS_KEY
        ? {
            credentials: {
              accessKeyId: process.env.STORAGE_ACCESS_KEY_ID,
              secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY,
            },
          }
        : {}),
    });
  }
}
