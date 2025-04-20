import { createClient } from "~/lib/supabase/client";
import type { Source } from "~/types/db.t";

const supabase = createClient();

export async function createSource(data: {
  name: string;
  source_type: string;
  workspace_id: string;
}): Promise<Source> {
  const { data: source, error } = await supabase
    .from("sources")
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return source;
}

export async function getSources(workspaceId: string): Promise<Source[]> {
  const { data: sources, error } = await supabase
    .from("sources")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return sources;
}

export async function checkDuplicateSourceName(workspaceId: string, name: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("sources")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("name", name)
    .limit(1);

  if (error) throw error;
  return data.length > 0;
}

export async function deleteSource(workspaceId: string, filename: string): Promise<void> {
  // First delete from backend
  const response = await fetch(`${import.meta.env.VITE_API_URL}/delete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workspace_id: workspaceId,
      filenames: [filename],
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to delete source from backend');
  }

  // Then delete from Supabase
  const { error } = await supabase
    .from('sources')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('name', filename);

  if (error) throw error;
} 