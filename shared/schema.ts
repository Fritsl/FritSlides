import { pgTable, text, serial, integer, timestamp, jsonb, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table with integer ID based on actual Supabase table structure
export const users = pgTable("users", {
  id: integer("id").primaryKey(), // Supabase is using integer IDs, not UUID strings
  username: text("username").notNull().unique(),
  password: text("password"), // For Supabase auth users
  lastOpenedProjectId: integer("lastOpenedProjectId"),
});

// Projects table matching actual Supabase structure
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  startSlogan: text("startSlogan"),
  endSlogan: text("endSlogan"),
  author: text("author"),
  lastViewedSlideIndex: integer("lastViewedSlideIndex").default(0),
  isLocked: boolean("isLocked").default(false).notNull(),
  // Removed createdAt as it doesn't exist in the actual Supabase table
});

// Notes table matching actual Supabase structure
export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  projectId: integer("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
  parentId: integer("parentId").references((): any => notes.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  url: text("url"),
  linkText: text("linkText"),
  youtubeLink: text("youtubeLink"),
  time: text("time"),
  isDiscussion: boolean("isDiscussion"),
  images: jsonb("images").$type<string[]>(),
  order: integer("order"), // Changed from numeric to integer based on Supabase test results
  // Removed createdAt and updatedAt as they don't exist in the actual Supabase table
});

// Define schemas for data insertion/validation
export const insertUserSchema = createInsertSchema(users).extend({
  // ID is now a number, not a UUID string
  id: z.number().optional(), 
  password: z.string().nullable().optional() // Make password optional for Supabase auth
});

export const insertProjectSchema = createInsertSchema(projects).pick({
  userId: true,
  name: true,
  startSlogan: true,
  endSlogan: true,
  author: true,
  isLocked: true,
});

export const insertNoteSchema = z.object({
  projectId: z.number(),
  parentId: z.number().nullable().optional(),
  content: z.string(),
  url: z.string().nullable().optional(),
  linkText: z.string().nullable().optional(),
  youtubeLink: z.string().nullable().optional(),
  time: z.string().nullable().optional(),
  isDiscussion: z.boolean().nullable().optional(),
  images: z.array(z.string()).nullable().optional(),
  order: z.union([
    z.number(), 
    z.string().transform(val => parseFloat(val) || 0)
  ]).nullable().optional(),
  // Additional flags for optimizing operations (not stored in DB)
  fastCreate: z.boolean().optional(),
});

export const updateProjectSchema = createInsertSchema(projects).omit({
  id: true,
  userId: true,
});

// Special schema just for toggling lock status (to be more explicit in the API)
export const toggleProjectLockSchema = z.object({
  isLocked: z.boolean(),
});

export const updateNoteSchema = z.object({
  parentId: z.number().nullable().optional(),
  content: z.string().optional(),
  url: z.string().nullable().optional(),
  linkText: z.string().nullable().optional(),
  youtubeLink: z.string().nullable().optional(),
  time: z.string().nullable().optional(),
  isDiscussion: z.boolean().nullable().optional(),
  images: z.array(z.string()).nullable().optional(),
  order: z.union([
    z.number(), 
    z.string().transform(val => parseFloat(val) || 0)
  ]).nullable().optional(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type UpdateProject = z.infer<typeof updateProjectSchema>;
export type ToggleProjectLock = z.infer<typeof toggleProjectLockSchema>;
export type Project = typeof projects.$inferSelect;

export type InsertNote = z.infer<typeof insertNoteSchema>;
export type UpdateNote = z.infer<typeof updateNoteSchema>;
export type Note = typeof notes.$inferSelect;
