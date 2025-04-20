import React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { Dialog, DialogContent, DialogTrigger } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Plus } from "lucide-react";
import { AddSourceModal } from "./AddSourceModal";

export function WorkspaceSidebar() {
  const [isModalOpen, setIsModalOpen] = React.useState(false);

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
              {/* TODO: Replace with actual source list or empty state */}
              <p className="text-sm text-muted-foreground p-4 text-center">
                No sources added yet.
              </p>
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
