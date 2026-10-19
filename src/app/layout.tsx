import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/ui/SiteHeader';

export const metadata: Metadata = {
  title: '绘相 | 把照片，画成一张作品',
  description:
    '上传任意照片，选择水彩、彩铅或钢笔速写风格，用 AI 转成手绘作品，再通过可编辑的海报排版工具制作并导出成品。',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#F7F4EE',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <body>
        <SiteHeader />
        <main>{children}</main>
      </body>
    </html>
  );
}
