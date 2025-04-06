import { Outlet, useParams } from "react-router";
import { ChatSidebar } from "~/components/ChatSidebar";
import type { Route } from "../+types/root";
// import type { Message } from "~/types/workspace";
import type { Message } from "~/types/db";
import { Sidebar } from "~/components/Sidebar";
import { getMessages } from "~/api/messages";

export async function loader({
  params,
}: Route.LoaderArgs): Promise<{ messages: Message[] }> {
  const { chatId } = params;
  // implement auth here later

  if (!chatId) {
    throw new Error("Chat ID is required");
  }
  const messages = await getMessages(chatId);
  if (!messages) {
    throw new Response("Messages not found", { status: 404 });
  }
  return { messages };
}

type LoaderData = {
  messages: Message[];
};

export default function Chat({ loaderData }: { loaderData: LoaderData }) {
  const { messages } = loaderData;

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        <h1 className="text-2xl font-bold p-4">{messages[0].content}</h1>
      </div>
    </div>
  );
}
