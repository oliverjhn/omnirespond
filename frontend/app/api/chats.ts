import { supabase } from "../lib/supabase";
import type { Chat } from "~/types/db";

export const getChats = async (workspaceId: string): Promise<Chat[]> => {
  console.log("🔍 Fetching chats from API...");
  console.log("🔍 Workspace ID:", workspaceId);

  try {
    const { data, error } = await supabase
      .from("chats")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Error fetching chats:", error);
      throw error;
    }

    console.log("✅ Fetched chats count:", data?.length || 0);
    return data || [];
  } catch (error) {
    console.error("❌ Unexpected error in getChats:", error);
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
      console.error("❌ Error creating chat:", error);
      throw error;
    }

    console.log("✅ Created chat:", data);
    return data;
  } catch (error) {
    console.error("❌ Unexpected error in createChat:", error);
    return null;
  }
};

export const deleteChat = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase.from("chats").delete().eq("id", id);

    if (error) {
      console.error("❌ Error deleting chat:", error);
      throw error;
    }

    console.log("✅ Deleted chat:", id);
  } catch (error) {
    console.error("❌ Unexpected error in deleteChat:", error);
  }
};
