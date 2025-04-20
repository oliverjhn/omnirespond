import React from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "~/components/ui/dialog";
import { useParams } from "react-router";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { createSource, getSources } from "~/api/sources";
import { toast } from "sonner";

interface AddSourceModalProps {
  onSuccess?: () => void;
}

export const AddSourceModal = ({ onSuccess }: AddSourceModalProps) => {
  // Get current workspace ID from route
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const queryClient = useQueryClient();

  // Get existing sources from cache
  const { data: sources = [] } = useQuery({
    queryKey: ["sources", workspaceId],
    queryFn: () => getSources(workspaceId!),
    enabled: !!workspaceId,
  });

  const createSourceMutation = useMutation({
    mutationFn: createSource,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources", workspaceId] });
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error) => {
      toast.error("Failed to create source: " + error.message);
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    if (!workspaceId) {
      toast.error("Workspace ID not found");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("workspace_id", workspaceId);

    try {
      // Client-side duplicate check
      if (sources.some((s) => s.name === selectedFile.name)) {
        toast.error("A file with this name already exists in your workspace");
        setIsUploading(false);
        return;
      }

      // First upload the file to the backend
      const uploadRes = await fetch(`${import.meta.env.VITE_API_URL}/upload/`, {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const data = await uploadRes.json();
        throw new Error(data.detail || uploadRes.statusText);
      }

      // Then create the source record in Supabase
      await createSourceMutation.mutateAsync({
        name: selectedFile.name,
        source_type: "file",
        workspace_id: workspaceId,
      });

      setSelectedFile(null);
      toast.success("File uploaded successfully");
    } catch (err) {
      toast.error(
        `Upload error: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add New Source</DialogTitle>
        <DialogDescription>
          Select the type of source and upload your file. Currently, only file
          uploads are supported.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="grid grid-cols-1 gap-2">
          <label
            htmlFor="file-upload"
            className="flex items-center justify-center px-4 py-2 border border-dashed border-input rounded-md 
                       text-sm font-medium text-muted-foreground 
                       hover:bg-accent hover:text-accent-foreground hover:cursor-pointer transition-colors"
          >
            Click or drag file to upload
          </label>
          <Input
            id="file-upload"
            type="file"
            className="sr-only"
            onChange={handleFileChange}
          />
        </div>
        {selectedFile && (
          <p className="text-sm text-muted-foreground text-center">
            Selected: {selectedFile.name}
          </p>
        )}
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button
          onClick={handleUpload}
          disabled={
            !selectedFile || isUploading || createSourceMutation.isPending
          }
        >
          {isUploading || createSourceMutation.isPending
            ? "Uploading..."
            : "Upload File"}
        </Button>
      </DialogFooter>
    </>
  );
};

export default AddSourceModal;
