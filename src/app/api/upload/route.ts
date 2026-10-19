import { getConfig } from '@/lib/server/config';
import { createAsset, toAssetDto } from '@/lib/server/assets';
import { AppError } from '@/lib/server/errors';
import { ensureSession } from '@/lib/server/session';
import {
  assertSameOrigin,
  errorResponse,
  jsonResponse,
} from '@/lib/server/http';
import { consumeRateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = ensureSession(request);

  try {
    assertSameOrigin(request);
    const config = getConfig();
    consumeRateLimit(
      `upload:${session.sessionId}`,
      config.uploadRateLimitPerMinute,
      60_000,
    );
    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      throw new AppError('BAD_REQUEST', '缺少图片文件。');
    }
    if (file.size <= 0) {
      throw new AppError('BAD_REQUEST', '图片文件为空。');
    }
    if (file.size > config.maxUploadBytes) {
      throw new AppError(
        'IMAGE_TOO_LARGE',
        `图片超过 ${Math.round(config.maxUploadBytes / 1024 / 1024)}MB 限制。`,
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const asset = await createAsset({
      sessionId: session.sessionId,
      kind: 'source',
      buffer,
    });

    return jsonResponse(
      { asset: toAssetDto(asset) },
      { status: 201, session },
    );
  } catch (error) {
    return errorResponse(error, session);
  }
}
