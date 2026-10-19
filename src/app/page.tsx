import Link from 'next/link';
import {
  ArrowRight,
  Download,
  ImagePlus,
  Layers,
  ShieldCheck,
  Wand2,
} from 'lucide-react';
import { STYLE_IDS, STYLE_PRESETS } from '@/lib/ai/styles';
import { StylePreview } from '@/components/ui/StylePreview';
import { RecentWorks } from '@/components/home/RecentWorks';
import { ButtonLink } from '@/components/ui/Button';

export default function HomePage() {
  return (
    <div className="pb-20">
      <section className="mx-auto max-w-page px-5 pb-14 pt-10 sm:px-8 lg:pb-20 lg:pt-16">
        <div className="grid items-center gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16">
          <div className="animate-fade-up">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs tracking-wide text-muted">
              <Wand2 className="h-3.5 w-3.5 text-sage-600" aria-hidden="true" />
              通用题材 · AI 手绘工作室
            </p>
            <h1 className="font-serif text-[2.6rem] leading-[1.12] tracking-tight text-ink sm:text-6xl lg:text-[4.2rem]">
              把照片，
              <br />
              画成一张作品。
            </h1>
            <p className="mt-6 max-w-xl text-[15px] leading-7 text-muted sm:text-base">
              上传任意一张照片，选择水彩、彩铅或钢笔速写。AI 保留主体与构图，
              将它转译成有真实媒介质感的手绘图片；再用排版工具加上文字、留白与装饰，
              导出完整的成品。
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/create" size="lg" className="group">
                上传照片，开始创作
                <ArrowRight
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </ButtonLink>
              <Link
                href="#styles"
                className="inline-flex h-12 items-center justify-center rounded-full border border-line bg-surface px-6 text-sm font-medium text-ink transition-colors hover:border-ink/30 hover:bg-paper"
              >
                先看看三种风格
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                密钥只保存在服务端
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                排版可以再次编辑
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                支持 PNG / JPEG 导出
              </span>
            </div>
          </div>

          <div className="relative mx-auto aspect-[4/3] w-full max-w-[540px] animate-fade-up lg:max-w-none">
            <div className="absolute inset-x-3 bottom-8 top-4 -rotate-2 rounded-[28px] border border-line bg-surface p-2.5 shadow-lift sm:inset-x-5">
              <StylePreview
                styleId="watercolor"
                className="h-full w-full rounded-[20px]"
              />
            </div>
            <div className="absolute -bottom-1 right-0 w-[42%] rotate-[4deg] rounded-2xl border border-line bg-surface p-1.5 shadow-soft">
              <StylePreview
                styleId="colored-pencil"
                className="aspect-[4/3] w-full rounded-xl"
              />
            </div>
            <div className="absolute -left-2 top-0 rounded-full border border-line bg-paper px-3 py-1.5 text-[11px] tracking-wide text-muted shadow-soft sm:-left-4">
              三种媒介 · 同一张照片
            </div>
            <p className="absolute bottom-1 left-2 text-[11px] text-muted sm:left-4">
              风格示意，不是 AI 生成结果
            </p>
          </div>
        </div>
      </section>

      <section
        id="styles"
        className="border-y border-line/70 bg-paper/60 py-16 lg:py-20"
      >
        <div className="mx-auto max-w-page px-5 sm:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs tracking-[0.2em] text-muted">STYLE PRESETS</p>
              <h2 className="mt-2 font-serif text-3xl tracking-tight sm:text-4xl">
                三种绘画媒介，不是三张滤镜
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-muted">
              每种风格都有独立的提示词、笔触与纸张描述。风格适用于不同题材，
              不由照片内容决定。
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {STYLE_IDS.map((id) => {
              const style = STYLE_PRESETS[id];
              return (
                <Link
                  key={id}
                  href={`/create?style=${id}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-all duration-300 hover:-translate-y-1 hover:border-ink/20"
                >
                  <StylePreview
                    styleId={id}
                    className="aspect-[4/3] w-full"
                  />
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="font-serif text-xl">{style.name}</h3>
                      <span className="text-[11px] text-muted">{style.subtitle}</span>
                    </div>
                    <p className="mt-3 flex-1 text-sm leading-6 text-muted">
                      {style.description}
                    </p>
                    <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-sage-700">
                      选择此风格
                      <ArrowRight
                        className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-page px-5 py-16 sm:px-8 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <p className="text-xs tracking-[0.2em] text-muted">HOW IT WORKS</p>
            <h2 className="mt-2 font-serif text-3xl tracking-tight sm:text-4xl">
              从一张照片，到一件完整成品
            </h2>
            <p className="mt-4 max-w-md text-sm leading-6 text-muted">
              生成只是第一步。文字与排版由 Canvas 确定性绘制，
              不让 AI 负责容易出错的中文标题。
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: ImagePlus,
                step: '01',
                title: '上传与裁剪',
                text: '手机相册、电脑文件或拖拽上传；支持比例裁剪与旋转。',
              },
              {
                icon: Wand2,
                step: '02',
                title: '选择媒介',
                text: '水彩、彩铅或钢笔速写；可控制更接近原图或更艺术化。',
              },
              {
                icon: Layers,
                step: '03',
                title: '排版与导出',
                text: '套用海报模板，编辑图片、中文文字、背景与边框。',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-2xl border border-line bg-surface p-5"
              >
                <div className="flex items-center justify-between">
                  <item.icon
                    className="h-5 w-5 text-sage-600"
                    aria-hidden="true"
                  />
                  <span className="font-serif text-lg text-line">{item.step}</span>
                </div>
                <h3 className="mt-5 text-sm font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line/70 py-16 lg:py-20">
        <div className="mx-auto max-w-page px-5 sm:px-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs tracking-[0.2em] text-muted">RECENT WORKS</p>
              <h2 className="mt-2 font-serif text-3xl tracking-tight">
                最近的作品
              </h2>
            </div>
            <Link
              href="/works"
              className="text-sm text-muted transition-colors hover:text-ink"
            >
              查看全部 →
            </Link>
          </div>
          <div className="mt-8">
            <RecentWorks />
          </div>
          <p className="mt-4 text-xs text-muted">
            当前版本按浏览器匿名会话保存作品，不会自动同步到其他设备。
          </p>
        </div>
      </section>

      <footer className="border-t border-line/70 bg-paper/50">
        <div className="mx-auto flex max-w-page flex-col gap-4 px-5 py-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>绘相 · 通用 AI 手绘与海报排版工具</p>
          <p>
            生成结果由第三方 AI 服务提供；请在公开分享前阅读相应服务条款。
          </p>
        </div>
      </footer>
    </div>
  );
}
