import { z } from "zod";

/** Validates a real calendar date in the API's YYYY-MM-DD format. */
export const bookingDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, { message: "تاريخ غير صحيح؛ استخدم صيغة YYYY-MM-DD" });
