import { create } from 'zustand';
import type { Workspace } from '../types/workspace';

interface WorkspaceStore {
  workspaces: Workspace[];
  selectedWorkspaceId: string | null;
  
  // CRUD operations
  addWorkspace: (workspace: Workspace) => void;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void;
  deleteWorkspace: (id: string) => void;
  selectWorkspace: (id: string) => void;
  
  // Getters
  getSelectedWorkspace: () => Workspace | undefined;
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  workspaces: [],
  selectedWorkspaceId: null,

  addWorkspace: (workspace) => {
    set((state) => ({
      workspaces: [...state.workspaces, workspace],
      // Automatically select the workspace if none is selected
      selectedWorkspaceId: state.selectedWorkspaceId ?? workspace.id,
    }));
  },

  updateWorkspace: (id, updates) => {
    set((state) => ({
      workspaces: state.workspaces.map((workspace) =>
        workspace.id === id ? { ...workspace, ...updates } : workspace
      ),
    }));
  },

  deleteWorkspace: (id) => {
    set((state) => ({
      workspaces: state.workspaces.filter((workspace) => workspace.id !== id),
      // Clear selection if the deleted workspace was selected
      selectedWorkspaceId: state.selectedWorkspaceId === id ? null : state.selectedWorkspaceId,
    }));
  },

  selectWorkspace: (id) => {
    set({ selectedWorkspaceId: id });
  },

  getSelectedWorkspace: () => {
    const { workspaces, selectedWorkspaceId } = get();
    return workspaces.find((workspace) => workspace.id === selectedWorkspaceId);
  },
}));
