import { Outlet } from "react-router";
import { ChatSidebar } from "~/components/ChatSidebar";
import type { Route } from "../+types/root";
import type { Workspace, Chat } from "~/types/db";
import { getWorkspace, getWorkspaces } from "~/api/workspaces";
import { Sidebar } from "~/components/Sidebar";
import { getChats } from "~/api/chats";

export async function loader({ params }: Route.LoaderArgs): Promise<{
  currentWorkspace: Workspace;
  workspaceChats: Chat[];
  allWorkspaces: Workspace[];
}> {
  const { workspaceId } = params;
  // implement auth here later

  if (!workspaceId) {
    throw new Error("Workspace ID is required");
  }
  const [currentWorkspace, allWorkspaces, workspaceChats] = await Promise.all([
    getWorkspace(workspaceId),
    getWorkspaces(),
    getChats(workspaceId),
  ]);

  if (!currentWorkspace) {
    throw new Response("Workspace not found", { status: 404 });
  }
  if (!workspaceChats) {
    throw new Response("Chats not found", { status: 404 });
  }
  if (!allWorkspaces) {
    throw new Response("Workspaces not found", { status: 404 });
  }

  return { currentWorkspace, workspaceChats, allWorkspaces };
}

type LoaderData = {
  currentWorkspace: Workspace;
  workspaceChats: Chat[];
  allWorkspaces: Workspace[];
};

export default function WorkspaceLayout({
  loaderData,
}: {
  loaderData: LoaderData;
}) {
  const { currentWorkspace, workspaceChats, allWorkspaces } = loaderData;

  return (
    <div className="flex h-screen">
      <div className="flex flex-1 overflow-hidden">
        <div className="flex">
          <Sidebar />
          <div>
            <ChatSidebar chats={workspaceChats} workspaces={allWorkspaces} />
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <h1 className="text-2xl font-bold p-4">{currentWorkspace.name}</h1>
          <div className="flex-1 overflow-auto">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
