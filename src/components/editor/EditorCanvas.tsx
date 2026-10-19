'use client';

import Konva from 'konva';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  Circle,
  Ellipse,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Shape,
  Stage,
  Text as KonvaText,
  Transformer,
} from 'react-konva';
import { updateElement } from '@/lib/editor/operations';
import type {
  EditorDoc,
  EditorElement,
  ImageElement,
  ShapeElement,
  TextElement,
} from '@/lib/editor/types';
import { useLoadedImage } from './useLoadedImage';

export interface EditorCanvasHandle {
  exportDataUrl: (options: {
    targetWidth: number;
    mimeType: 'image/png' | 'image/jpeg';
    quality?: number;
  }) => Promise<string>;
}

interface EditorCanvasProps {
  doc: EditorDoc;
  selectedId: string | null;
  previewMode?: boolean;
  onSelect: (id: string | null) => void;
  onCommit: (next: EditorDoc) => void;
}

const FONT_FAMILIES: Record<TextElement['fontFamily'], string> = {
  sans: 'PingFang SC, Microsoft YaHei, sans-serif',
  serif: 'Songti SC, SimSun, serif',
  kai: 'Kaiti SC, KaiTi, serif',
};

function roundedRectPath(
  context: Konva.Context,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.moveTo(r, 0);
  context.lineTo(width - r, 0);
  context.quadraticCurveTo(width, 0, width, r);
  context.lineTo(width, height - r);
  context.quadraticCurveTo(width, height, width - r, height);
  context.lineTo(r, height);
  context.quadraticCurveTo(0, height, 0, height - r);
  context.lineTo(0, r);
  context.quadraticCurveTo(0, 0, r, 0);
  context.closePath();
}

function PaperTexture({ width, height }: { width: number; height: number }) {
  return (
    <Shape
      width={width}
      height={height}
      listening={false}
      sceneFunc={(context, shape) => {
        let seed = 0x2f6e2b1;
        const random = () => {
          seed = (seed * 1664525 + 1013904223) >>> 0;
          return seed / 4294967296;
        };
        context.save();
        const dots = Math.min(2200, Math.round((width * height) / 1000));
        for (let i = 0; i < dots; i += 1) {
          const x = random() * width;
          const y = random() * height;
          const radius = 0.5 + random() * 1.1;
          context.fillStyle = `rgba(43,42,39,${0.018 + random() * 0.028})`;
          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fill();
        }
        for (let i = 0; i < 220; i += 1) {
          const y = random() * height;
          context.strokeStyle = `rgba(120,105,85,${0.012 + random() * 0.018})`;
          context.lineWidth = 0.6;
          context.beginPath();
          context.moveTo(0, y);
          context.lineTo(width, y + (random() - 0.5) * 2);
          context.stroke();
        }
        context.restore();
      }}
    />
  );
}

function ImageNode({
  element,
  onLoaded,
}: {
  element: ImageElement;
  onLoaded: () => void;
}) {
  const image = useLoadedImage(`/api/files/${element.assetId}`, onLoaded);

  if (!image) {
    return (
      <Rect
        width={element.width}
        height={element.height}
        fill="#efeae0"
        cornerRadius={element.cornerRadius}
      />
    );
  }

  const boxAspect = element.width / element.height;
  const imageAspect = image.naturalWidth / image.naturalHeight;
  let crop: { x: number; y: number; width: number; height: number } | undefined;

  if (element.fit === 'cover') {
    if (imageAspect > boxAspect) {
      const cropWidth = image.naturalHeight * boxAspect;
      crop = {
        x: (image.naturalWidth - cropWidth) / 2,
        y: 0,
        width: cropWidth,
        height: image.naturalHeight,
      };
    } else {
      const cropHeight = image.naturalWidth / boxAspect;
      crop = {
        x: 0,
        y: (image.naturalHeight - cropHeight) / 2,
        width: image.naturalWidth,
        height: cropHeight,
      };
    }
  }

  return (
    <Group
      clipFunc={(context) =>
        roundedRectPath(
          context as unknown as Konva.Context,
          element.width,
          element.height,
          element.cornerRadius,
        )
      }
    >
      <KonvaImage
        image={image}
        width={element.width}
        height={element.height}
        crop={crop}
        listening={false}
      />
      {element.stroke && element.strokeWidth ? (
        <Rect
          width={element.width}
          height={element.height}
          stroke={element.stroke}
          strokeWidth={element.strokeWidth}
          cornerRadius={element.cornerRadius}
          listening={false}
        />
      ) : null}
    </Group>
  );
}

