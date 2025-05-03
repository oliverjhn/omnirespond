import type { Route } from "./+types/chat";
import type { Message } from "~/types/db.t";
import { getMessages, createMessage } from "~/api/messages";
import { getChat } from "~/api/chats";
import { Card } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import { Toaster } from "~/components/ui/sonner";
import { toast } from "sonner";
import { useRef, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { redirect, useParams } from "react-router";
import { createClient } from "~/lib/supabase/client";
import { ChatInputForm } from "~/components/chat/ChatInputForm";
import { Button } from "~/components/ui/button";

const supabase = createClient();

// Custom hook to manage chat status
function useChatStatus(chatId: string) {
  const queryClient = useQueryClient();

  const { data: chatStatus = "complete" } = useQuery({
    queryKey: ["chatStatus", chatId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chats")
        .select("chat_status")
        .eq("id", chatId)
        .single();

      if (error) throw error;
      return data.chat_status;
    },
  });

  // Set up real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`chat_status_${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chats",
          filter: `id=eq.${chatId}`,
        },
        (payload) => {
          if (payload.new) {
            queryClient.setQueryData(
              ["chatStatus", chatId],
              payload.new.chat_status
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, queryClient]);

  return chatStatus;
}

// Custom hook to update chat status
function useUpdateChatStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      chatId,
      status,
    }: {
      chatId: string;
      status: "responding" | "complete" | "failed" | "pending";
    }) => {
      const { error } = await supabase
        .from("chats")
        .update({ chat_status: status })
        .eq("id", chatId);

      if (error) throw error;
      return status;
    },
    onMutate: async ({ chatId, status }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["chatStatus", chatId] });

      // Snapshot the previous value
      const previousStatus = queryClient.getQueryData(["chatStatus", chatId]);

      // Optimistically update to the new value
      queryClient.setQueryData(["chatStatus", chatId], status);

      return { previousStatus };
    },
    onError: (err, { chatId }, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousStatus) {
        queryClient.setQueryData(
          ["chatStatus", chatId],
          context.previousStatus
        );
      }
      console.error("Error updating chat status:", err);
    },
  });
}

// Extend Message type to include loading state
type ExtendedMessage = Message & {
  isLoading?: boolean;
};

// Server-side loader to handle invalid chat routes and redirect
export async function loader({ params }: Route.LoaderArgs): Promise<{
  messages: ExtendedMessage[];
  chatId: string;
  chatName?: string;
}> {
  const { workspaceId, chatId } = params;
  if (!workspaceId) {
    throw new Response("Workspace ID is required", { status: 400 });
  }
  if (!chatId) {
    throw new Response("Chat ID is required", { status: 400 });
  }
  console.log("Server Loader, chatId: " + chatId);
  const chat = await getChat(workspaceId, chatId);
  if (!chat) {
    throw redirect(`/workspaces/${workspaceId}?error=chat_not_found`);
  }
  // All validations passed, fetch messages
  const messages = await getMessages(chatId);
  return { messages, chatId, chatName: chat.name };
}

export async function clientLoader({ params }: Route.LoaderArgs): Promise<{
  messages: ExtendedMessage[];
  chatId: string;
  chatName?: string;
}> {
  const { workspaceId, chatId } = params;
  if (!workspaceId) {
    throw new Error("Workspace ID is required");
  }
  if (!chatId) {
    throw new Error("Chat ID is required");
  }
  console.log("Client Loader, chatId: " + chatId);
  const chat = await getChat(workspaceId, chatId);
  if (!chat) {
    throw redirect(`/workspaces/${workspaceId}?error=chat_not_found`);
  }
  const messages = await getMessages(chatId);
  return { messages, chatId, chatName: chat.name };
}
clientLoader.hydrate = false;

const MessageBubble = ({ message }: { message: ExtendedMessage }) => {
  const isAI = message.role === "assistant";

  return (
    <div
      className={cn(
        "flex items-start gap-3 py-4",
        isAI ? "flex-row" : "flex-row-reverse"
      )}
    >
      {isAI ? (
        <div className="px-4 py-3 max-w-[80%]">
          {message.isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <div className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-2 h-2 bg-foreground/50 rounded-full animate-bounce" />
            </div>
          ) : (
            <p className="text-base whitespace-pre-wrap">{message.content}</p>
          )}
        </div>
      ) : (
        <Card className="px-4 py-3 max-w-[80%] bg-muted/50">
          <p className="text-base whitespace-pre-wrap">{message.content}</p>
        </Card>
      )}
    </div>
  );
};

