import { supabase } from "../lib/supabase";
import type { Workspace } from "~/types/db";

export const getWorkspaces = async (): Promise<Workspace[]> => {
  console.log("🔍 Fetching workspaces from API...");
  try {
    const { data, error } = await supabase
      .from("workspaces")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Error fetching workspaces:", error);
      throw error;
    }

    console.log("✅ Fetched workspaces:", data);
    return data || [];
  } catch (error) {
    console.error("❌ Unexpected error in getWorkspaces:", error);
    return [];
  }
};

export const getWorkspace = async (id: string): Promise<Workspace | null> => {
  try {
    const { data, error } = await supabase
      .from("workspaces")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("❌ Error fetching workspace:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("❌ Unexpected error in getWorkspace:", error);
    return null;
  }
};

export const createWorkspace = async (
  workspace: Pick<Workspace, "name" | "description">
): Promise<Workspace> => {
  try {
    console.log("📝 Creating workspace:", workspace);
    const { data, error } = await supabase
      .from("workspaces")
      .insert([workspace])
      .select()
      .single();

    if (error) {
      console.error("❌ Error creating workspace:", error);
      throw error;
    }

    console.log("✅ Created workspace:", data);
    return data;
  } catch (error) {
    console.error("❌ Unexpected error in createWorkspace:", error);
    throw error;
  }
};

export const updateWorkspace = async (
  id: string,
  workspace: Partial<Pick<Workspace, "name" | "description">>
): Promise<Workspace> => {
  try {
    const { data, error } = await supabase
      .from("workspaces")
      .update(workspace)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("❌ Error updating workspace:", error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error("❌ Unexpected error in updateWorkspace:", error);
    throw error;
  }
};

export const deleteWorkspace = async (id: string): Promise<void> => {
  try {
    const { error } = await supabase.from("workspaces").delete().eq("id", id);

    if (error) {
      console.error("❌ Error deleting workspace:", error);
      throw error;
    }
  } catch (error) {
    console.error("❌ Unexpected error in deleteWorkspace:", error);
    throw error;
  }
};
