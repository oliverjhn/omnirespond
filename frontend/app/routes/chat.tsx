import type { Route } from "./+types/chat";
import type { Message } from "~/types/db.t";
import { getMessages, createMessage } from "~/api/messages";
import { getChat } from "~/api/chats";
import { Card } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import { Toaster } from "~/components/ui/sonner";
import { toast } from "sonner";
import { useRef, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { redirect } from "react-router";

// Extend Message type to include loading state
type ExtendedMessage = Message & {
  isLoading?: boolean;
};

const messageSchema = z.object({
  prompt: z
    .string()
    .min(1, "Message cannot be empty")
    .max(4000, "Message too long"),
});

type MessageFormData = z.infer<typeof messageSchema>;

// API call to process query
const sendMessage = async (
  prompt: string,
  conversation: Message[],
  chatId: string
): Promise<ExtendedMessage[]> => {
  // Create user message in Supabase immediately
  const userMessage = await createMessage({
    content: prompt,
    role: "user",
    chat_id: chatId,
  });

  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: prompt,
        collection_name: "unsorted",
        conversation: conversation.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
        model: "gpt-4o-mini",
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to send message");
    }

    const data = await response.json();

    // Create assistant message in Supabase
    const assistantMessage = await createMessage({
      content: data.response,
      role: "assistant",
      chat_id: chatId,
    });

    return [userMessage, assistantMessage];
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
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

  useEffect(() => {
    if (chatName) {
      document.title = chatName;
    }
  }, [chatName]);

  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize query cache with initial messages
  useEffect(() => {
    queryClient.setQueryData(["messages", chatId], initialMessages);
  }, [chatId, initialMessages, queryClient]);

  // Use query to get messages from cache
  const { data: messages = [] } = useQuery({
    queryKey: ["messages", chatId],
    queryFn: () => getMessages(chatId),
    initialData: initialMessages,
  });

  const {
    register,
    handleSubmit: handleFormSubmit,
    watch,
    reset,
    formState: { isValid },
  } = useForm<MessageFormData>({
    resolver: zodResolver(messageSchema),
    defaultValues: {
      prompt: "",
    },
    mode: "onChange",
  });

  const promptValue = watch("prompt");
  const isValidPrompt = isValid && promptValue?.trim().length > 0;

  const mutation = useMutation({
    mutationFn: (data: MessageFormData) =>
      sendMessage(data.prompt, messages, chatId),
    onMutate: async (data) => {
      // Create optimistic user message and loading message
      const optimisticUserMessage: ExtendedMessage = {
        content: data.prompt,
        role: "user",
        chat_id: chatId,
        id: crypto.randomUUID(), // Temporary ID for optimistic update
        created_at: new Date().toISOString(),
      };

      const optimisticLoadingMessage: ExtendedMessage = {
        content: "",
        role: "assistant",
        chat_id: chatId,
        id: crypto.randomUUID(), // Temporary ID for optimistic update
        created_at: new Date().toISOString(),
        isLoading: true,
      };

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["messages", chatId] });

      // Snapshot the previous value
      const previousMessages = queryClient.getQueryData<ExtendedMessage[]>([
        "messages",
        chatId,
      ]);

      // Optimistically update to the new value
      queryClient.setQueryData<ExtendedMessage[]>(
        ["messages", chatId],
        (old = []) => [...old, optimisticUserMessage, optimisticLoadingMessage]
      );

      // Return a context object with the snapshotted value
      return {
        previousMessages,
        optimisticUserMessage,
        optimisticLoadingMessage,
      };
    },
    onSuccess: (newMessages, _, context) => {
      if (!context) return;

      // Replace optimistic messages with real ones from Supabase
      queryClient.setQueryData<ExtendedMessage[]>(
        ["messages", chatId],
        (old = []) => {
          if (!old) return newMessages;
          return old.map((msg) => {
            // Replace optimistic user message
            if (msg.id === context.optimisticUserMessage.id) {
              return newMessages[0];
            }
            // Replace optimistic loading message
            if (msg.id === context.optimisticLoadingMessage.id) {
              return newMessages[1];
            }
            return msg;
          });
        }
      );
      reset();

      // Reset textarea height after submission
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      // Scroll to bottom after adding a new message
      setTimeout(() => scrollToBottom(), 100);
    },
    onError: (error, _, context) => {
      if (context) {
        // Restore previous messages on error
        queryClient.setQueryData(
          ["messages", chatId],
          context.previousMessages
        );
      }
      toast.error(
        error instanceof Error
          ? error.message
          : "Error sending message. Please try again."
      );
    },
  });

  // Function to scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize textarea as user types
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const adjustHeight = () => {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    };

    textarea.addEventListener("input", adjustHeight);
    return () => textarea.removeEventListener("input", adjustHeight);
  }, []);

  const onSubmit = handleFormSubmit(async (data) => {
    if (mutation.isPending) return; // Prevent multiple submissions

    // Sanitize input - trim whitespace
    const sanitizedPrompt = data.prompt.trim();

    if (sanitizedPrompt.length === 0) return;

    try {
      await mutation.mutateAsync(data);
    } catch {
      // Error is handled in mutation.onError
    }
  });

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
        <div className="fixed bottom-6 left-0 right-0 px-4">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={onSubmit} className="flex flex-col gap-2">
              <div className="flex gap-2 bg-background shadow-[0_0_15px_rgba(0,0,0,0.1)] rounded-lg p-2">
                <div className="flex-1">
                  <Textarea
                    {...register("prompt")}
                    ref={(e) => {
                      if (e) {
                        register("prompt").ref(e);
                        textareaRef.current = e;
                      }
                    }}
                    placeholder="Type your message... (Press Shift + Enter for new line)"
                    className="border-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent resize-none min-h-[44px] max-h-[300px] overflow-y-auto"
                    disabled={mutation.isPending}
                    rows={1}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        !e.shiftKey &&
                        isValidPrompt &&
                        !mutation.isPending
                      ) {
                        e.preventDefault();
                        onSubmit();
                      }
                    }}
                    aria-label="Message input"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={mutation.isPending || !isValidPrompt}
                  variant={isValidPrompt ? "default" : "secondary"}
                  className="self-end"
                  aria-label="Send message"
                >
                  {mutation.isPending ? "Sending..." : "Send"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
