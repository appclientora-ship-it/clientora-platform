// Clientora runtime configuration. No Manus or external platform credentials.
export const ENV = {
  get databaseUrl() { return process.env.DATABASE_URL ?? ""; },
  get ownerOpenId() { return process.env.OWNER_OPEN_ID ?? ""; },
  get isProduction() { return process.env.NODE_ENV === "production"; },
  get s3Endpoint() { return process.env.S3_ENDPOINT ?? ""; },
  get s3Region() { return process.env.S3_REGION || "auto"; },
  get s3Bucket() { return process.env.S3_BUCKET ?? ""; },
  get s3AccessKeyId() { return process.env.S3_ACCESS_KEY_ID ?? ""; },
  get s3SecretAccessKey() { return process.env.S3_SECRET_ACCESS_KEY ?? ""; },
  get s3ForcePathStyle() { return process.env.S3_FORCE_PATH_STYLE === "true"; },
};
