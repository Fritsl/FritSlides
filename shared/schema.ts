import { pgTable, text, serial, integer, timestamp, jsonb, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table with text ID for Supabase (UUID) compatibility
export const users = pgTable("users", {
  id: text("id").primaryKey(), // Supabase uses UUID strings (text) for user IDs
  username: text("username").notNull().unique(),
  password: text("password"), // Make password nullable for Supabase auth users
  lastOpenedProjectId: integer("lastOpenedProjectId"),
});

// Projects table
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  startSlogan: text("startSlogan"),
  endSlogan: text("endSlogan"),
  author: text("author"),
  lastViewedSlideIndex: integer("lastViewedSlideIndex").default(0),
  isLocked: boolean("isLocked").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// Notes table
export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  projectId: integer("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
  parentId: integer("parentId").references((): any => notes.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  url: text("url"),
  linkText: text("linkText"),
  youtubeLink: text("youtubeLink"),
  time: text("time"),
  isDiscussion: boolean("isDiscussion").default(false),
  images: jsonb("images").$type<string[]>().default([]),
  order: numeric("order", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

// Define schemas for data insertion/validation
export const insertUserSchema = createInsertSchema(users).extend({
  id: z.union([z.number(), z.string().transform(id => parseInt(id, 10))]).optional(), // Handle both string and number IDs
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

export const insertNoteSchema = createInsertSchema(notes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  // Additional flags for optimizing operations (not stored in DB)
  fastCreate: z.boolean().optional(),
});

export const updateProjectSchema = createInsertSchema(projects).omit({
  id: true,
  userId: true,
  createdAt: true,
});

// Special schema just for toggling lock status (to be more explicit in the API)
export const toggleProjectLockSchema = z.object({
  isLocked: z.boolean(),
});

export const updateNoteSchema = createInsertSchema(notes).omit({
  id: true,
  projectId: true,
  createdAt: true,
  updatedAt: true,
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
