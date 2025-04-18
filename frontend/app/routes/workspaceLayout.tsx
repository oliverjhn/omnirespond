import { Outlet, useSearchParams } from "react-router";
import { ChatSidebar } from "~/components/ChatSidebar";
import type { Route } from "./+types/workspaceLayout";
import type { Workspace, Chat } from "~/types/db.t";
import { getWorkspace, getWorkspaces } from "~/api/workspaces";
import { Sidebar } from "~/components/Sidebar";
import { getChats } from "~/api/chats";
import { redirect } from "react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

// implement auth in 'loader' function later

export async function clientLoader({ params }: Route.LoaderArgs): Promise<{
  currentWorkspace: Workspace;
  workspaceChats: Chat[];
  allWorkspaces: Workspace[];
}> {
  const { workspaceId } = params;

  if (!workspaceId) {
    throw new Error("Workspace ID is required");
  }
  const [currentWorkspace, allWorkspaces, workspaceChats] = await Promise.all([
    getWorkspace(workspaceId),
    getWorkspaces(),
    getChats(workspaceId),
  ]);

  if (!currentWorkspace) {
    // redirect with error param to show toast on Workspaces page
    throw redirect("/workspaces?error=workspace_not_found");
  }
  if (!workspaceChats) {
    throw new Response("Chats not found", { status: 404 });
  }
  if (!allWorkspaces) {
    throw new Response("Workspaces not found", { status: 404 });
  }

  return { currentWorkspace, workspaceChats, allWorkspaces };
}

export default function WorkspaceLayout({ loaderData }: Route.ComponentProps) {
  const { currentWorkspace, workspaceChats, allWorkspaces } = loaderData;
  const [searchParams, setSearchParams] = useSearchParams();
  const error = searchParams.get("error");
  const shownToast = useRef(false);
  useEffect(() => {
    if (error === "chat_not_found" && !shownToast.current) {
      shownToast.current = true;
      toast.error("Chat not found");
      const params = new URLSearchParams(searchParams);
      params.delete("error");
      setSearchParams(params, { replace: true });
    } else if (error !== "chat_not_found") {
      shownToast.current = false;
    }
  }, [error, searchParams, setSearchParams]);

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
