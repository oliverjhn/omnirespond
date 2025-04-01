import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import { Plus } from "lucide-react";

interface CreateWorkspaceDialogProps {
  onCreateWorkspace: (data: { name: string; description: string }) => void;
  isLoading?: boolean;
}

export function CreateWorkspaceDialog({
  onCreateWorkspace,
  isLoading,
}: CreateWorkspaceDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateWorkspace({ name, description });
    setName("");
    setDescription("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <div className="flex items-center">
          <Plus className="mr-2 h-4 w-4" />
          New Workspace
        </div>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Workspace</DialogTitle>
            <DialogDescription>
              Create a new workspace to organize your documents and
              conversations.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Workspace"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your workspace..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading ? "Creating..." : "Create Workspace"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
