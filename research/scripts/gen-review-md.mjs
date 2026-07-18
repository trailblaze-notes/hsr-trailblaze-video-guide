#!/usr/bin/env node
// videos-master.json からユーザーレビュー用 Markdown（review/videos-by-version.md）を生成する。依存ゼロ。

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const master = JSON.parse(readFileSync(join(root, 'data/versions-master.json'), 'utf8'));
const data = JSON.parse(readFileSync(join(root, 'data/videos-master.json'), 'utf8'));

const TYPE_LABELS = {
  trailblaze: '紀行PV・ストーリー',
  character: 'キャラクターPV',
  version: 'バージョン予告・特別番組',
  music: 'EP・MV・アニメーション',
};
const TYPE_ORDER = ['trailblaze', 'character', 'version', 'music'];

const versions = [...master.versions].sort((a, b) => {
  const [am, an] = a.id.split('.').map(Number);
  const [bm, bn] = b.id.split('.').map(Number);
  return am - bm || an - bn;
});
const prevOf = new Map(versions.map((v, i) => [v.id, versions[i - 1] ?? null]));

const lines = [];
lines.push('# バージョン別 動画分類一覧（レビュー用）');
lines.push('');
lines.push('## 分類規則（承認事項）');
lines.push('');
lines.push('- **Ver.N ページ = Ver.(N-1) 期間中（前バージョンの開始日から当該バージョン開始日の前日まで）に公開された動画**。「Ver.N が来る前に見ておきたい動画」を意味する');
lines.push('- Ver.1.0 ページ = リリース日（2023-04-26）より前に公開された全対象動画');
lines.push('- 内容が公開時点より先のストーリー核心に触れる動画のみ、後ろのバージョンへ手動移動（`移動` 列に記載）');
lines.push('- 公開日が「≈」付きは二次情報からの概算。境界付近（±3日）は `⚠境界` フラグ付き');
lines.push('');
lines.push(`集計: 動画 ${data.videos.length} 件 / 除外 ${data.excluded.length} 件 / ID未確認 ${data.missingIds.length} 件 / 境界フラグ ${data.boundaryFlags.length} 件`);
lines.push('');

const boundaryTitles = new Set(data.boundaryFlags.map((b) => b.title));

for (const v of versions) {
  const videos = data.videos.filter((x) => x.assignedVersion === v.id);
  const prev = prevOf.get(v.id);
  const window = prev ? `${prev.startDate} 〜 ${v.startDate} 前日` : `〜 ${v.startDate} 前日（リリース前）`;
  lines.push(`## Ver.${v.id}「${v.name}」ページ（対象公開期間: ${window}）`);
  lines.push('');
  if (videos.length === 0) {
    lines.push('（該当動画なし）');
    lines.push('');
    continue;
  }
  for (const phase of ['before', 'after']) {
    const phaseVideos = videos.filter((x) => (x.phase ?? 'before') === phase);
    if (phaseVideos.length === 0) continue;
    lines.push(phase === 'before' ? '◆ このバージョンが来る前に見る' : '◆ このバージョンを終えた後に見る');
    lines.push('');
    for (const type of TYPE_ORDER) {
      const list = phaseVideos.filter((x) => x.type === type);
      if (list.length === 0) continue;
      lines.push(`### ${phase === 'after' ? '【後】' : ''}${TYPE_LABELS[type]}（${list.length} 件）`);
      lines.push('');
      lines.push('| 公開日 | タイトル | 移動 | おすすめ理由（案） | 注意 | リンク |');
      lines.push('|---|---|---|---|---|---|');
      for (const x of list) {
        const date = `${x.approx ? '≈' : ''}${x.publishedAt}${boundaryTitles.has(x.title) ? ' ⚠境界' : ''}`;
        const moved = x.movedFrom ? `${x.movedFrom}→${v.id}` : '-';
        const warn = [x.spoilerNote, x.youtubeId ? null : '**ID未確認**'].filter(Boolean).join(' / ') || '-';
        const link = x.youtubeId ? `[▶](https://youtu.be/${x.youtubeId})` : '-';
        lines.push(`| ${date} | ${x.title} | ${moved} | ${x.reason} | ${warn} | ${link} |`);
      }
      lines.push('');
    }
  }
}

const pending = data.videos.filter((x) => x.assignedVersion === null);
if (pending.length > 0) {
  lines.push('## 次バージョン待ち（現行バージョン期間中に公開・サイト未掲載）');
  lines.push('');
  for (const x of pending) lines.push(`- ${x.publishedAt} ${x.title}`);
  lines.push('');
}

lines.push('## 除外した動画（対象外判定）');
lines.push('');
lines.push('| タイトル | 除外理由 |');
lines.push('|---|---|');
for (const x of data.excluded) lines.push(`| ${x.title} | ${x.reason} |`);
lines.push('');

mkdirSync(join(root, 'review'), { recursive: true });
writeFileSync(join(root, 'review/videos-by-version.md'), lines.join('\n'));
console.log(`review/videos-by-version.md を生成（${data.videos.length} 件）`);
