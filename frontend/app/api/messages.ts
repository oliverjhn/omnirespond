import { supabase } from "../lib/supabase";
import type { Message } from "~/types/db";

export const getMessages = async (chatId: string): Promise<Message[]> => {
  console.log("🔍 Fetching messages from API...");
  console.log("🔍 Chat ID:", chatId, "Type:", typeof chatId);
  
  try {
    // Log the raw query for debugging
    console.log(`Running query: SELECT * FROM messages WHERE chat_id = '${chatId}' ORDER BY created_at ASC`);
    
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("❌ Error fetching messages:", error);
      throw error;
    }

    console.log("✅ Fetched messages count:", data?.length || 0);
    return data || [];
  } catch (error) {
    console.error("❌ Unexpected error in getMessages:", error);
    return [];
  }
};

export const createMessage = async (
  message: Pick<Message, "chat_id" | "content" | "role">
): Promise<Message> => {
  try {
    const { data, error } = await supabase
      .from("messages")
      .insert([message])
      .select()
      .single();

    if (error) {
      console.error("❌ Error creating message:", error);
      throw error;
    }

    console.log("✅ Created message:", data);
    return data;
  } catch (error) {
    console.error("❌ Unexpected error in createMessage:", error);
    throw error;
  }
};

export const deleteMessage = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase.from("messages").delete().eq("id", id);

    if (error) {
      console.error("❌ Error deleting message:", error);
      throw error;
    }

    console.log("✅ Deleted message:", id);
  } catch (error) {
    console.error("❌ Unexpected error in deleteMessage:", error);
    throw error;
  }
};
