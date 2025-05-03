import { Outlet, useSearchParams } from "react-router";
import { ChatSidebar } from "~/components/ChatSidebar";
import type { Route } from "./+types/workspace-layout";
import type { Workspace, Chat } from "~/types/db.t";
import { getWorkspace, getWorkspaces } from "~/api/workspaces";
import { getChats } from "~/api/chats";
import { redirect } from "react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { WorkspaceSidebar } from "~/components/WorkspaceSidebar";
import type { ShouldRevalidateFunctionArgs } from "react-router";

// implement auth in 'loader' function later

/*
export async function clientLoader({ params }: Route.LoaderArgs): Promise<{
  currentWorkspace: Workspace;
  workspaceChats: Chat[];
  allWorkspaces: Workspace[];
}> {
  const { workspaceId } = params;

  if (!workspaceId) {
    throw new Error("Workspace ID is required");
  }
  console.log("Workspace Layout Loader: Fetching data for workspace", workspaceId);
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
clientLoader.hydrate = false;
*/

/*
export function shouldRevalidate({
  currentParams,
  nextParams,
  defaultShouldRevalidate
}: ShouldRevalidateFunctionArgs) {
  console.log(
    `shouldRevalidate - Current: ${currentParams.workspaceId}, Next: ${nextParams.workspaceId}`
  );
  const workspaceChanged = currentParams.workspaceId !== nextParams.workspaceId;
  console.log(`shouldRevalidate - Workspace changed: ${workspaceChanged}`);

  // If workspace hasn't changed, definitely don't revalidate
  if (!workspaceChanged) {
    console.log("shouldRevalidate - Returning false (workspace unchanged)");
    return false;
  }

  // Otherwise, defer to the default behavior
  console.log("shouldRevalidate - Returning default behavior (workspace changed)");
  return defaultShouldRevalidate;
}
*/

export default function WorkspaceLayout() {
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
        <div className="h-full">
          <ChatSidebar />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            <Outlet />
          </div>
        </div>
        <div className="h-full">
          <WorkspaceSidebar />
        </div>
      </div>
    </div>
  );
}