export default function Chat({ loaderData }: Route.ComponentProps) {
  const { messages: initialMessages, chatId, chatName } = loaderData;
  const { workspaceId } = useParams<{ workspaceId: string; chatId: string }>();
  const updateChatStatus = useUpdateChatStatus();
  const chatStatus = useChatStatus(chatId); // Get chat status

  useEffect(() => {
    if (chatName) {
      document.title = chatName;
    }
  }, [chatName]);

  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize query cache with initial messages
  useEffect(() => {
    queryClient.setQueryData(["messages", chatId], initialMessages);
  }, [chatId, initialMessages, queryClient]);

  // Use query to get messages from cache
  const { data: messages = [], isFetched: messagesFetched } = useQuery({
    queryKey: ["messages", chatId],
    queryFn: () => getMessages(chatId),
    initialData: initialMessages,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const mutation = useMutation({
    mutationFn: async (data: {
      prompt?: string;
      conversation: Message[];
      isAutoStart: boolean;
      isRetry: boolean;
    }) => {
      let userMessage: Message | null = null;
      try {
        // Step 1: Create user message ONLY if it's a manual send AND not a retry
        if (!data.isAutoStart && !data.isRetry && data.prompt) {
          userMessage = await createMessage({
            content: data.prompt,
            role: "user",
            chat_id: chatId,
          });
          // Invalidate chats query immediately after user message is created
          queryClient.invalidateQueries({ queryKey: ["chats", workspaceId] });
        }

        // Step 2: Update status and call API
        await updateChatStatus.mutateAsync({ chatId, status: "responding" });
        const apiConversation = data.conversation; // History *before* the new user message
        // If userMessage was just created, add it to the history for the API call
        // Note: The API expects the full history including the triggering query
        const currentQuery =
          data.prompt ||
          (data.isAutoStart ? data.conversation[0]?.content : ""); // Get prompt for API

        const response = await fetch(`${import.meta.env.VITE_API_URL}/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: currentQuery, // Send the actual query content
            workspace_id: workspaceId!,
            conversation: apiConversation.map((msg) => ({
              // Send history before *this* turn
              role: msg.role,
              content: msg.content,
            })),
            model: "gpt-4o-mini",
          }),
        });

        if (!response.ok) {
          await updateChatStatus.mutateAsync({ chatId, status: "failed" });
          throw new Error(`API Error: ${response.statusText}`);
        }
        const responseData = await response.json();

        // Step 3: Create assistant message
        const assistantMessage = await createMessage({
          content: responseData.response,
          role: "assistant",
          chat_id: chatId,
        });

        // Step 4: Update status to complete
        await updateChatStatus.mutateAsync({ chatId, status: "complete" });

        // Return the actual messages created in this mutation run
        return { userMessage, assistantMessage };
      } catch (error) {
        await updateChatStatus.mutateAsync({ chatId, status: "failed" });
        console.error("Error in message mutation:", error);
        // Re-throw error to be caught by onError
        throw error;
      }
    },
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["messages", chatId] });

      // Snapshot the previous value
      const previousMessages = queryClient.getQueryData<ExtendedMessage[]>([
        "messages",
        chatId,
      ]);

      // Generate temporary IDs
      const optimisticUserMessageId =
        !variables.isAutoStart && !variables.isRetry && variables.prompt // Only generate if needed
          ? crypto.randomUUID()
          : null;
      const optimisticLoadingMessageId = crypto.randomUUID();

      // Create optimistic messages
      let optimisticUserMessage: ExtendedMessage | null = null;
      // Only create optimistic user message if it's a manual send and not a retry
      if (optimisticUserMessageId && variables.prompt) {
        optimisticUserMessage = {
          content: variables.prompt,
          role: "user",
          chat_id: chatId,
          id: optimisticUserMessageId,
          created_at: new Date().toISOString(),
        };
      }

      const optimisticLoadingMessage: ExtendedMessage = {
        content: "",
        role: "assistant",
        chat_id: chatId,
        id: optimisticLoadingMessageId,
        created_at: new Date().toISOString(),
        isLoading: true,
      };

      // Optimistically update the cache
      queryClient.setQueryData<ExtendedMessage[]>(
        ["messages", chatId],
        (old = []) => {
          const newMessages = [...old];
          if (optimisticUserMessage) {
            newMessages.push(optimisticUserMessage);
          }
          newMessages.push(optimisticLoadingMessage);
          return newMessages;
        }
      );

      // Return context with temporary IDs
      return {
        previousMessages,
        optimisticUserMessageId,
        optimisticLoadingMessageId,
      };
    },
    onSuccess: (data, variables, context) => {
      // data contains { userMessage, assistantMessage } from mutationFn
      // context contains { previousMessages, optimisticUserMessageId, optimisticLoadingMessageId }
      if (!context) return;

      queryClient.setQueryData<ExtendedMessage[]>(
        ["messages", chatId],
        (old = []) => {
          // Filter out the optimistic messages using their temporary IDs
          const filteredMessages = old.filter(
            (msg) =>
              msg.id !== context.optimisticLoadingMessageId &&
              msg.id !== context.optimisticUserMessageId // Will be null/undefined if auto-start, safe to compare
          );

          // Add the real messages returned from the mutation
          if (data.userMessage) {
            filteredMessages.push(data.userMessage);
          }
          if (data.assistantMessage) {
            filteredMessages.push(data.assistantMessage);
          }
          return filteredMessages;
        }
      );
    },
    onError: (error, variables, context) => {
      // Remove toast.error - rely on inline error/retry UI
      // toast.error(
      //   error instanceof Error
      //     ? error.message
      //     : "An unknown error occurred. Please try again."
      // );
      // Rollback optimistic updates if context exists
      if (context?.previousMessages) {
        queryClient.setQueryData(
          ["messages", chatId],
          context.previousMessages
        );
      }
      // Ensure status is set to failed even if rollback occurs after status update
      // The mutationFn already sets it, but this is a safeguard
      queryClient.setQueryData(["chatStatus", chatId], "failed");
    },
  });

  // useEffect for auto-start
  useEffect(() => {
    if (
      messagesFetched &&
      chatStatus === "pending" &&
      messages.length === 1 &&
      messages[0].role === "user" &&
      !mutation.isPending &&
      !mutation.isSuccess // Prevent re-triggering if mutation just succeeded
    ) {
      console.log("Auto-starting generation for pending chat...");
      // Pass the existing user message as conversation history for the API call
      // The mutationFn will extract the prompt from this if needed
      mutation.mutate({
        conversation: messages, // Pass the single user message
        isAutoStart: true,
        isRetry: false,
      });
    }
    // Add mutation.isSuccess to dependencies to prevent re-trigger after success
  }, [
    chatStatus,
    messages,
    messagesFetched,
    mutation.isPending,
    mutation.isSuccess,
    mutation.mutate,
    chatId,
  ]); // Added mutation.mutate and chatId

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Define the submission handler for the new component
  const handleSendMessage = (prompt: string) => {
    if (mutation.isPending) return; // Should be handled by button state, but double-check

    const sanitizedPrompt = prompt.trim(); // Already trimmed in ChatInputForm, but good practice
    if (sanitizedPrompt.length === 0) return;

    // Trigger the mutation for a manual send
    // Pass the prompt and the current messages as history
    mutation.mutate({
      prompt: sanitizedPrompt,
      conversation: messages, // Pass current messages as history
      isAutoStart: false,
      isRetry: false,
    });

    // Optimistic updates are handled entirely within onMutate
  };

  const handleRetry = () => {
    const lastUserMessage = findLastUserMessage(messages);
    if (!lastUserMessage) return;

    const conversationHistory = getHistoryBeforeMessage(
      messages,
      lastUserMessage.id
    );

    mutation.mutate({
      prompt: lastUserMessage.content, // Add the prompt content
      conversation: conversationHistory,
      isAutoStart: false, // Set to false for retry
      isRetry: true, // Signal that this is a retry
    });
  };

  // Helper function to find the last user message
  const findLastUserMessage = (msgs: Message[]): Message | undefined => {
    return [...msgs].reverse().find((msg) => msg.role === "user");
  };

  // Helper function to get conversation history before a specific message
  const getHistoryBeforeMessage = (
    msgs: Message[],
    messageId: string
  ): Message[] => {
    const index = msgs.findIndex((msg) => msg.id === messageId);
    return index > 0 ? msgs.slice(0, index) : [];
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="max-w-3xl mx-auto space-y-4 pb-36">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
        <div className="p-4 bg-background">
          <div className="max-w-3xl mx-auto">
            {/* Error Message and Retry Button */}
            {chatStatus === "failed" && (
              <div className="flex flex-col items-center justify-center p-4 gap-2">
                <p className="text-sm text-destructive">
                  Failed to get response.
                </p>
                <Button variant="outline" size="sm" onClick={handleRetry}>
                  Retry
                </Button>
              </div>
            )}

            {/* Input Form - disable while responding or if failed */}
            <ChatInputForm
              onSubmit={handleSendMessage}
              isSending={mutation.isPending || chatStatus === "failed"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
