'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { api, Project } from '@/lib/api';

/** Abre o primeiro board do projeto (cria um se não houver). */
export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const project = await api<Project>(`/projects/${projectId}`);
      let boardId = project.boards?.[0]?.id;
      if (!boardId) boardId = (await api<{ id: string }>(`/projects/${projectId}/boards`, { method: 'POST', json: { name: 'Board 1' } })).id;
      router.replace(`/p/${projectId}/${boardId}`);
    })().catch(() => router.replace('/'));
  }, [projectId, router]);

  return <p className="p-6 font-mono text-sm text-muted">Abrindo projeto…</p>;
}
