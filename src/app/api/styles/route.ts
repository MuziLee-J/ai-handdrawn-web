import { listPublicStyles, PROMPT_VERSION } from '@/lib/ai';
import { jsonResponse } from '@/lib/server/http';

export const dynamic = 'force-static';

export async function GET() {
  return jsonResponse({
    styles: listPublicStyles(PROMPT_VERSION),
    promptVersion: PROMPT_VERSION,
  });
}
