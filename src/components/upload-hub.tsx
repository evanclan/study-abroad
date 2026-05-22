'use client';

import { useCallback, useRef, useState, type DragEvent } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { useUploadHub, type UploadProgress } from '@/hooks/use-upload-hub';
import {
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
  Loader2,
  RefreshCcw,
  Sparkles,
  Tag,
  Trash2,
  UploadCloud,
} from 'lucide-react';

const ACCEPTED_EXT = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.html,.json,.png,.jpg,.jpeg,.gif,.webp';

function fileIconFor(mimeType: string) {
  if (mimeType.startsWith('image/')) return FileImage;
  if (
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel') ||
    mimeType === 'text/csv'
  )
    return FileSpreadsheet;
  if (mimeType === 'application/pdf') return FileType;
  return FileText;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('ja-JP', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusVariant(s: UploadProgress['status']) {
  switch (s) {
    case 'analyzed':
      return { label: '解析完了', icon: CheckCircle2, color: 'text-emerald-300' };
    case 'reused':
      return { label: '再利用', icon: CheckCircle2, color: 'text-sky-300' };
    case 'failed':
      return { label: '失敗', icon: CircleAlert, color: 'text-rose-300' };
    case 'queued':
      return { label: '待機中', icon: Loader2, color: 'text-slate-300' };
    case 'uploading':
      return { label: 'アップロード中', icon: Loader2, color: 'text-sky-300' };
    case 'processing':
    default:
      return { label: '解析中', icon: Loader2, color: 'text-violet-300' };
  }
}

export function UploadHub() {
  const { documents, uploads, loadingDocuments, errorMessage, upload, refresh, remove } =
    useUploadHub();
  const [dragActive, setDragActive] = useState(false);
  const [sourceLabel, setSourceLabel] = useState('');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = useCallback(
    async (files: FileList | File[] | null) => {
      if (!files) return;
      const list = Array.from(files);
      await upload(list, {
        sourceLabel: sourceLabel || undefined,
        tags: tags || undefined,
        description: description || undefined,
      });
    },
    [upload, sourceLabel, tags, description],
  );

  const onDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setDragActive(false);
      await handleFiles(event.dataTransfer.files);
    },
    [handleFiles],
  );

  const onDragEvents = useCallback((event: DragEvent<HTMLDivElement>, active: boolean) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(active);
  }, []);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.32em] text-slate-400">
          <span className="inline-flex h-2 w-2 rounded-full bg-fuchsia-400 shadow-[0_0_12px_2px_rgba(232,121,249,0.6)]" />
          かえる留学 · Upload Hub
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          会社の<span className="bg-gradient-to-r from-fuchsia-300 via-violet-200 to-sky-300 bg-clip-text text-transparent">全てのナレッジ</span>をAIに学習させる
        </h2>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-400">
          サプライヤーの見積書 (PDF), キャンペーン資料 (Word/PNG), 価格表 (Excel/CSV),
          学校パンフレット (画像), 社内ルール (テキスト/JSON) など、なんでもドロップしてください。
          Claude が中身を読み取り、学校・価格・キャンペーン・宿泊・ルールなどの
          検索可能なナレッジアトムに変換し、Supabaseに保存します。
        </p>
      </header>

      <div
        onDragOver={(e) => onDragEvents(e, true)}
        onDragEnter={(e) => onDragEvents(e, true)}
        onDragLeave={(e) => onDragEvents(e, false)}
        onDrop={onDrop}
        className={cn(
          'group relative flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-white/10 bg-white/[0.02] p-10 text-center transition-colors',
          dragActive && 'border-fuchsia-400/60 bg-fuchsia-500/[0.06]',
        )}
      >
        <div
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 ring-1 ring-inset ring-white/10 transition-transform',
            dragActive && 'scale-110',
          )}
        >
          <UploadCloud className="h-7 w-7 text-violet-200" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-white">
            ファイルをドロップ、または
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="ml-1.5 text-violet-300 underline-offset-4 transition hover:text-violet-200 hover:underline"
            >
              選択
            </button>
          </p>
          <p className="text-[11px] text-slate-500">
            PDF · Word · Excel · CSV · JSON · 画像 (PNG/JPG/WebP) · テキスト / 1ファイル最大 50MB
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXT}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />

        <div className="mt-2 grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            value={sourceLabel}
            onChange={(e) => setSourceLabel(e.target.value)}
            placeholder="サプライヤー / キャンペーン名 (任意)"
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-violet-400/50 focus:outline-none"
          />
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="タグ (カンマ区切り)"
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-violet-400/50 focus:outline-none"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="メモ / 文脈 (任意)"
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-violet-400/50 focus:outline-none"
          />
        </div>
      </div>

      {/* Upload progress strip */}
      {uploads.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-3xl border border-white/5 bg-white/[0.02] p-4">
          <div className="text-[10px] uppercase tracking-[0.22em] text-slate-400">
            最近のアップロード処理
          </div>
          <ul className="flex flex-col gap-1.5">
            {uploads.map((u) => {
              const variant = statusVariant(u.status);
              const Icon = variant.icon;
              const isSpinning =
                u.status === 'queued' ||
                u.status === 'uploading' ||
                u.status === 'processing';
              return (
                <li
                  key={u.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-black/20 px-3 py-2 text-xs"
                >
                  <span className="truncate text-slate-200">{u.filename}</span>
                  <div className="flex items-center gap-2">
                    {u.entities != null && u.status === 'analyzed' ? (
                      <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-300">
                        {u.entities}件のアトム抽出
                      </span>
                    ) : null}
                    {u.error ? (
                      <span className="truncate text-[10px] text-rose-300" title={u.error}>
                        {u.error.slice(0, 40)}
                      </span>
                    ) : null}
                    <span className={cn('inline-flex items-center gap-1', variant.color)}>
                      <Icon
                        className={cn(
                          'h-3.5 w-3.5',
                          isSpinning && 'animate-spin',
                        )}
                      />
                      {variant.label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {/* Documents list */}
      <div className="flex flex-col gap-3 rounded-3xl border border-white/5 bg-white/[0.02] p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-300" />
            <h3 className="text-sm font-semibold text-white">ナレッジベース</h3>
            <span className="text-[11px] text-slate-400">
              {documents.length}件の資料
            </span>
          </div>
          <Button
            variant="ghost"
            onClick={() => void refresh()}
            disabled={loadingDocuments}
          >
            <RefreshCcw
              className={cn(
                'h-3.5 w-3.5',
                loadingDocuments && 'animate-spin',
              )}
            />
            更新
          </Button>
        </div>

        {errorMessage ? (
          <div className="rounded-xl border border-rose-400/30 bg-rose-500/[0.08] px-3 py-2 text-xs text-rose-200">
            {errorMessage}
          </div>
        ) : null}

        {loadingDocuments && documents.length === 0 ? (
          <div className="grid gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-[72px] animate-pulse rounded-xl bg-white/[0.04]"
              />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-xs text-slate-400">
            まだナレッジが登録されていません。上のエリアにファイルをドロップしてください。
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {documents.map((d) => {
              const Icon = fileIconFor(d.mime_type);
              return (
                <li
                  key={d.id}
                  className="group rounded-2xl border border-white/5 bg-white/[0.02] p-3 transition hover:border-white/15"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/15 to-fuchsia-500/15 ring-1 ring-inset ring-white/10">
                      <Icon className="h-4 w-4 text-violet-200" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium text-white">
                          {d.title ?? d.filename}
                        </span>
                        <StatusBadge status={d.status} />
                        {d.country_codes?.length ? (
                          <span className="rounded-full bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-slate-300">
                            {d.country_codes.join(' · ')}
                          </span>
                        ) : null}
                        {d.school_name ? (
                          <span className="rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-300">
                            {d.school_name}
                          </span>
                        ) : null}
                      </div>
                      {d.extracted_summary_ja ? (
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400">
                          {d.extracted_summary_ja}
                        </p>
                      ) : null}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                        <span>{formatBytes(d.file_size_bytes)}</span>
                        <span>·</span>
                        <span>{formatDate(d.uploaded_at)}</span>
                        {d.source_label ? (
                          <>
                            <span>·</span>
                            <span className="text-slate-300">{d.source_label}</span>
                          </>
                        ) : null}
                        {d.ai_keywords?.length ? (
                          <span className="ml-2 inline-flex items-center gap-1">
                            <Tag className="h-2.5 w-2.5" />
                            {d.ai_keywords.slice(0, 4).join(', ')}
                          </span>
                        ) : null}
                      </div>
                      {d.error_message ? (
                        <p className="mt-1 text-[10px] text-rose-300">
                          {d.error_message}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {d.storage_signed_url ? (
                        <a
                          href={d.storage_signed_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
                          aria-label="原資料を開く"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void remove(d.id)}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300"
                        aria-label="削除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'analyzed':
      return <Badge variant="local">解析完了</Badge>;
    case 'extracted':
      return <Badge variant="accent">テキスト抽出済</Badge>;
    case 'processing':
      return <Badge variant="live">処理中</Badge>;
    case 'failed':
      return <Badge variant="warn">失敗</Badge>;
    case 'archived':
      return <Badge variant="neutral">アーカイブ</Badge>;
    case 'uploaded':
    default:
      return <Badge variant="neutral">待機中</Badge>;
  }
}
