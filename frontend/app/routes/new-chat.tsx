import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useChats } from "~/hooks/useChats";
import { toast } from "sonner";

export default function NewChat() {
  const [prompt, setPrompt] = useState("");
  const navigate = useNavigate();
  const { workspaceId } = useParams();
  const { createChat, isCreating } = useChats(workspaceId || "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isCreating) return;
    try {
      const newChat = await createChat(prompt.trim());
      if (newChat && newChat.id) {
        console.log(newChat);
        navigate(`/workspaces/${workspaceId}/chat/${newChat.id}`, {
          state: { initialPrompt: prompt },
        });
      } else {
        toast.error("Failed to create chat. Please try again.");
      }
    } catch (err) {
      toast.error("Failed to create chat. Please try again.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Send a message..."
              className="w-full p-4 pr-12 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-h-[100px] resize-none"
              required
              disabled={isCreating}
            />
            <button
              type="submit"
              className="absolute bottom-3 right-3 p-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!prompt.trim() || isCreating}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
