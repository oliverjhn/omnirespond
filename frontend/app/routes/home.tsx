import type { Route } from "./+types/home";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import { Send } from "lucide-react";
import { useState } from "react";
import { cn } from "~/lib/utils";
import { Sidebar } from "~/components/WorkspaceSidebar";
import { ChatSidebar } from "~/components/ChatSidebar";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Omnirespond" },
    { name: "description", content: "RAG-based AI Document Assistant" },
  ];
}

function MessageBubble({ message }: { message: Message }) {
  return (
    <div
      className={cn(
        "px-4 py-2 rounded-lg max-w-[80%] mb-2",
        message.role === "user"
          ? "bg-primary text-primary-foreground ml-auto"
          : "bg-muted"
      )}
    >
      {message.content}
    </div>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: "user" as const, content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [...messages, userMessage].map(({ role, content }) => ({
              role,
              content,
            })),
          }),
        }
      );

      const data = await response.json();
      const assistantMessage = {
        role: "assistant" as const,
        content: data.choices[0].message.content,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen relative">
      <div className="w-8">
        <Sidebar />
      </div>
      <div className="w-64"></div>
      <div className="flex-1 p-4">
        <div className="max-w-3xl mx-auto">
          <div className="mb-20 space-y-4">
            {messages.map((message, i) => (
              <MessageBubble key={i} message={message} />
            ))}
          </div>

          <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm">
            <div className="max-w-3xl mx-auto flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                className="resize-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
              <Button
                onClick={handleSubmit}
                disabled={isLoading || !input.trim()}
                className="self-end"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
