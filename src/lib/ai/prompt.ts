import { getStylePreset } from './styles';
import type { CompositionMode, Fidelity, StyleId } from './types';

export const PROMPT_VERSION = 'handdrawn-2026-10-19.v3';

const FIDELITY_CLAUSES: Record<Fidelity, string> = {
  faithful:
    '保真优先：严格保留原图的主体数量、姿态、相对位置、构图、透视关系和主要细节；艺术化处理应克制，不要改变画面内容。',
  balanced:
    '平衡处理：保留原图的主要主体、构图与空间关系，允许对次要细节、背景纹理和边缘做适度概括，但主体必须清晰可辨。',
  artistic:
    '艺术表达优先：可以加强笔触、色彩和背景的概括与重组，但必须保留原图主体的辨识度和基本空间关系，不得凭空增加或删除主要对象。',
};

const COMPOSITION_CLAUSES: Record<CompositionMode, string> = {
  full:
    '满版构图：让主体和必要的环境元素合理铺满画面，充分利用画布，保留原图的主要背景关系；不要额外添加大面积空白纸张或纸张边框。',
  sketchbook:
    '手账留白构图：先把温暖米白的纸张作为整张画面的底，在四周保留宽阔、未上色的干净纸边；再把照片内容浓缩成纸张中央的一幅小画。主体及其最必要的少量环境约占画面一半，绘画内容不要碰到画布四边，纸张留白应清晰可见。主体使用自然、不规则的手绘边缘。可以大幅省略、概括背景与远景，但必须保留主体的辨识度、数量与基本空间关系。留白区域不要自动添加日期、地点、标题、签名、边框或任何装饰文字。',
};

/**
 * 统一的基础提示词 + 风格片段。
 * 注意：Seedream 没有原生的“风格强度”参数，因此保真度通过提示词控制，
 * 不存在伪造的 image_strength 字段。
 */
export function buildStyledPrompt(
  styleId: StyleId,
  fidelity: Fidelity,
  composition: CompositionMode = 'full',
): { prompt: string; promptVersion: string; styleVersion: string } {
  const style = getStylePreset(styleId);
  const fidelityClause = FIDELITY_CLAUSES[fidelity];
  const compositionClause = COMPOSITION_CLAUSES[composition];

  const prompt = [
    `请将输入照片重新绘制成一幅完整的${style.medium}，而不是给照片叠加滤镜。`,
    '',
    '【必须保留】',
    '充分观察原图的主体、数量、姿态、相对位置、构图、透视、光影和色彩关系。保留主要对象的辨识度、关键结构特征与空间关系；除非风格需要，不要改变原图的核心内容。',
    '',
    '【绘画媒介】',
    style.prompt.medium + '。' + style.prompt.technique,
    '',
    '【质感与纸张】',
    style.prompt.texture,
    '',
    '【需要避免】',
    style.prompt.avoid,
    '同时避免：无意义地增加、删除或替换物体；主体结构失真；五官、肢体或物体比例错误；文字乱码、签名、水印或边框；明显的数字磨皮和塑料质感。',
    '',
    '【保真度】',
    fidelityClause,
    '',
    '【构图方式】',
    compositionClause,
    '',
    '不要生成任何文字、标题、签名、水印或装饰边框。输出应为单幅、完整、连贯、具有真实绘画媒介质感的手绘作品。',
  ].join('\n');

  return {
    prompt,
    promptVersion: PROMPT_VERSION,
    styleVersion: style.version,
  };
}

export function isFidelity(value: unknown): value is Fidelity {
  return value === 'faithful' || value === 'balanced' || value === 'artistic';
}

export function isCompositionMode(value: unknown): value is CompositionMode {
  return value === 'full' || value === 'sketchbook';
}
