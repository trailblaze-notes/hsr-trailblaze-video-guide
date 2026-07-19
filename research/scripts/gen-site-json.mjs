#!/usr/bin/env node
// 承認済み videos-master.json から site/src/data/versions/*.json を生成する。依存ゼロ。
// - assignedVersion が null（次バージョン待ち）と youtubeId 未確認の動画はスキップ
// - サイト表示に不要な調査用フィールドは落とす

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const master = JSON.parse(readFileSync(join(root, 'data/versions-master.json'), 'utf8'));
const data = JSON.parse(readFileSync(join(root, 'data/videos-master.json'), 'utf8'));
const outdir = join(root, '../site/src/data/versions');

let total = 0;
let skipped = 0;
for (const v of master.versions) {
  const videos = data.videos
    .filter((x) => x.assignedVersion === v.id)
    .filter((x) => {
      if (!x.youtubeId || x.verified === false) {
        skipped++;
        return false;
      }
      return true;
    })
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))
    .map((x) => {
      const video = {
        youtubeId: x.youtubeId,
        title: x.title,
        type: x.type,
        publishedAt: x.publishedAt,
        reason: x.reason,
      };
      if (x.phase === 'after') video.phase = 'after';
      if (x.excludeFromTypePages) video.excludeFromTypePages = true;
      if (x.embeddable === false) video.embeddable = false;
      if (x.movedFrom) {
        video.movedFrom = x.movedFrom;
        video.note = x.note ?? '';
      }
      return video;
    });
  total += videos.length;
  const out = { id: v.id, name: v.name, startDate: v.startDate, videos };
  writeFileSync(join(outdir, `${v.id}.json`), JSON.stringify(out, null, 2) + '\n');
}
console.log(`site JSON 生成完了: ${master.versions.length} バージョン / 動画 ${total} 件 / スキップ(ID未確認等) ${skipped} 件`);
