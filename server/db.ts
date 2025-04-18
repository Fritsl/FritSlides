import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@shared/schema";

// Create connection string
const connectionString = process.env.DATABASE_URL!;

// Create postgres client
export const client = postgres(connectionString);

// Create drizzle database instance
export const db = drizzle(client, { schema });