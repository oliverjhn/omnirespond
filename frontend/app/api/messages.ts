import { supabase } from "../lib/supabase";
import type { Message } from "~/types/db";

export const getMessages = async (chatId: string): Promise<Message[]> => {
  try {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching messages:", error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("Unexpected error in getMessages:", error);
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
      console.error("Error creating message:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("Error in createMessage:", error);
    throw error;
  }
};

export const deleteMessage = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase.from("messages").delete().eq("id", id);

    if (error) {
      console.error("Error deleting message:", error);
      throw error;
    }
  } catch (error) {
    console.error("Error in deleteMessage:", error);
    throw error;
  }
};
