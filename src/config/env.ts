import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  GROQ_API_KEY: z.string().min(1, "GROQ_API_KEY is required in .env"),
  PORT: z.coerce.number().default(4000),
  FRONTEND_ORIGIN: z.string().url().default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "production"]).default("development"),
});

export const env = envSchema.parse(process.env);