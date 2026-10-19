import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // better-sqlite3 是原生模块，必须交给 Node 运行时加载，不能被打包器处理。
  serverExternalPackages: ['better-sqlite3'],
  images: {
    unoptimized: true,
  },
  // 本地开发时允许通过 127.0.0.1 访问 HMR 与客户端开发资源。
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
};

export default nextConfig;