function ShapeNode({ element }: { element: ShapeElement }) {
  const stroke = element.stroke ?? '#6f6a60';
  const strokeWidth = element.strokeWidth ?? 2;

  if (element.shape === 'line') {
    return (
      <Line
        points={[0, element.height / 2, element.width, element.height / 2]}
        stroke={stroke}
        strokeWidth={strokeWidth}
        lineCap="round"
        listening={false}
      />
    );
  }
  if (element.shape === 'dot') {
    return (
      <Circle
        x={element.width / 2}
        y={element.height / 2}
        radius={Math.min(element.width, element.height) / 2}
        fill={element.fill ?? '#b9765a'}
        listening={false}
      />
    );
  }
  if (element.shape === 'ellipse') {
    return (
      <Ellipse
        x={element.width / 2}
        y={element.height / 2}
        radiusX={element.width / 2}
        radiusY={element.height / 2}
        fill={element.fill ?? 'transparent'}
        stroke={element.stroke}
        strokeWidth={element.strokeWidth ?? 0}
        listening={false}
      />
    );
  }
  return (
    <Rect
      width={element.width}
      height={element.height}
      fill={element.fill ?? 'transparent'}
      stroke={element.stroke}
      strokeWidth={element.strokeWidth ?? 0}
      cornerRadius={element.shape === 'frame' ? 2 : 0}
      listening={false}
    />
  );
}

function ElementNode({
  doc,
  element,
  scale,
  previewMode,
  onSelect,
  onCommit,
  onImageLoaded,
  registerNode,
}: {
  doc: EditorDoc;
  element: EditorElement;
  scale: number;
  previewMode: boolean;
  onSelect: (id: string) => void;
  onCommit: (next: EditorDoc) => void;
  onImageLoaded: (assetId: string) => void;
  registerNode: (id: string, node: Konva.Group | null) => void;
}) {
  const groupRef = useRef<Konva.Group | null>(null);

  useEffect(() => {
    registerNode(element.id, groupRef.current);
    return () => registerNode(element.id, null);
  }, [element.id, registerNode]);

  function handleTransformEnd() {
    const node = groupRef.current;
    if (!node) return;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const width = Math.max(20, element.width * scaleX);
    const height = Math.max(20, element.height * scaleY);
    node.scaleX(1);
    node.scaleY(1);

    const base = {
      x: node.x(),
      y: node.y(),
      width,
      height,
      rotation: node.rotation(),
    };

    const next =
      element.type === 'text'
        ? updateElement(doc, element.id, {
            ...base,
            fontSize: Math.max(8, element.fontSize * Math.min(scaleX, scaleY)),
          })
        : updateElement(doc, element.id, base);
    onCommit(next);
  }

  return (
    <Group
      ref={groupRef}
      x={element.x}
      y={element.y}
      rotation={element.rotation}
      opacity={element.opacity}
      draggable={!previewMode && !element.locked}
      onClick={() => onSelect(element.id)}
      onTap={() => onSelect(element.id)}
      onDragStart={() => onSelect(element.id)}
      onDragEnd={() => {
        const node = groupRef.current;
        if (!node) return;
        onCommit(
          updateElement(doc, element.id, { x: node.x(), y: node.y() }),
        );
      }}
      onTransformEnd={handleTransformEnd}
    >
      <Rect
        width={element.width}
        height={element.height}
        fill="rgba(0,0,0,0.01)"
        listening
      />

      {element.type === 'image' && (
        <ImageNode
          element={element}
          onLoaded={() => onImageLoaded(element.assetId)}
        />
      )}

      {element.type === 'text' && (
        <KonvaText
          text={element.text}
          width={element.width}
          height={element.height}
          fontSize={element.fontSize}
          fontFamily={FONT_FAMILIES[element.fontFamily]}
          fontStyle={element.fontStyle}
          fill={element.fill}
          align={element.align}
          lineHeight={element.lineHeight}
          letterSpacing={element.letterSpacing}
          wrap="char"
          verticalAlign="top"
          listening={false}
        />
      )}

      {element.type === 'shape' && <ShapeNode element={element} />}
    </Group>
  );
}

