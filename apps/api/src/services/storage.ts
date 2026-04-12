import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../lib/config';

let r2: S3Client | null = null;

function getR2(): S3Client {
  if (!r2) {
    if (!config.r2AccountId || !config.r2AccessKeyId || !config.r2SecretAccessKey) {
      throw new Error('R2 credentials not configured');
    }
    r2 = new S3Client({
      region: 'auto',
      endpoint: `https://${config.r2AccountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.r2AccessKeyId,
        secretAccessKey: config.r2SecretAccessKey,
      },
    });
  }
  return r2;
}

export async function uploadToR2(buffer: Buffer, key: string, contentType: string): Promise<string> {
  const bucket = config.r2BucketName;
  if (!bucket) throw new Error('R2_BUCKET_NAME not configured');

  await getR2().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return `${config.r2PublicUrl}/${key}`;
}

export async function uploadUrlToR2(url: string, key: string, contentType: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch URL: ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  return uploadToR2(buffer, key, contentType);
}

export async function getSignedDownloadUrl(key: string): Promise<string> {
  const bucket = config.r2BucketName;
  if (!bucket) throw new Error('R2_BUCKET_NAME not configured');

  return getSignedUrl(
    getR2(),
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 900 } // 15 minutes
  );
}

export function keyFromUrl(url: string): string {
  const publicUrl = config.r2PublicUrl ?? '';
  return url.replace(`${publicUrl}/`, '');
}
