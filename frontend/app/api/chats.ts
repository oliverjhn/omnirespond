import { createClient } from "~/lib/supabase/client";
import type { Chat } from "~/types/db.t";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";

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
  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

  if (!API_KEY) {
    console.error("Gemini API key (VITE_GEMINI_API_KEY) is missing.");
    throw new Error("API key configuration error.");
  }

  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
    ],
  });

  const titleGenerationPrompt = `Based on the following user query, suggest a very concise (3-5 words) chat title. Only return the title text itself, do not include any other explanatory text, quotation marks, or labels like "Title:".\n\nUser Query: "${prompt}"`;

  try {
    const result = await model.generateContent(titleGenerationPrompt);
    const response = result.response;
    const generatedTitle = response.text().trim();

    if (!generatedTitle) {
      console.error(
        "Gemini API returned an empty title or invalid response:",
        response
      );
      throw new Error(
        "Failed to parse title from Gemini response (empty title)."
      );
    }

    const cleanedTitle = generatedTitle.replace(/^"|"$/g, "").trim();

    if (!cleanedTitle) {
      console.error(
        "Cleaned title is empty after processing Gemini response:",
        generatedTitle
      );
      throw new Error("Generated title was empty after cleaning.");
    }

    return { title: cleanedTitle };
  } catch (error) {
    console.error("Failed to generate chat title via Gemini SDK:", error);
    if (error instanceof Error && error.message.includes("SAFETY")) {
      console.warn("Title generation blocked by safety settings.");
      throw new Error("Title generation blocked by safety settings.");
    }
    throw error;
  }
}
