import type {
  PublicStylePreset,
  StyleId,
  StylePreset,
} from './types';

/**
 * 风格是“绘画媒介”，不是题材。
 * 所有提示词都不得绑定旅行、人物、宠物、食物等具体对象。
 */
export const STYLE_PRESETS: Record<StyleId, StylePreset> = {
  watercolor: {
    id: 'watercolor',
    version: '2026-10-18.v1',
    name: '水彩手绘',
    subtitle: '透明色层 · 自然晕染',
    description:
      '透明水彩的多层罩染与湿画法晕染，保留纸张纹理和自然留白，适合柔和、呼吸感强的画面。',
    medium: '透明水彩画',
    preview: {
      base: '#FBF7EE',
      wash: '#9DB7AE',
      accent: '#D9A18A',
      ink: '#5D6B63',
      pattern: 'wash',
    },
    prompt: {
      medium: '透明水彩画（watercolor painting）',
      technique:
        '使用透明水彩的多层罩染、湿画法晕染和自然的水痕边缘；颜色在纸面上自然扩散、交叠，亮部保留纸张本色，暗部通过叠加色层形成，而不是用黑色平涂。',
      texture:
        '呈现冷压水彩纸的细密纹理、颜料颗粒感和轻微的纸张起伏；画面可以有不规则的绘画边缘与适度留白。',
      avoid:
        '避免油画式厚涂、塑料质感、过度平滑的渐变、过度饱和的颜色、均匀的数字笔刷和照片滤镜感。',
    },
  },
  'colored-pencil': {
    id: 'colored-pencil',
    version: '2026-10-18.v1',
    name: '彩铅绘画',
    subtitle: '细腻排线 · 叠色颗粒',
    description:
      '可见的铅笔笔触与交叉排线，通过自然叠色塑造体积，保留纸面颗粒和手绘的呼吸感。',
    medium: '彩色铅笔手绘',
    preview: {
      base: '#FBF7EE',
      wash: '#C9B79A',
      accent: '#C77D6A',
      ink: '#4A4540',
      pattern: 'hatch',
    },
    prompt: {
      medium: '彩色铅笔手绘（colored pencil drawing）',
      technique:
        '使用可见的铅笔线条、细密排线、交叉排线和自然叠色；通过线条方向与疏密表现体积、明暗和材质，保留适度的手绘草稿感，而不是用平滑色块填满。',
      texture:
        '呈现纸张颗粒、铅笔粉末的细微颗粒感和局部留白；不同颜色在纸面上自然叠加，边缘可以有轻微的笔触溢出。',
      avoid:
        '避免机械重复的纹理、纯边缘检测形成的假手绘、过度光滑的数字涂抹、厚重油画感和高饱和荧光色。',
    },
  },
  'pen-sketch': {
    id: 'pen-sketch',
    version: '2026-10-18.v1',
    name: '钢笔速写',
    subtitle: '线条概括 · 明暗排线',
    description:
      '有轻重变化的钢笔线条与交叉排线，用轮廓和疏密表现结构，保留速写的松弛与不规则感。',
    medium: '钢笔速写',
    preview: {
      base: '#FBF7EE',
      wash: '#D8D2C5',
      accent: '#8C7C68',
      ink: '#2F2D29',
      pattern: 'line',
    },
    prompt: {
      medium: '钢笔速写（pen and ink sketch）',
      technique:
        '使用有粗细和速度变化的钢笔线条概括轮廓与结构；用交叉排线、点画和线条疏密表现明暗与材质；允许局部淡墨晕染，但以线条为主要表现手段。',
      texture:
        '保留纸张的细微纹理和笔尖划过纸面的轻微不规则感；线条可以有自然的断笔、回笔和重叠，避免机械等宽。',
      avoid:
        '避免大面积黑色平涂、杂乱无结构的线条、轮廓断裂导致主体不可辨、均匀的数字描边和照片滤镜感。',
    },
  },
};

export const STYLE_IDS = Object.keys(STYLE_PRESETS) as StyleId[];

export function isStyleId(value: unknown): value is StyleId {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(STYLE_PRESETS, value)
  );
}

export function getStylePreset(styleId: StyleId): StylePreset {
  return STYLE_PRESETS[styleId];
}

export function listPublicStyles(promptVersion: string): PublicStylePreset[] {
  return STYLE_IDS.map((id) => {
    const style = STYLE_PRESETS[id];
    return {
      id: style.id,
      version: style.version,
      name: style.name,
      subtitle: style.subtitle,
      description: style.description,
      medium: style.medium,
      preview: style.preview,
      promptVersion,
    };
  });
}
