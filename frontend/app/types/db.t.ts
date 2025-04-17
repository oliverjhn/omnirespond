import type { Tables } from "~/types/supabase-generated";

// Using the shorthand syntax
export type Workspace = Tables<"workspaces">;
export type Message = Tables<"messages">;
export type Chat = Tables<"chats">;