export const EditorCanvas = forwardRef<EditorCanvasHandle, EditorCanvasProps>(
  function EditorCanvas(
    { doc, selectedId, previewMode = false, onSelect, onCommit },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<Konva.Stage>(null);
    const transformerRef = useRef<Konva.Transformer>(null);
    const nodeRefs = useRef(new Map<string, Konva.Group>());
    const loadedAssetsRef = useRef(new Set<string>());
    const docRef = useRef(doc);
    docRef.current = doc;

    const [viewport, setViewport] = useState({ width: 0, height: 0 });
    const [exporting, setExporting] = useState(false);
    const [selectedNode, setSelectedNode] = useState<Konva.Group | null>(null);

    useLayoutEffect(() => {
      const element = containerRef.current;
      if (!element) return;
      const update = () => {
        setViewport({
          width: element.clientWidth,
          height: element.clientHeight,
        });
      };
      update();
      const observer = new ResizeObserver(update);
      observer.observe(element);
      return () => observer.disconnect();
    }, []);

    const scale =
      viewport.width > 0 && viewport.height > 0
        ? Math.min(
            viewport.width / doc.canvas.width,
            viewport.height / doc.canvas.height,
          ) * 0.96
        : 0;

    useEffect(() => {
      setSelectedNode(
        selectedId ? nodeRefs.current.get(selectedId) ?? null : null,
      );
    }, [selectedId, doc.elements]);

    useEffect(() => {
      const transformer = transformerRef.current;
      if (!transformer) return;
      if (
        !selectedNode ||
        previewMode ||
        exporting ||
        selectedNode.getStage() === null
      ) {
        transformer.nodes([]);
      } else {
        transformer.nodes([selectedNode]);
      }
      transformer.getLayer()?.batchDraw();
    }, [selectedNode, previewMode, exporting]);

    const registerNode = (id: string, node: Konva.Group | null) => {
      if (node) nodeRefs.current.set(id, node);
      else nodeRefs.current.delete(id);
    };

    useImperativeHandle(ref, () => ({
      async exportDataUrl({ targetWidth, mimeType, quality }) {
        const stage = stageRef.current;
        if (!stage) throw new Error('画布尚未准备好');
        setExporting(true);

        const imageAssetIds = docRef.current.elements
          .filter((element): element is ImageElement => element.type === 'image')
          .map((element) => element.assetId);

        for (let attempt = 0; attempt < 80; attempt += 1) {
          const allLoaded = imageAssetIds.every((assetId) =>
            loadedAssetsRef.current.has(assetId),
          );
          if (allLoaded) break;
          await new Promise((resolve) => setTimeout(resolve, 100));
          if (attempt === 79) {
            setExporting(false);
            throw new Error('有图片尚未加载完成，请稍后再导出。');
          }
        }

        try {
          await document.fonts.ready;
          await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          );
          const pixelRatio = targetWidth / stage.width();
          return stage.toDataURL({
            pixelRatio,
            mimeType,
            quality,
          });
        } finally {
          setExporting(false);
        }
      },
    }));

    return (
      <div
        ref={containerRef}
        className="flex h-full w-full items-center justify-center overflow-hidden"
      >
        {scale > 0 && (
          <Stage
            ref={stageRef}
            width={doc.canvas.width * scale}
            height={doc.canvas.height * scale}
            className="shadow-lift"
            onMouseDown={(event) => {
              if (event.target === event.target.getStage()) onSelect(null);
            }}
            onTouchStart={(event) => {
              if (event.target === event.target.getStage()) onSelect(null);
            }}
          >
            <Layer scaleX={scale} scaleY={scale}>
              <Rect
                x={0}
                y={0}
                width={doc.canvas.width}
                height={doc.canvas.height}
                fill={doc.canvas.background}
                listening={false}
              />
              {doc.canvas.texture === 'paper' && (
                <PaperTexture
                  width={doc.canvas.width}
                  height={doc.canvas.height}
                />
              )}

              {doc.elements.map((element) => (
                <ElementNode
                  key={element.id}
                  doc={doc}
                  element={element}
                  scale={scale}
                  previewMode={previewMode || exporting}
                  onSelect={onSelect}
                  onCommit={onCommit}
                  onImageLoaded={(assetId) =>
                    loadedAssetsRef.current.add(assetId)
                  }
                  registerNode={registerNode}
                />
              ))}

              <Transformer
                ref={transformerRef}
                rotateEnabled
                keepRatio={false}
                ignoreStroke
                borderStroke="#5D6B4D"
                borderStrokeWidth={1.5 / Math.max(scale, 0.01)}
                anchorStroke="#5D6B4D"
                anchorFill="#FFFDF9"
                anchorSize={10 / Math.max(scale, 0.01)}
                anchorCornerRadius={5 / Math.max(scale, 0.01)}
                rotateAnchorOffset={30 / Math.max(scale, 0.01)}
                padding={4 / Math.max(scale, 0.01)}
                boundBoxFunc={(oldBox, newBox) =>
                  newBox.width < 20 || newBox.height < 20 ? oldBox : newBox
                }
              />
            </Layer>
          </Stage>
        )}
      </div>
    );
  },
);
