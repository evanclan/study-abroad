import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { extractText as extractPdfText, getDocumentProxy, getMeta } from 'unpdf';

import { getAnthropic, CLAUDE_MODEL } from '@/lib/ai/anthropic-client';

const IMAGE_OCR_PROMPT = `あなたは留学エージェントの資料デジタル化アシスタントです。
画像に含まれる全てのテキスト・価格表・スクールロゴ・キャンペーン情報・住所・連絡先を
できる限り正確に書き起こしてください。表は markdown 表で再現してください。
日本語の手書き、英語、スキャンPDFの低解像度画像も対象です。
書き起こせた内容のみを返してください。前置きや要約は不要です。`;

export type FileKind =
  | 'pdf'
  | 'docx'
  | 'xlsx'
  | 'csv'
  | 'image'
  | 'text'
  | 'html'
  | 'json'
  | 'unknown';

export interface ExtractedTextResult {
  kind: FileKind;
  text: string;
  pageCount?: number;
  metadata?: Record<string, unknown>;
  warnings: string[];
}

const TEXT_LIKE_PREFIXES = ['text/', 'application/json'];
const IMAGE_MIME_TYPES_FOR_CLAUDE = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
] as const;

export function classifyFile(filename: string, mimeType: string): FileKind {
  const lowerName = filename.toLowerCase();
  if (mimeType === 'application/pdf' || lowerName.endsWith('.pdf')) return 'pdf';
  if (
    mimeType ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lowerName.endsWith('.docx')
  )
    return 'docx';
  if (
    mimeType ===
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel' ||
    lowerName.endsWith('.xlsx') ||
    lowerName.endsWith('.xls')
  )
    return 'xlsx';
  if (mimeType === 'text/csv' || lowerName.endsWith('.csv')) return 'csv';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/json' || lowerName.endsWith('.json')) return 'json';
  if (mimeType === 'text/html' || lowerName.endsWith('.html')) return 'html';
  if (TEXT_LIKE_PREFIXES.some((p) => mimeType.startsWith(p))) return 'text';
  return 'unknown';
}

/**
 * Universal extractor. Routes to the right parser based on filename + MIME,
 * always returns a single normalized markdown-ish text string. The downstream
 * AI analyzer ingests this text to extract structured entities.
 */
