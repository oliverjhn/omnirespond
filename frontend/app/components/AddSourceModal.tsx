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

export const AddSourceModal = () => {
  // Get current workspace ID from route
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    if (!workspaceId) {
      alert("Workspace ID not found in URL");
      return;
    }
    setUploading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("workspace_id", workspaceId);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/upload/`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Upload failed: ${data.detail || res.statusText}`);
      } else {
        alert(`Upload successful: ${data.total_chunks} chunks processed`);
        setSelectedFile(null);
      }
    } catch (err) {
      alert(`Upload error: ${err}`);
    } finally {
      setUploading(false);
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
        <Button onClick={handleUpload} disabled={!selectedFile || uploading}>
          {uploading ? "Uploading..." : "Upload File"}
        </Button>
      </DialogFooter>
    </>
  );
};

export default AddSourceModal;
