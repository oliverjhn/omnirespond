import { supabase } from "../lib/supabase";
import type { Chat } from "~/types/db";

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
  name: string
): Promise<Chat | null> => {
  try {
    const { data, error } = await supabase
      .from("chats")
      .insert([{ workspace_id: workspaceId, name }])
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
