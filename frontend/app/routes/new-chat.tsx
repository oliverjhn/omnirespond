import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useChats } from "~/hooks/useChats";
import { createMessage } from "~/api/messages";
import { createChat } from "~/api/chats";
import { toast } from "sonner";
import { ChatInputForm } from "~/components/chat/ChatInputForm";
import type { Chat } from "~/types/db.t"; // Corrected import path

interface CreateChatVariables {
  title: string;
}

export default function NewChat() {
  const navigate = useNavigate();
  const { workspaceId } = useParams();
  const queryClient = useQueryClient();

  const { mutateAsync: createChatMutate, isPending: isCreatingChat } =
    useMutation<Chat | null, Error, CreateChatVariables>({
      mutationFn: async (variables) => {
        if (!workspaceId) {
          toast.error("Workspace ID is missing.");
          throw new Error("Workspace ID is missing.");
        }
        return createChat(workspaceId, variables.title);
      },
      onSuccess: (newChat) => {
        if (newChat) {
          queryClient.invalidateQueries({ queryKey: ["chats", workspaceId] });
          navigate(`/workspaces/${workspaceId}/chat/${newChat.id}`);
        }
      },
      onError: (error) => {
        toast.error("Failed to create chat. Please try again.");
        console.error("Error creating chat:", error);
      },
    });

  const createMessageMutation = useMutation({ mutationFn: createMessage });

  const handleSubmit = async (prompt: string) => {
    if (!workspaceId) {
      toast.error("Workspace ID is missing.");
      return;
    }

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) return;

    try {
      const newChat = await createChatMutate({
        title: trimmedPrompt.substring(0, 50),
      });

      if (newChat) {
        await createMessageMutation.mutateAsync({
          chat_id: newChat.id,
          content: trimmedPrompt,
          role: "user",
        });
      }
    } catch (err) {
      toast.error("Failed to send message. Please try again.");
      console.error("Error sending message:", err);
    }
  };

  const isProcessing = isCreatingChat || createMessageMutation.isPending;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-2xl">
        <ChatInputForm onSubmit={handleSubmit} isSending={isProcessing} />
      </div>
    </div>
  );
}
