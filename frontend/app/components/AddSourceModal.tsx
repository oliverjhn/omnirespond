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

export const AddSourceModal = () => {
  // Basic state for file handling (will be expanded later)
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      // TODO: Add file validation (type, size)
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      console.log("Uploading file:", selectedFile.name);
      // TODO: Implement actual upload logic here
      // E.g., call an API endpoint
    }
    // TODO: Close modal on successful upload
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
        {/* TODO: Add source type selection (e.g., RadioGroup) */}
        <div className="grid grid-cols-1 gap-2">
          <label
            htmlFor="file-upload"
            className="flex items-center justify-center px-4 py-2 border border-dashed border-input rounded-md 
                       text-sm font-medium text-muted-foreground 
                       hover:bg-accent hover:text-accent-foreground hover:cursor-pointer transition-colors"
          >
            {/* You can add an icon here too, e.g., <Upload className="mr-2 h-4 w-4" /> */}
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
        <Button onClick={handleUpload} disabled={!selectedFile}>
          Upload File
        </Button>
      </DialogFooter>
    </>
  );
};

export default AddSourceModal;
