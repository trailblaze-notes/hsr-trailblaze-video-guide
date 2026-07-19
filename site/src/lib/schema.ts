import { z } from 'zod';
import { compareVersion } from './version';
import majorsData from '../data/majors.json';

// 表示順 = この配列の順（バージョンページのセクション順）
export const VIDEO_TYPES = ['trailblaze', 'character', 'version', 'music'] as const;
export type VideoType = (typeof VIDEO_TYPES)[number];

export const VIDEO_TYPE_LABELS: Record<VideoType, string> = {
  trailblaze: '紀行PV・ストーリー',
  character: 'キャラクターPV',
  version: 'バージョン予告・特別番組',
  music: 'EP・MV・アニメーション',
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 形式で指定してください');
const versionId = z.string().regex(/^\d+\.\d+$/, '"1.0" のような major.minor 形式で指定してください');

export const videoSchema = z.object({
  // YouTube 動画 ID は 11 文字の [A-Za-z0-9_-]
  youtubeId: z.string().regex(/^[\w-]{11}$/),
  title: z.string().min(1),
  type: z.enum(VIDEO_TYPES),
  publishedAt: isoDate,
  // before: このバージョンが来る前に見る（既定） / after: このバージョンを終えた後に見る
  phase: z.enum(['before', 'after']).default('before'),
  // おすすめ理由。現行 UI では非表示（データとしては保持してよい）
  reason: z.string().optional(),
  // 公式が埋め込みを無効化している動画はリンクのみ表示する
  embeddable: z.boolean().default(true),
  // 機械分類（公開日基準）から後ろのバージョンへ手動移動した場合のみ指定
  movedFrom: versionId.optional(),
  note: z.string().min(1).optional(),
});

export const versionSchema = z
  .object({
    id: versionId,
    name: z.string().min(1),
    startDate: isoDate,
    videos: z.array(videoSchema),
  })
  .superRefine((version, ctx) => {
    version.videos.forEach((video, i) => {
      // ネタバレ防止の核:
      //  before = バージョン開始日より前に公開された動画のみ / after = 開始日以降に公開された動画のみ
      if (video.phase === 'before' && video.publishedAt >= version.startDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['videos', i, 'publishedAt'],
          message: `公開日 ${video.publishedAt} が Ver.${version.id} 開始日 ${version.startDate} 以降です（「来る前に見る」の規則違反）`,
        });
      }
      if (video.phase === 'after' && !video.movedFrom && video.publishedAt < version.startDate) {
        // movedFrom 付きは「内容都合でクリア後へ手動移動した動画」なので公開日制約を免除する
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['videos', i, 'publishedAt'],
          message: `公開日 ${video.publishedAt} が Ver.${version.id} 開始日 ${version.startDate} より前です（「終えた後に見る」の規則違反。手動移動なら movedFrom と note を指定）`,
        });
      }
      if (video.movedFrom && !video.note) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['videos', i, 'note'],
          message: 'movedFrom（後ろ倒し）指定時は note に根拠を必ず記録してください',
        });
      }
    });
  });

export type Video = z.infer<typeof videoSchema>;
export type Version = z.infer<typeof versionSchema>;

/** endDate = 次バージョンの開始日（最新バージョンのみ null） */
export interface VersionEntry extends Version {
  endDate: string | null;
}

const modules = import.meta.glob('../data/versions/*.json', { eager: true });

export function loadVersions(): VersionEntry[] {
  const versions = Object.entries(modules)
    .map(([path, mod]) => {
      const parsed = versionSchema.safeParse((mod as { default: unknown }).default);
      if (!parsed.success) {
        throw new Error(`バージョンデータが不正です: ${path}\n${parsed.error.message}`);
      }
      const fileId = path.split('/').pop()!.replace(/\.json$/, '');
      if (parsed.data.id !== fileId) {
        throw new Error(`id "${parsed.data.id}" がファイル名と一致しません: ${path}`);
      }
      return parsed.data;
    })
    .sort((a, b) => compareVersion(a.id, b.id));

  // バージョン横断の整合検証
  const ids = new Set(versions.map((v) => v.id));
  versions.forEach((version, i) => {
    const prev = versions[i - 1];
    if (prev && prev.startDate >= version.startDate) {
      throw new Error(`Ver.${version.id} の startDate がバージョン順と矛盾しています（Ver.${prev.id} 以前の日付）`);
    }
    version.videos.forEach((video) => {
      if (video.movedFrom) {
        if (!ids.has(video.movedFrom)) {
          throw new Error(`Ver.${version.id} の「${video.title}」の movedFrom "${video.movedFrom}" が存在しません`);
        }
        if (compareVersion(video.movedFrom, version.id) >= 0) {
          throw new Error(`Ver.${version.id} の「${video.title}」の movedFrom は自バージョンより前でなければなりません`);
        }
      } else if (video.phase === 'before' && prev && video.publishedAt < prev.startDate) {
        // 機械分類規則: Ver.N の before には Ver.(N-1) 期間 [start(N-1), start(N)) の動画を載せる
        throw new Error(
          `Ver.${version.id} の「${video.title}」は公開日 ${video.publishedAt} が直前バージョン期間より古いため、movedFrom と note が必要です`
        );
      }
      const next = versions[i + 1];
      if (video.phase === 'after' && !video.movedFrom && next && video.publishedAt >= next.startDate) {
        // after は当該バージョン期間 [start(N), start(N+1)) 内の公開分のみ
        throw new Error(
          `Ver.${version.id} の「${video.title}」（終えた後に見る）は公開日 ${video.publishedAt} が次バージョン開始 ${next.startDate} 以降です`
        );
      }
    });
  });

  return versions.map((version, i) => ({
    ...version,
    endDate: versions[i + 1]?.startDate ?? null,
  }));
}

/** メジャーバージョン（"1", "2", …）ごとのグループ。ページ単位はこちら */
export interface MajorGroup {
  major: string;
  /** 編名（ストーリーアーク）。site/src/data/majors.json で管理 */
  arc: string | null;
  versions: VersionEntry[];
}

const majorArcs = majorsData as Record<string, string>;

export function groupByMajor(versions: VersionEntry[]): MajorGroup[] {
  const groups = new Map<string, VersionEntry[]>();
  for (const version of versions) {
    const major = version.id.split('.')[0];
    const list = groups.get(major) ?? [];
    list.push(version);
    groups.set(major, list);
  }
  // loadVersions() がソート済みなので Map の挿入順 = メジャー昇順
  return [...groups.entries()].map(([major, list]) => ({
    major,
    arc: majorArcs[major] ?? null,
    versions: list,
  }));
}
