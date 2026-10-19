import type { Metadata } from 'next';
import { WorksClient } from './WorksClient';

export const metadata: Metadata = {
  title: '我的作品 | 绘相',
  description: '查看、继续编辑或删除当前浏览器会话中的手绘作品。',
};

export default function WorksPage() {
  return <WorksClient />;
}
