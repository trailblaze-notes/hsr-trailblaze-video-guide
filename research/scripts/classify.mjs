#!/usr/bin/env node
// 収集済み動画（raw-videos.json）を versions-master.json の日付でバージョン機械分類し、
// videos-master.json（canonical 中間データ）を生成する。依存ゼロ・Node 18+。
//
// 分類規則:
//   phase "before"（既定）: 公開日 ∈ [start(N-1), start(N)) → Ver.N ページ「来る前に見る」
//   phase "after": 公開日 ∈ [start(M), start(M+1)) → Ver.M ページ「終えた後に見る」
// after になる条件:
//   - raw エントリに "phase": "after" が明示されている
//   - AFTER_TITLES（ユーザー指定）にタイトルが部分一致する
//   - type=character かつ 公開日がバージョン期間の中盤（= そのバージョン後半ピックアップキャラの PV）
//     ※ 次バージョン開始の 7 日以内に公開されたキャラ PV は「次バージョン実装キャラの前日公開」
//       パターンとみなし従来どおり before（バージョン開始前公開キャラを除くというユーザー指定の例外）
// raw エントリの "phase": "before" 明示で自動 after 判定を打ち消せる

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const master = JSON.parse(readFileSync(join(root, 'data/versions-master.json'), 'utf8'));
const raw = JSON.parse(readFileSync(join(root, 'data/raw-videos.json'), 'utf8'));

// ユーザーレビューで「そのバージョンを終えた後」指定された動画（部分一致）
const AFTER_TITLES = [
  '誓環の石心・天秤の両端',
  '浮雲とは似て非なり',
  'EP「洞窟の寓話」',
  'オンパロス英雄記',
  'こんにちは、世界',
  'キュレネの寝物語',
  'ハローワールド',
];

const versions = [...master.versions].sort((a, b) => {
  const [am, an] = a.id.split('.').map(Number);
  const [bm, bn] = b.id.split('.').map(Number);
  return am - bm || an - bn;
});

function assign(video) {
  // pinVersion: ユーザー指定でバージョンを固定（movedFrom / note は raw 側に記録する）
  if (video.pinVersion) {
    return { assignedVersion: video.pinVersion, phase: video.phase ?? 'before' };
  }
  // containing window M = startDate <= publishedAt を満たす最後のバージョン
  let m = -1;
  versions.forEach((v, i) => {
    if (v.startDate <= video.publishedAt) m = i;
  });

  const afterListed = AFTER_TITLES.some((t) => video.title.includes(t));
  // キャラPV: バージョン期間の中盤公開（次バージョン開始まで8日以上）なら当該バージョン後半のピックアップキャラとみなす
  const nextVersion = versions[m + 1];
  const daysToNext = nextVersion
    ? (new Date(nextVersion.startDate) - new Date(video.publishedAt)) / 86400000
    : Infinity;
  const charMidWindow =
    video.type === 'character' && m >= 0 && versions[m].startDate < video.publishedAt && daysToNext > 7;
  const phase = video.phase ?? (afterListed || charMidWindow ? 'after' : 'before');

  if (phase === 'after' && m >= 0) {
    return { assignedVersion: versions[m].id, phase: 'after' };
  }
  const next = versions[m + 1];
  return { assignedVersion: next ? next.id : null, phase: 'before' };
}

const seen = new Map();
const duplicates = [];
for (const video of raw.videos) {
  // pinVersion 付きエントリは「意図的な重複掲載」（例: 序盤にもクリア後にも載せる）なのでキーを分ける
  const key = `${video.youtubeId ?? `title:${video.title}`}|${video.pinVersion ?? ''}|${video.phase ?? ''}`;
  if (seen.has(key)) {
    duplicates.push(video.title);
    continue;
  }
  const { assignedVersion, phase } = assign(video);
  seen.set(key, {
    youtubeId: video.youtubeId ?? null,
    title: video.title,
    publishedAt: video.publishedAt,
    approx: video.approx ?? false,
    type: video.type,
    reason: video.reasonDraft ?? video.reason ?? '',
    assignedVersion,
    phase,
    excludeFromTypePages: video.excludeFromTypePages ?? false,
    movedFrom: video.movedFrom ?? null,
    note: video.note ?? null,
    spoilerNote: video.spoilerNote ?? null,
    sourceUrl: video.sourceUrl ?? null,
    status: 'auto',
  });
}

const videos = [...seen.values()].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));

// バージョン境界±3日の動画は誤分類リスクとしてフラグ
const boundaryFlags = [];
for (const video of videos) {
  for (const v of versions) {
    const diff = Math.abs(new Date(video.publishedAt) - new Date(v.startDate)) / 86400000;
    if (diff <= 3) {
      boundaryFlags.push({ title: video.title, publishedAt: video.publishedAt, nearVersion: v.id, startDate: v.startDate });
      break;
    }
  }
}

const out = {
  updatedAt: raw.updatedAt ?? null,
  videos,
  excluded: raw.excluded ?? [],
  duplicatesDropped: duplicates,
  boundaryFlags,
  missingIds: videos.filter((v) => !v.youtubeId).map((v) => v.title),
};

writeFileSync(join(root, 'data/videos-master.json'), JSON.stringify(out, null, 2) + '\n');
const afterCount = videos.filter((v) => v.phase === 'after').length;
console.log(
  `videos: ${videos.length}（before: ${videos.length - afterCount} / after: ${afterCount}） / excluded: ${out.excluded.length} / 重複除去: ${duplicates.length} / ID未確認: ${out.missingIds.length} / 境界±3日: ${boundaryFlags.length}`
);
const byVer = {};
for (const v of videos) {
  const k = `${v.assignedVersion ?? '(次バージョン待ち)'}${v.phase === 'after' ? '後' : ''}`;
  byVer[k] = (byVer[k] ?? 0) + 1;
}
console.log('バージョン別件数:', JSON.stringify(byVer));
