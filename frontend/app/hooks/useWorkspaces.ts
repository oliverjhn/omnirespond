import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createWorkspace,
  deleteWorkspace,
  getWorkspaces,
  updateWorkspace,
} from "../api/workspaces";
import type { Workspace } from "../types/db.t";
import React from "react";
import { createClient } from "~/lib/supabase/client";

const supabase = createClient();

type UpdateWorkspaceParams = {
  id: string;
  data: Partial<Pick<Workspace, "name" | "description">>;
};

export const useWorkspaces = () => {
  const queryClient = useQueryClient();

  const workspacesQuery = useQuery({
    queryKey: ["workspaces"] as const,
    queryFn: getWorkspaces,
    staleTime: 1000 * 60, // 1 minute
  });

  // Set up real-time subscription
  React.useEffect(() => {
    const channel = supabase
      .channel("workspaces_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workspaces",
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["workspaces"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const createWorkspaceMutation = useMutation({
    mutationFn: (data: Pick<Workspace, "name" | "description">) =>
      createWorkspace(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
    onError: (error: Error) => {
      console.error("Error creating workspace:", error);
    },
  });

  const updateWorkspaceMutation = useMutation({
    mutationFn: ({ id, data }: UpdateWorkspaceParams) =>
      updateWorkspace(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
    onError: (error: Error) => {
      console.error("Error updating workspace:", error);
    },
  });

  const deleteWorkspaceMutation = useMutation({
    mutationFn: (id: string) => deleteWorkspace(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
    onError: (error: Error) => {
      console.error("Error deleting workspace:", error);
    },
  });

  return {
    workspaces: workspacesQuery.data ?? [],
    isLoading: workspacesQuery.isLoading,
    isError: workspacesQuery.isError,
    error: workspacesQuery.error,
    createWorkspace: createWorkspaceMutation.mutateAsync,
    updateWorkspace: updateWorkspaceMutation.mutate,
    deleteWorkspace: deleteWorkspaceMutation.mutate,
    isCreating: createWorkspaceMutation.isPending,
    isUpdating: updateWorkspaceMutation.isPending,
    isDeleting: deleteWorkspaceMutation.isPending,
  };
};
