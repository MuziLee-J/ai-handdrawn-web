import { ArkProvider } from './ark';
import { MockProvider } from './mock';
import type { ImageProvider } from './types';

export * from './types';
export * from './styles';
export * from './prompt';
export * from './errors';
export * from './size';

function mockAllowed(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    (process.env.ALLOW_MOCK_AI ?? 'true').toLowerCase() === 'true'
  );
}

export function getProvider(): ImageProvider {
  const requested = (process.env.AI_PROVIDER ?? 'ark').toLowerCase();

  if (requested === 'mock') {
    if (!mockAllowed()) {
      throw new Error('生产环境禁止使用 mock AI 供应商');
    }
    return new MockProvider();
  }

  if (requested === 'ark') {
    if (!process.env.ARK_API_KEY) {
      if (mockAllowed()) {
        return new MockProvider();
      }
      throw new Error(
        '未配置 ARK_API_KEY。请在 .env.local 中填写火山方舟 API Key，或仅在开发环境启用 ALLOW_MOCK_AI=true。',
      );
    }
    return new ArkProvider();
  }

  if (requested === 'tencent') {
    throw new Error(
      '腾讯 TokenHub 适配器尚未实现：国内 hy-image-v3 的完整请求字段与图片传参格式仍需在开通后的官方文档中核实。',
    );
  }

  throw new Error(`未知的 AI_PROVIDER: ${requested}`);
}

export function getProviderInfo(): {
  id: string;
  label: string;
  model: string;
  isMock: boolean;
  supportsCancel: boolean;
} {
  const provider = getProvider();
  return {
    id: provider.id,
    label: provider.label,
    model: provider.model,
    isMock: provider.isMock,
    supportsCancel: provider.supportsCancel,
  };
}
