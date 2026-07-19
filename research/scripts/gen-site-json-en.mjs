#!/usr/bin/env node
// 英語版サイトデータ生成: videos-master.json（日本語canonical）に
// raw/en-map-era*.json（JP→EN動画対応）と versions-master-en.json（EN版名）を突き合わせ、
// site/src/data/versions-en/*.json と majors-en.json を生成する。依存ゼロ。

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const master = JSON.parse(readFileSync(join(root, 'data/versions-master.json'), 'utf8'));
const data = JSON.parse(readFileSync(join(root, 'data/videos-master.json'), 'utf8'));

// EN 対応マップ（era ファイルをすべてマージ）
const enMap = new Map();
const rawDir = join(root, 'data/raw');
for (const f of readdirSync(rawDir).filter((f) => f.startsWith('en-map-') && f.endsWith('.json'))) {
  const m = JSON.parse(readFileSync(join(rawDir, f), 'utf8'));
  for (const entry of m.mappings ?? []) {
    if (entry.jpId && entry.enId) enMap.set(entry.jpId, entry);
  }
}

// EN 版バージョン名
const enNamesPath = join(root, 'data/versions-master-en.json');
const enNames = new Map();
let enMajors = null;
if (existsSync(enNamesPath)) {
  const en = JSON.parse(readFileSync(enNamesPath, 'utf8'));
  for (const v of en.versions ?? []) enNames.set(v.id, v.nameEn ?? null);
  enMajors = en.majors ?? null;
}

const outdir = join(root, '../site/src/data/versions-en');
let mapped = 0;
let unmapped = [];
for (const v of master.versions) {
  const videos = data.videos
    .filter((x) => x.assignedVersion === v.id && x.youtubeId)
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))
    .flatMap((x) => {
      const en = enMap.get(x.youtubeId);
      if (!en) {
        unmapped.push(`${v.id}: ${x.title}`);
        return [];
      }
      mapped++;
      const video = {
        youtubeId: en.enId,
        title: en.enTitle,
        type: x.type,
        publishedAt: x.publishedAt,
      };
      if (x.phase === 'after') video.phase = 'after';
      if (x.excludeFromTypePages) video.excludeFromTypePages = true;
      if (x.embeddable === false) video.embeddable = false;
      if (x.movedFrom) {
        video.movedFrom = x.movedFrom;
        video.note = x.note ?? '';
      }
      return [video];
    });
  const name = enNames.get(v.id) || v.name;
  writeFileSync(
    join(outdir, `${v.id}.json`),
    JSON.stringify({ id: v.id, name, startDate: v.startDate, videos }, null, 2) + '\n'
  );
}

if (enMajors) {
  // versions-master-en.json の majors は {nameEn, note} 形式の場合があるため文字列に正規化する
  const normalized = Object.fromEntries(
    Object.entries(enMajors).map(([k, v]) => [k, typeof v === 'string' ? v : v.nameEn])
  );
  writeFileSync(join(root, '../site/src/data/majors-en.json'), JSON.stringify(normalized, null, 2) + '\n');
}

console.log(`EN site JSON 生成: 対応済み ${mapped} 件 / 未対応 ${unmapped.length} 件`);
if (unmapped.length) console.log('未対応（EN版から除外）:\n- ' + unmapped.join('\n- '));
