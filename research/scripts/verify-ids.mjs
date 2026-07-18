#!/usr/bin/env node
// videos-master.json の全 youtubeId を YouTube oEmbed で実在確認し、
// 公式チャンネル（崩壊：スターレイル）以外・存在しない動画を検出する。依存ゼロ・Node 18+。
// レート配慮のため 300ms 間隔の逐次アクセス。

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = join(root, 'data/videos-master.json');
const data = JSON.parse(readFileSync(path, 'utf8'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = { ok: 0, ng: [], wrongChannel: [] };

for (const video of data.videos) {
  if (!video.youtubeId) continue;
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${video.youtubeId}`)}&format=json`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      results.ng.push({ id: video.youtubeId, title: video.title, http: res.status });
      video.verified = false;
    } else {
      const meta = await res.json();
      video.verified = true;
      video.canonicalTitle = meta.title;
      video.channel = meta.author_name;
      if (!/スターレイル|Star Rail/i.test(meta.author_name ?? '')) {
        results.wrongChannel.push({ id: video.youtubeId, title: video.title, channel: meta.author_name });
      } else {
        results.ok++;
      }
    }
  } catch (e) {
    results.ng.push({ id: video.youtubeId, title: video.title, error: String(e) });
    video.verified = false;
  }
  await sleep(300);
}

writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
console.log(`検証OK(公式ch): ${results.ok}`);
console.log(`存在しない/取得失敗: ${results.ng.length}`, results.ng.length ? JSON.stringify(results.ng, null, 1) : '');
console.log(`公式ch以外: ${results.wrongChannel.length}`, results.wrongChannel.length ? JSON.stringify(results.wrongChannel, null, 1) : '');
