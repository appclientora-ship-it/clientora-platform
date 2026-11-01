// Clientora runtime configuration. No external platform credentials are required.
export const ENV = {
  get databaseUrl() { return process.env.DATABASE_URL ?? ""; },
  get ownerOpenId() { return process.env.OWNER_OPEN_ID ?? ""; },
  get isProduction() { return process.env.NODE_ENV === "production"; },
};
