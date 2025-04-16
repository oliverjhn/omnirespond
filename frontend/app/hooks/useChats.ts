import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createChat, getChats, deleteChat } from "~/api/chats";
import type { Chat } from "~/types/db";
import { supabase } from "~/lib/supabase";
import React from "react";

export function useChats(workspaceId: string, initialChats: Chat[] = []) {
  const queryClient = useQueryClient();

  const chatsQuery = useQuery({
    queryKey: ["chats", workspaceId] as const,
    queryFn: () => getChats(workspaceId),
    staleTime: 1000 * 60, // 1 minute
    initialData: initialChats,
  });

  // Set up real-time subscription
  React.useEffect(() => {
    const channel = supabase
      .channel("chats_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chats",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["chats", workspaceId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, workspaceId]);

  const createChatMutation = useMutation({
    mutationFn: (name: string) => createChat(workspaceId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chats", workspaceId] });
    },
    onError: (error: Error) => {
      console.error("Error creating chat:", error);
    },
  });

  const deleteChatMutation = useMutation({
    mutationFn: (chatId: string) => deleteChat(chatId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chats", workspaceId] });
    },
    onError: (error: Error) => {
      console.error("Error deleting chat:", error);
    },
  });

  return {
    chats: chatsQuery.data ?? [],
    isLoading: chatsQuery.isLoading,
    isError: chatsQuery.isError,
    error: chatsQuery.error,
    createChat: createChatMutation.mutateAsync,
    deleteChat: deleteChatMutation.mutate,
    isCreating: createChatMutation.isPending,
    isDeleting: deleteChatMutation.isPending,
  };
}
