export interface Source {
  id: string;
  name: string;
  type: string;
  uploadedAt: string;
  status: 'processing' | 'ready' | 'error';
}

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  references?: {
    documentId: string;
    snippet: string;
  }[];
}

export interface Chat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  sources: Source[];
  chats: Chat[];
}
