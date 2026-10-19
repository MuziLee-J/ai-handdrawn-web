import { getDb } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 部署健康检查：不创建会话，只验证进程与 SQLite 可用。
 * 不返回版本号、路径、环境变量等内部信息。
 */
export async function GET() {
  try {
    getDb().prepare('SELECT 1').get();
    return Response.json(
      { ok: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return Response.json(
      { ok: false },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
