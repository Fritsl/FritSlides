import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull().references(() => users.id),
  name: text("name").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const insertProjectSchema = createInsertSchema(projects).pick({
  userId: true,
  name: true,
});

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  projectId: integer("projectId").notNull().references(() => projects.id),
  parentId: integer("parentId"),
  content: text("content").notNull(),
  url: text("url"),
  linkText: text("linkText"),
  youtubeLink: text("youtubeLink"),
  time: text("time"),
  images: jsonb("images").$type<string[]>().default([]),
  order: integer("order").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const insertNoteSchema = createInsertSchema(notes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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
export type Project = typeof projects.$inferSelect;

export type InsertNote = z.infer<typeof insertNoteSchema>;
export type UpdateNote = z.infer<typeof updateNoteSchema>;
export type Note = typeof notes.$inferSelect;
