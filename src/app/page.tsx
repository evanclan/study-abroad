import { AppShell } from '@/components/app-shell';

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 px-6 py-10 lg:px-10 lg:py-14">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.32em] text-slate-400">
          <span className="inline-flex h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_12px_2px_rgba(167,139,250,0.6)]" />
          かえる留学 · Internal Dashboard
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          AI-Augmented <span className="bg-gradient-to-r from-violet-300 via-fuchsia-200 to-sky-300 bg-clip-text text-transparent">Quote &amp; Knowledge Engine</span>
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-400">
          サプライヤー資料・キャンペーン・価格表をアップロードハブに集約し、AIが
          <span className="mx-1 rounded bg-fuchsia-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-fuchsia-300">DOCS</span>
          として索引化します。プロンプトを送ると
          <span className="mx-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-300">LOCAL</span>
          ナレッジを最優先で参照し、不足分のみ
          <span className="mx-1 rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sky-300">LIVE</span>
          Webから補完します。
        </p>
      </header>

      <AppShell />
    </main>
  );
}
