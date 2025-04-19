import React from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { Dialog, DialogContent, DialogTrigger } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Plus } from "lucide-react";
import { AddSourceModal } from "./AddSourceModal";

export function WorkspaceSidebar() {
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  return (
    <div className="hidden lg:flex flex-col w-[32rem] border-l bg-sidebar text-sidebar-foreground overflow-y-auto h-full ">
      <Tabs defaultValue="sources" className="flex flex-col">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="references">References</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <div className="p-4 flex-1 overflow-auto">
          <TabsContent value="sources" className="flex flex-col h-full">
            {/* List of sources will go here */}
            <div className="flex-1">
              {/* TODO: Replace with actual source list or empty state */}
              <p className="text-sm text-muted-foreground p-4 text-center">
                No sources added yet.
              </p>
            </div>
            {/* Button at the bottom */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start mt-4"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Source
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <AddSourceModal />
              </DialogContent>
            </Dialog>
          </TabsContent>
          <TabsContent value="references">
            {/* TODO: Document references summary */}
            <p className="text-sm text-muted-foreground p-4 text-center">
              Select text in a source to see references.
            </p>
          </TabsContent>
          <TabsContent value="settings">
            {/* TODO: Workspace settings controls */}
            <p className="text-sm text-muted-foreground p-4 text-center">
              Workspace settings will appear here.
            </p>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
