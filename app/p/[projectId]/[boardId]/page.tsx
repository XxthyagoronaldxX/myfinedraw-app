'use client';

import { useParams } from 'next/navigation';
import Editor from '@/components/editor/Editor';
import { useRequireAuth } from '@/lib/useAuth';

export default function BoardPage() {
  const { projectId, boardId } = useParams<{ projectId: string; boardId: string }>();
  const { user } = useRequireAuth();
  if (!user) return null;
  return <Editor key={boardId} projectId={projectId} boardId={boardId} />;
}
