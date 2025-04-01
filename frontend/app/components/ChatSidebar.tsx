import { Button } from "~/components/ui/button";
import {
  Sidebar,
  SidebarProvider,
  SidebarContent,
} from "~/components/ui/sidebar";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Separator } from "~/components/ui/separator";
import { MessageSquare, ChevronsUpDown, Plus } from "lucide-react";
import { useWorkspaces } from "~/hooks/useWorkspaces";
import { useWorkspaceStore } from "~/stores/workspaceStore";
import { cn } from "~/lib/utils";
import * as React from "react";
import type { Workspace } from "~/types/workspace";
import { CreateWorkspaceDialog } from "./CreateWorkspaceDialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "~/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";

type Chat = {
  id: string;
  title: string;
};

export function ChatSidebar() {
  const [open, setOpen] = React.useState(false);
  const { workspaces, isLoading, createWorkspace } = useWorkspaces();
  const { selectedWorkspaceId, setSelectedWorkspaceId } = useWorkspaceStore();

  // Set initial workspace when data loads
  React.useEffect(() => {
    if (workspaces.length > 0 && !selectedWorkspaceId) {
      setSelectedWorkspaceId(workspaces[0].id);
    }
  }, [workspaces, selectedWorkspaceId, setSelectedWorkspaceId]);

  // TODO: Replace with actual chat data
  const chats: Chat[] = [];

  return (
    <SidebarProvider>
      <Sidebar className="border-r">
        <SidebarContent>
          <div className="space-y-4 px-4 py-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Workspaces</h2>
            </div>
            <div className="space-y-2">
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                    disabled={isLoading}
                  >
                    {isLoading
                      ? "Loading..."
                      : workspaces.find(
                          (workspace) => workspace.id === selectedWorkspaceId
                        )?.name || "Select workspace..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command
                    filter={(value, search) => {
                      if (value.includes("eightysixrocks")) return 0;
                      const normalizedValue = value.toLowerCase();
                      const normalizedSearch = search.toLowerCase();
                      return normalizedValue.includes(normalizedSearch) ? 1 : 0;
                    }}
                  >
                    <CommandInput placeholder="Search workspace..." />
                    <CommandList>
                      <CommandEmpty>No workspace found.</CommandEmpty>
                      <CommandGroup heading="Workspaces">
                        {workspaces
                          .sort(
                            (a, b) =>
                              new Date(b.updated_at).getTime() -
                              new Date(a.updated_at).getTime()
                          )
                          .map((workspace: Workspace) => (
                            <CommandItem
                              key={workspace.id}
                              value={workspace.name}
                              onSelect={() => {
                                setSelectedWorkspaceId(workspace.id);
                                setOpen(false);
                              }}
                            >
                              {workspace.name}
                            </CommandItem>
                          ))}
                      </CommandGroup>
                      <CommandSeparator />
                      <CommandGroup heading="Actions">
                        <CommandItem
                          value="eightysixrocks!"
                          onSelect={() => null}
                        >
                          <CreateWorkspaceDialog
                            onCreateWorkspace={createWorkspace}
                            isLoading={isLoading}
                          />
                        </CommandItem>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <Separator />
          <div className="flex h-[52px] items-center justify-between px-4 py-2">
            <h2 className="text-lg font-semibold">Chats</h2>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Plus className="h-4 w-4" />
              <span className="sr-only">New chat</span>
            </Button>
          </div>
          <Separator />
          <ScrollArea className="flex-1 p-2">
            <div className="space-y-2">
              {chats.map((chat) => (
                <Button
                  key={chat.id}
                  variant="ghost"
                  className="w-full justify-start gap-2"
                >
                  <MessageSquare className="h-4 w-4" />
                  {chat.title}
                </Button>
              ))}
              {chats.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  No chats yet
                </div>
              )}
            </div>
          </ScrollArea>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  );
}
