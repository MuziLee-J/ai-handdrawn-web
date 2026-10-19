import type { Metadata } from 'next';
import { EditorClient } from './EditorClient';

export const metadata: Metadata = {
  title: '排版编辑器 | 绘相',
  description: '调整图片、中文文字、背景与装饰，导出完整海报成品。',
};

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditorClient workId={id} />;
}
