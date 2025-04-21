import { Button } from "~/components/ui/button";
import {
  Sidebar,
  SidebarProvider,
  SidebarContent,
} from "~/components/ui/sidebar";
import { Separator } from "~/components/ui/separator";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
  MessageSquare,
  ChevronsUpDown,
  Plus,
  Trash2,
  Sun,
  Moon,
} from "lucide-react";
import { useWorkspaces } from "~/hooks/useWorkspaces";
import { useChats } from "~/hooks/useChats";
import { cn } from "~/lib/utils";
import * as React from "react";
import type { Workspace, Chat } from "~/types/db.t";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "~/components/ui/context-menu";
import { useNavigate, useParams, Link } from "react-router";
import { useTheme } from "~/providers/ThemeProvider";

interface ChatSidebarProps {
  chats: Chat[];
  workspaces: Workspace[];
}

export function ChatSidebar({
  chats: initialChats,
  workspaces,
}: ChatSidebarProps) {
  const [open, setOpen] = React.useState(false);
  const { isLoading, createWorkspace } = useWorkspaces();
  const params = useParams();
  const workspaceId = params.workspaceId;
  const navigate = useNavigate();
  const { chats, deleteChat, createChat } = useChats(
    workspaceId || "",
    initialChats
  );
  const { theme, setTheme } = useTheme();

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [chatIdToDelete, setChatIdToDelete] = React.useState<string | null>(
    null
  );

  const handleCreateWorkspace = async (data: {
    name: string;
    description: string;
  }) => {
    try {
      const newWorkspace = await createWorkspace(data);
      // Navigate to the new workspace route
      navigate(`/workspaces/${newWorkspace.id}`);
      setOpen(false);
    } catch (error) {
      console.error("Failed to create workspace:", error);
    }
  };

  const handleCreateChat = async () => {
    if (!workspaceId) return;
    try {
      // Navigate to the new chat page instead of creating a chat immediately
      navigate(`/workspaces/${workspaceId}/chat/new`);
    } catch (error) {
      console.error("Failed to navigate to new chat:", error);
    }
  };

  // Handle chat deletion confirmation
  const handleDeleteClick = (id: string) => {
    setChatIdToDelete(id);
    // Delay opening the dialog slightly to allow context menu to close properly
    setTimeout(() => {
      setIsDeleteDialogOpen(true);
    }, 0);
  };

  const handleDeleteConfirm = async () => {
    if (!chatIdToDelete) return;

    try {
      // If the deleted chat was the current one, navigate to workspace root
      if (params.chatId === chatIdToDelete) {
        navigate(`/workspaces/${workspaceId}`);
      }
      deleteChat(chatIdToDelete);
    } catch (error) {
      console.error("Failed to delete chat:", error);
    } finally {
      setIsDeleteDialogOpen(false);
      setChatIdToDelete(null);
    }
  };

  // Handle case when no workspace is selected but workspaces are available
  React.useEffect(() => {
    if (workspaces.length > 0 && !workspaceId) {
      navigate(`/workspaces/${workspaces[0].id}`);
    }
  }, [workspaces, workspaceId, navigate]);

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
                          (workspace) => workspace.id === workspaceId
                        )?.name || "Select workspace..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command
                    filter={(value, search) => {
                      if (value.includes("eightysixrocks!")) return 0;
                      const normalizedValue = value.toLowerCase();
                      const normalizedSearch = search.toLowerCase();
                      return normalizedValue.includes(normalizedSearch) ? 1 : 0;
                    }}
                  >
                    <CommandInput placeholder="Search workspace..." />
                    <CommandList>
                      <CommandEmpty>No workspace found.</CommandEmpty>
                      <div className="max-h-[200px] overflow-y-auto">
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
                                  setOpen(false);
                                }}
                                className="p-0"
                              >
                                <Link
                                  to={`/workspaces/${workspace.id}`}
                                  className="flex w-full h-full items-center px-[8px] py-[6px]"
                                >
                                  {workspace.name}
                                </Link>
                              </CommandItem>
                            ))}
                        </CommandGroup>
                      </div>
                      <CommandSeparator />
                      <CommandGroup heading="Actions">
                        <CommandItem
                          value="eightysixrocks!"
                          onSelect={() => null}
                        >
                          <CreateWorkspaceDialog
                            onCreateWorkspace={handleCreateWorkspace}
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
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleCreateChat}
              disabled={!workspaceId}
            >
              <Plus className="h-4 w-4" />
              <span className="sr-only">New chat</span>
            </Button>
          </div>
          <Separator />
          <ScrollArea className="flex-1 p-2">
            <div className="space-y-1">
              {chats.map((chat) => (
                <ContextMenu key={chat.id}>
                  <ContextMenuTrigger asChild>
                    <div className="relative group/chat flex items-center hover:bg-accent rounded-md">
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-full justify-start gap-2 group-hover/chat:bg-transparent",
                          params.chatId === chat.id && "bg-accent"
                        )}
                        asChild
                      >
                        <Link
                          to={`/workspaces/${workspaceId}/chat/${chat.id}`}
                          className="flex items-center flex-grow min-w-0"
                        >
                          <MessageSquare className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate flex-grow">
                            {chat.name}
                          </span>
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 right-0 absolute opacity-0 group-hover/chat:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive cursor-pointer rounded-sm"
                        onClick={(e) => {
                          e.preventDefault(); // Prevent triggering link navigation
                          handleDeleteClick(chat.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete chat</span>
                      </Button>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-48">
                    <ContextMenuItem
                      inset
                      onSelect={() => console.log("Rename chat:", chat.id)}
                    >
                      Rename
                    </ContextMenuItem>
                    <ContextMenuItem
                      inset
                      className="text-destructive focus:text-destructive focus:bg-destructive/10"
                      onSelect={() => handleDeleteClick(chat.id)}
                    >
                      Delete
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
              {chats.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  No chats yet
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="mt-auto p-4 border-t">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="w-8 h-8 rounded-md"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          </div>
        </SidebarContent>
      </Sidebar>
      {/* Confirmation Dialog */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this
              chat and all its messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setChatIdToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
