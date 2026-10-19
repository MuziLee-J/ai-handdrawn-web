import { createMockArtwork } from './mock-png';
import type {
  ImageProvider,
  StyledImageRequest,
  StyledImageResult,
} from './types';

export class MockProvider implements ImageProvider {
  readonly id = 'mock';
  readonly label = '演示图（非 AI）';
  readonly model = 'mock-procedural-v1';
  readonly supportsCancel = false;
  readonly isMock = true;

  async generateStyledImage(
    input: StyledImageRequest,
  ): Promise<StyledImageResult> {
    // 模拟真实调用的等待，便于验证轮询状态；不是伪造进度，状态仍由任务记录驱动。
    await new Promise((resolve) => setTimeout(resolve, 900));
    if (input.signal?.aborted) {
      throw new Error('任务已取消');
    }

    const { buffer, width, height } = createMockArtwork(
      input.source.width,
      input.source.height,
      input.styleId,
    );

    return {
      providerId: this.id,
      model: this.model,
      buffer,
      mime: 'image/png',
      width,
      height,
      usage: undefined,
    };
  }
}
