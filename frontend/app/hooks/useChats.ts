import { useState } from "react";
import { createChat, getChats } from "~/api/chats";
import type { Chat } from "~/types/db";

export function useChats(workspaceId: string) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchChats = async () => {
    setIsLoading(true);
    try {
      const fetchedChats = await getChats(workspaceId);
      setChats(fetchedChats);
    } catch (error) {
      console.error("Failed to fetch chats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateChat = async (name: string) => {
    try {
      const newChat = await createChat(workspaceId, name);
      if (newChat) {
        setChats((prev) => [newChat, ...prev]);
        return newChat;
      }
    } catch (error) {
      console.error("Failed to create chat:", error);
    }
    return null;
  };

  return {
    chats,
    isLoading,
    fetchChats,
    createChat: handleCreateChat,
  };
}
