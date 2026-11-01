import crypto from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

let client: S3Client | undefined;

function getStorage() {
  const { s3Bucket, s3AccessKeyId, s3SecretAccessKey } = ENV;
  if (!s3Bucket || !s3AccessKeyId || !s3SecretAccessKey) {
    throw new Error("Clientora file storage is not configured. Set S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.");
  }
  if (!client) {
    client = new S3Client({
      region: ENV.s3Region,
      ...(ENV.s3Endpoint ? { endpoint: ENV.s3Endpoint } : {}),
      forcePathStyle: ENV.s3ForcePathStyle,
      credentials: { accessKeyId: s3AccessKeyId, secretAccessKey: s3SecretAccessKey },
    });
  }
  return { client, bucket: s3Bucket };
}

function normalizeKey(value: string): string {
  const key = value.replace(/^\/+/, "").replace(/\\/g, "/");
  if (!key || key.split("/").some(part => part === "." || part === "..") || key.includes("\0")) {
    throw new Error("Invalid storage key");
  }
  return key;
}

function uniqueKey(value: string): string {
  const key = normalizeKey(value);
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  const dot = key.lastIndexOf(".");
  return dot > key.lastIndexOf("/") ? `${key.slice(0, dot)}_${suffix}${key.slice(dot)}` : `${key}_${suffix}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const { client, bucket } = getStorage();
  const key = uniqueKey(relKey);
  const body = typeof data === "string" ? Buffer.from(data) : data;
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
  return { key, url: await storageGetSignedUrl(key) };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: await storageGetSignedUrl(key) };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const { client, bucket } = getStorage();
  const key = normalizeKey(relKey);
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 900 });
}
