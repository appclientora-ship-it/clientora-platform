import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const connection = await mysql.createConnection(databaseUrl);

const columns = [
  ["users", "language"],
  ["tenants", "countryCode"],
  ["tenants", "timezone"],
  ["tenants", "defaultLanguage"],
  ["staff", "userId"],
  ["staff", "photoUrl"],
  ["staff", "bio"],
  ["bookings", "completedAt"],
];

try {
  // Recreate the pre-migration state in the disposable CI database.
  for (const [table, column] of columns) {
    await connection.query(`ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``);
  }

  const migration = await readFile(
    new URL("../drizzle/0010_clientora_operations.sql", import.meta.url),
    "utf8",
  );
  const statements = migration
    .split(/-->\\s*statement-breakpoint/g)
    .map((statement) => statement.trim())
    .filter(Boolean);

  // First pass proves missing columns are added; second proves reruns are safe.
  for (let pass = 1; pass <= 2; pass += 1) {
    for (const statement of statements) {
      await connection.query(statement);
    }
  }

  for (const [table, column] of columns) {
    const [rows] = await connection.query(
      "SHOW COLUMNS FROM ?? LIKE ?",
      [table, column],
    );
    if (rows.length !== 1) {
      throw new Error(`Expected ${table}.${column} to exist after migration`);
    }
  }

  console.log("Operations migration passed: fresh-add and repeat-run checks.");
} finally {
  await connection.end();
}