export async function extractTextFromUpload(input: {
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
}): Promise<ExtractedTextResult> {
  const kind = classifyFile(input.filename, input.mimeType);
  const warnings: string[] = [];

  try {
    switch (kind) {
      case 'pdf':
        return await extractPdf(input.bytes, warnings);
      case 'docx':
        return await extractDocx(input.bytes, warnings);
      case 'xlsx':
        return extractXlsx(input.bytes, warnings);
      case 'csv':
        return extractCsv(input.bytes, warnings);
      case 'image':
        return await extractImage(input.bytes, input.mimeType, warnings);
      case 'json':
        return extractJson(input.bytes, warnings);
      case 'html':
        return extractHtml(input.bytes, warnings);
      case 'text':
        return extractPlainText(input.bytes, warnings);
      case 'unknown':
      default:
        return tryPlainTextFallback(input.bytes, warnings);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Text extraction failed (${kind}): ${message}`);
  }
}

// =============================================================================
// PDF
// =============================================================================

async function extractPdf(
  bytes: Uint8Array,
  warnings: string[],
): Promise<ExtractedTextResult> {
  // unpdf wants a fresh ArrayBuffer per doc (workers strip nullable bytes).
  const buf = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
  const proxy = await getDocumentProxy(new Uint8Array(buf));

  let meta: Record<string, unknown> = {};
  try {
    const m = await getMeta(proxy);
    meta = {
      info: m.info,
    };
  } catch {
    /* metadata is optional */
  }

  const result = await extractPdfText(proxy, { mergePages: true });

  let text = (result.text ?? '').trim();
  if (text.length < 40 && result.totalPages > 0) {
    warnings.push(
      'PDFに埋め込みテキストがほぼ含まれていないため、スキャン画像かもしれません。OCRを検討してください。',
    );
  }

  return {
    kind: 'pdf',
    text,
    pageCount: result.totalPages,
    metadata: meta,
    warnings,
  };
}

// =============================================================================
// DOCX (.docx only; legacy .doc is not supported)
// =============================================================================

async function extractDocx(
  bytes: Uint8Array,
  warnings: string[],
): Promise<ExtractedTextResult> {
  const buffer = Buffer.from(bytes);
  const result = await mammoth.extractRawText({ buffer });
  if (result.messages?.length) {
    for (const m of result.messages) {
      if (m.type === 'warning') warnings.push(m.message);
    }
  }
  return {
    kind: 'docx',
    text: result.value.trim(),
    warnings,
  };
}

// =============================================================================
// XLSX / XLS / Excel-flavoured price lists
// =============================================================================

function extractXlsx(
  bytes: Uint8Array,
  warnings: string[],
): ExtractedTextResult {
  const wb = XLSX.read(bytes, { type: 'array' });
  const blocks: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const md = XLSX.utils.sheet_to_csv(sheet, { FS: ' | ', RS: '\n' });
    if (md.trim().length === 0) continue;
    blocks.push(`# Sheet: ${sheetName}\n\n${md.trim()}`);
  }
  if (blocks.length === 0) warnings.push('Excelシートが空でした。');
  return {
    kind: 'xlsx',
    text: blocks.join('\n\n---\n\n'),
    metadata: { sheets: wb.SheetNames },
    warnings,
  };
}

// =============================================================================
// CSV
// =============================================================================

function extractCsv(
  bytes: Uint8Array,
  warnings: string[],
): ExtractedTextResult {
  const text = bytesToString(bytes);
  const trimmed = text.trim();
  if (trimmed.length === 0) warnings.push('CSVが空でした。');
  return {
    kind: 'csv',
    text: trimmed,
    warnings,
  };
}

// =============================================================================
// JSON
// =============================================================================

function extractJson(
  bytes: Uint8Array,
  warnings: string[],
): ExtractedTextResult {
  try {
    const text = bytesToString(bytes);
    const parsed = JSON.parse(text);
    return {
      kind: 'json',
      text: JSON.stringify(parsed, null, 2),
      warnings,
    };
  } catch {
    warnings.push('JSONとしてパースできませんでした。プレーンテキストとして扱います。');
    return {
      kind: 'json',
      text: bytesToString(bytes),
      warnings,
    };
  }
}

// =============================================================================
// HTML (strip tags)
// =============================================================================

function extractHtml(
  bytes: Uint8Array,
  warnings: string[],
): ExtractedTextResult {
  const html = bytesToString(bytes);
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { kind: 'html', text, warnings };
}

// =============================================================================
// Plain text
// =============================================================================

function extractPlainText(
  bytes: Uint8Array,
  warnings: string[],
): ExtractedTextResult {
  return { kind: 'text', text: bytesToString(bytes).trim(), warnings };
}

function tryPlainTextFallback(
  bytes: Uint8Array,
  warnings: string[],
): ExtractedTextResult {
  // If the bytes look like utf-8 text, treat as text. Otherwise return empty
  // and warn so the AI analyzer can degrade gracefully.
  const text = bytesToString(bytes);
  const printable = text.match(/[\p{L}\p{N}\p{P}\s]/gu);
  const ratio = printable ? printable.length / Math.max(1, text.length) : 0;
  if (ratio > 0.7) {
    return { kind: 'unknown', text: text.trim(), warnings };
  }
  warnings.push('ファイル形式を認識できず、テキストを抽出できませんでした。');
  return { kind: 'unknown', text: '', warnings };
}

// =============================================================================
// Images → Claude Vision OCR / description
// =============================================================================

async function extractImage(
  bytes: Uint8Array,
  mimeType: string,
  warnings: string[],
): Promise<ExtractedTextResult> {
  const supported = (
    IMAGE_MIME_TYPES_FOR_CLAUDE as readonly string[]
  ).includes(mimeType);
  if (!supported) {
    warnings.push(`Claude Visionが ${mimeType} をサポートしていません。`);
    return { kind: 'image', text: '', warnings };
  }

  const base64 = Buffer.from(bytes).toString('base64');
  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    system: IMAGE_OCR_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/png',
              data: base64,
            },
          },
          {
            type: 'text',
            text: 'この画像に含まれる全ての情報を書き起こしてください。',
          },
        ],
      },
    ],
  });

  const text = response.content
    .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();

  if (text.length === 0) warnings.push('画像からテキストを抽出できませんでした。');

  return { kind: 'image', text, warnings };
}

// =============================================================================
// Helpers
// =============================================================================

function bytesToString(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  } catch {
    return Buffer.from(bytes).toString('utf-8');
  }
}

/**
 * Split a long string into ~1.5k-char chunks so each can be embedded /
 * searched / displayed independently. We split on paragraph then on sentence
 * boundaries to keep chunks semantically coherent.
 */
export function chunkText(
  text: string,
  targetChars = 1500,
  overlap = 150,
): string[] {
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (clean.length === 0) return [];
  if (clean.length <= targetChars) return [clean];

  const paragraphs = clean.split(/\n{2,}/);
  const chunks: string[] = [];
  let buffer = '';

  const flush = () => {
    const piece = buffer.trim();
    if (piece.length > 0) chunks.push(piece);
    buffer = '';
  };

  for (const p of paragraphs) {
    if ((buffer + '\n\n' + p).length <= targetChars) {
      buffer = buffer ? `${buffer}\n\n${p}` : p;
      continue;
    }
    if (p.length <= targetChars) {
      flush();
      buffer = p;
      continue;
    }
    // Long paragraph: split on sentence-ish boundaries.
    flush();
    const sentences = p.split(/(?<=[。．！？!?\.])\s+/);
    for (const s of sentences) {
      if ((buffer + ' ' + s).length <= targetChars) {
        buffer = buffer ? `${buffer} ${s}` : s;
      } else {
        flush();
        buffer = s;
      }
    }
  }
  flush();

  if (overlap <= 0 || chunks.length <= 1) return chunks;

  // Add a small head-of-previous overlap to the front of each subsequent chunk.
  const out: string[] = [chunks[0]];
  for (let i = 1; i < chunks.length; i++) {
    const prev = chunks[i - 1];
    const head = prev.slice(Math.max(0, prev.length - overlap));
    out.push(`${head}\n\n${chunks[i]}`);
  }
  return out;
}
