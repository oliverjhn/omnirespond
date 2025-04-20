import React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { Dialog, DialogContent, DialogTrigger } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Plus, FileText, Trash2 } from "lucide-react";
import { AddSourceModal } from "./AddSourceModal";
import { useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getSources, deleteSource } from "~/api/sources";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export function WorkspaceSidebar() {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const queryClient = useQueryClient();

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ["sources", workspaceId],
    queryFn: () => getSources(workspaceId!),
    enabled: !!workspaceId,
  });

  const deleteSourceMutation = useMutation({
    mutationFn: ({ filename }: { filename: string }) =>
      deleteSource(workspaceId!, filename),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources", workspaceId] });
      toast.success("Source deleted successfully");
    },
    onError: (error) => {
      toast.error("Failed to delete source: " + error.message);
    },
  });

  return (
    <div className="hidden lg:flex flex-col w-[32rem] border-l bg-sidebar text-sidebar-foreground h-full">
      <Tabs defaultValue="sources" className="flex flex-col h-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="references">References</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <div className="flex flex-col flex-1 h-full overflow-hidden">
          <TabsContent
            value="sources"
            className="flex flex-col flex-1 overflow-hidden"
          >
            {/* Content area with scrolling */}
            <div className="flex-1 overflow-y-auto p-4">
              {isLoading ? (
                <p className="text-sm text-muted-foreground p-4 text-center">
                  Loading sources...
                </p>
              ) : sources.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4 text-center">
                  No sources added yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {sources.map((source) => (
                    <div
                      key={source.id}
                      className="flex items-center gap-2 p-2 rounded-md hover:bg-accent/50 transition-colors group relative"
                    >
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {source.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Added{" "}
                          {formatDistanceToNow(new Date(source.created_at))} ago
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2"
                        onClick={() => deleteSourceMutation.mutate({ filename: source.name })}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="references" className="flex-1 overflow-y-auto">
            {/* TODO: Document references summary */}
            <p className="text-sm text-muted-foreground p-4 text-center">
              Select text in a source to see references.
            </p>
          </TabsContent>
          <TabsContent value="settings" className="flex-1 overflow-y-auto">
            {/* TODO: Workspace settings controls */}
            <p className="text-sm text-muted-foreground p-4 text-center">
              Workspace settings will appear here.
            </p>
          </TabsContent>

          {/* Button fixed at the bottom */}
          <div className="p-4 border-t mt-auto">
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Source
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <AddSourceModal onSuccess={() => setIsModalOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
