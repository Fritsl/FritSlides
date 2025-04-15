import { InsertNote, insertNoteSchema } from "@shared/schema";
import { z } from "zod";

// Define the shape of an imported note from the JSON file
export interface ImportedNote {
  id: number;
  content: string;
  position?: number;
  order?: string | number;
  parentId?: number | null;
  url?: string | null;
  linkText?: string | null;
  youtubeLink?: string | null;
  time?: string | null;
  time_set?: string | null; // For compatibility with the demo format
  youtube_url?: string | null; // For compatibility with the demo format
  url_display_text?: string | null; // For compatibility with the demo format
  images?: string[];
  children?: ImportedNote[]; // For nested notes in import format
}

// Define the shape of the entire import data
export interface ImportData {
  project?: {
    name?: string;
  };
  notes: ImportedNote[];
}

// Create a schema to validate the converted note
const noteConversionSchema = insertNoteSchema.extend({
  projectId: z.number(),
  parentId: z.number().nullable().default(null),
  content: z.string().default("Imported note"),
  url: z.string().nullable().default(null),
  linkText: z.string().nullable().default(null),
  youtubeLink: z.string().nullable().default(null),
  time: z.string().nullable().default(null),
  images: z.array(z.string()).default([]),
  order: z.string().default("0")
});

// Helper function to convert an imported note to insert format
export function convertImportedNoteToInsert(
  note: ImportedNote, 
  projectId: number
): InsertNote {
  // Prepare the data with our type conversions
  const preparedData = {
    projectId,
    parentId: null, // This will be updated in a second pass
    content: typeof note.content === 'string' ? note.content : "Imported note",
    url: typeof note.url === 'string' ? note.url : 
         typeof note.youtube_url === 'string' ? note.youtube_url : null,
    linkText: typeof note.linkText === 'string' ? note.linkText : 
              typeof note.url_display_text === 'string' ? note.url_display_text : null,
    youtubeLink: typeof note.youtubeLink === 'string' ? note.youtubeLink : 
                 typeof note.youtube_url === 'string' ? note.youtube_url : null,
    time: typeof note.time === 'string' ? note.time : 
          typeof note.time_set === 'string' ? note.time_set : null,
    images: Array.isArray(note.images) ? 
            note.images.filter((i: unknown) => typeof i === 'string') as string[] : 
            [],
    order: typeof note.order === 'string' || typeof note.order === 'number' ? 
           String(note.order) : 
           typeof note.position === 'number' ? 
           String(note.position) : 
           "0"
  };
  
  try {
    // Validate and return the data through our schema
    return noteConversionSchema.parse(preparedData);
  } catch (error) {
    console.error("Error converting note to insert format:", error);
    console.error("Problematic note data:", JSON.stringify(note));
    console.error("Prepared data:", JSON.stringify(preparedData));
    
    try {
      // Return a fallback with minimal required properties
      return noteConversionSchema.parse({
        projectId,
        content: "Import error - could not parse note content",
        parentId: null,
        order: "0",
        isDiscussion: false,
        images: []
      });
    } catch (fallbackError) {
      console.error("Even fallback processing failed:", fallbackError);
      // Last resort fallback
      return {
        projectId,
        content: "Import error",
        parentId: null,
        order: "0",
        isDiscussion: false,
        images: []
      } as unknown as InsertNote;
    }
  }
}