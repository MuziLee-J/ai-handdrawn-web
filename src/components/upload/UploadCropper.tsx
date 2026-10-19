'use client';

import dynamic from 'next/dynamic';
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import type { Area, Point } from 'react-easy-crop';
import {
  Check,
  Crop,
  ImagePlus,
  Loader2,
  RefreshCw,
  RotateCw,
  Upload,
} from 'lucide-react';
import { uploadSourceImage, type AssetDto } from '@/lib/client/api';
import {
  cropImageToBlob,
  readImageSize,
  rotateFile,
} from '@/lib/client/crop';
import { formatBytes } from '@/lib/utils';

const Cropper = dynamic(() => import('react-easy-crop').then((mod) => mod.default), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-paper/70">
      正在准备裁剪器…
    </div>
  ),
});

const ASPECTS = [
  { label: '3:4', value: 3 / 4 },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '16:9', value: 16 / 9 },
] as const;

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function inferType(file: File): string | null {
  if (file.type && ALLOWED_TYPES.has(file.type)) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return null;
}

export function UploadCropper({
  onUploaded,
  uploadedAsset,
}: {
  onUploaded: (asset: AssetDto) => void;
  uploadedAsset: AssetDto | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState<number>(3 / 4);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  function replaceObjectUrl(nextFile: File) {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(nextFile);
    objectUrlRef.current = url;
    setImageUrl(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(null);
    readImageSize(url)
      .then(setDimensions)
      .catch(() => setDimensions(null));
  }

  async function acceptFile(nextFile: File) {
    setError(null);
    const mime = inferType(nextFile);
    if (!mime) {
      setError('仅支持 JPEG、PNG、WebP 图片；HEIC/HEIF 请先转换为 JPEG。');
      return;
    }
    if (nextFile.size > 15 * 1024 * 1024) {
      setError('图片超过 15MB，请先压缩或选择更小的文件。');
      return;
    }
    setFile(nextFile);
    replaceObjectUrl(nextFile);
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (selected) void acceptFile(selected);
    event.target.value = '';
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragOver(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) void acceptFile(dropped);
  }

  async function handleRotate() {
    if (!file || rotating) return;
    setRotating(true);
    setError(null);
    try {
      const rotated = await rotateFile(file, 90);
      setFile(rotated);
      replaceObjectUrl(rotated);
    } catch (rotateError) {
      setError(rotateError instanceof Error ? rotateError.message : '旋转失败');
    } finally {
      setRotating(false);
    }
  }

  async function handleConfirm() {
    if (!imageUrl || !croppedArea || busy) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await cropImageToBlob(imageUrl, croppedArea, 2048);
      const croppedFile = new File([blob], 'handdrawn-source.jpg', {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });
      const asset = await uploadSourceImage(croppedFile);
      onUploaded(asset);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : '上传失败，请重试。',
      );
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setFile(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(null);
    setDimensions(null);
    setError(null);
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setImageUrl(null);
  }

  if (uploadedAsset) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-3">
        <div className="relative overflow-hidden rounded-xl bg-paper">
          <img
            src={uploadedAsset.url}
            alt="已上传的原始照片"
            className="mx-auto max-h-[320px] w-auto object-contain"
          />
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-sage-600 px-2.5 py-1 text-xs text-white">
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            已上传
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
          <span>
            {uploadedAsset.width} × {uploadedAsset.height} ·{' '}
            {formatBytes(uploadedAsset.bytes)}
          </span>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs text-ink hover:bg-paper"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            重新选择
          </button>
        </div>
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div>
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex min-h-[300px] flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors sm:min-h-[360px] ${
            dragOver
              ? 'border-sage-500 bg-sage-50'
              : 'border-line bg-surface/60 hover:border-sage-500/60'
          }`}
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-paper text-sage-600">
            <ImagePlus className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="mt-4 text-base font-medium">拖拽照片到这里</p>
          <p className="mt-1 text-sm text-muted">
            或从设备中选择一张照片，支持 JPEG / PNG / WebP，最大 15MB
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm text-paper hover:bg-sage-700"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            选择照片
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={handleInput}
            aria-label="选择照片文件"
          />
          <p className="mt-4 text-[11px] text-muted">
            裁剪后的副本会上传到本机服务端；原始文件不会被修改。
          </p>
        </div>
        {error && (
          <p className="mt-3 rounded-xl border border-clay/30 bg-clay/5 px-4 py-2.5 text-sm text-clay">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="relative h-[330px] bg-ink sm:h-[430px]">
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(_area, areaPixels) => setCroppedArea(areaPixels)}
          objectFit="contain"
          showGrid
          restrictPosition
          minZoom={1}
          maxZoom={4}
          zoomWithScroll
          rotation={0}
          cropShape="rect"
          zoomSpeed={1}
          style={{}}
          classes={{}}
          mediaProps={{}}
          cropperProps={{}}
          keyboardStep={1}
        />
        {rotating && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/40 text-sm text-paper">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            正在旋转…
          </div>
        )}
      </div>

      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">比例</span>
          {ASPECTS.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setAspect(item.value)}
              className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                aspect === item.value
                  ? 'bg-ink text-paper'
                  : 'border border-line text-muted hover:text-ink'
              }`}
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={handleRotate}
            disabled={rotating}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:text-ink disabled:opacity-50"
          >
            <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
            旋转 90°
          </button>
        </div>

        <label className="flex items-center gap-3 text-xs text-muted">
          <span className="shrink-0">缩放</span>
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="h-1.5 w-full accent-sage-600"
            aria-label="缩放照片"
          />
          <span className="w-10 text-right">{zoom.toFixed(1)}×</span>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
          <span>
            {dimensions ? `${dimensions.width} × ${dimensions.height}px` : '读取尺寸…'}
            {file ? ` · ${formatBytes(file.size)}` : ''}
          </span>
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 text-muted hover:text-ink"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            换一张
          </button>
        </div>

        {error && (
          <p className="rounded-xl border border-clay/30 bg-clay/5 px-4 py-2.5 text-sm text-clay">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleConfirm}
          disabled={busy || !croppedArea}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-paper hover:bg-sage-700 disabled:cursor-not-allowed disabled:bg-muted/40"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              正在上传裁剪结果…
            </>
          ) : (
            <>
              <Crop className="h-4 w-4" aria-hidden="true" />
              使用这张照片
            </>
          )}
        </button>
      </div>
    </div>
  );
}
