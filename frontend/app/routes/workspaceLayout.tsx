import { Outlet } from "react-router";
import { ChatSidebar } from "~/components/ChatSidebar";
import type { Route } from "../+types/root";
import type { Workspace } from "~/types/db";
import { getWorkspace } from "~/api/workspaces";
import { Sidebar } from "~/components/Sidebar";

export async function loader({
  params,
}: Route.LoaderArgs): Promise<{ currentWorkspace: Workspace }> {
  const { workspaceId } = params;
  // implement auth here later

  if (!workspaceId) {
    throw new Error("Workspace ID is required");
  }
  const currentWorkspace = await getWorkspace(workspaceId);
  if (!currentWorkspace) {
    throw new Response("Workspace not found", { status: 404 });
  }
  return { currentWorkspace };
}

type LoaderData = {
  currentWorkspace: Workspace;
};

export default function WorkspaceLayout({
  loaderData,
}: {
  loaderData: LoaderData;
}) {
  const { currentWorkspace } = loaderData;

  return (
    <div className="flex h-screen">
      {/* Main layout container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left navigation area with auto widths */}
        <div className="flex">
          {/* The Sidebar component will take its natural width */}
          <Sidebar />
          {/* The ChatSidebar will take its natural width with a border */}
          <div>
            <ChatSidebar />
          </div>
        </div>

        {/* Content area that takes remaining space */}
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
