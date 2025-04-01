import { create } from "zustand";
import type { Workspace } from "../types/workspace";

interface WorkspaceStore {
  workspaces: Workspace[];
  selectedWorkspaceId: string | null;
  setWorkspaces: (workspaces: Workspace[]) => void;
  setSelectedWorkspaceId: (id: string | null) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  workspaces: [],
  selectedWorkspaceId: null,
  setWorkspaces: (workspaces) => set({ workspaces }),
  setSelectedWorkspaceId: (id) => set({ selectedWorkspaceId: id }),
}));
