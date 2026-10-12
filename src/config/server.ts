import { z } from "zod";

const envSchema = z.object({
  // Add your server-side environment variables here.
});

export const env = envSchema.parse(process.env);
