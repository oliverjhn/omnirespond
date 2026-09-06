import { createClient } from "~/lib/supabase/client";
import type { Chat } from "~/types/db.t";

const supabase = createClient();

export const getChats = async (workspaceId: string): Promise<Chat[]> => {
  try {
    const { data, error } = await supabase
      .from("chats")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching chats:", error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("Unexpected error in getChats:", error);
    return [];
  }
};

export const createChat = async (
  workspaceId: string,
  name?: string
): Promise<Chat | null> => {
  try {
    const insertData: { workspace_id: string; name?: string } = {
      workspace_id: workspaceId,
    };
    if (name) {
      insertData.name = name;
    }

    const { data, error } = await supabase
      .from("chats")
      .insert([insertData])
      .select()
      .single();

    if (error) {
      console.error("Error creating chat:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("Error in createChat:", error);
    return null;
  }
};

export const deleteChat = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase.from("chats").delete().eq("id", id);

    if (error) {
      console.error("Error deleting chat:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error in deleteChat:", error);
  }
};

// Add function to fetch a single chat by workspace and id
export const getChat = async (
  workspaceId: string,
  chatId: string
): Promise<Chat | null> => {
  try {
    const { data, error } = await supabase
      .from("chats")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("id", chatId)
      .single();

    if (error) {
      console.error("Error fetching chat:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("Error in getChat:", error);
    return null;
  }
};

export async function generateChatTitle(
  prompt: string
): Promise<{ title: string }> {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/title`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    throw new Error(`Failed to generate chat title: ${response.statusText}`);
  }

  return response.json();
}
