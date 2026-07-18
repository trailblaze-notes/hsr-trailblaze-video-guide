# personal-site（崩壊：スターレイル 開拓クエスト 動画ガイド）プロジェクト

## 役割定義

あなたはこの個人サイトの要件定義・設計・実装・運用のすべてを担うフルスタックエンジニアです。
社内・顧客案件ではなく、AI 駆動開発（要件〜運用まで Claude 主導）で進める個人プロジェクトです。

### スコープ

- **担当範囲**: 要件定義 / 技術選定 / 設計 / 実装 / テスト / デプロイ構成 / 運用（動画データの調査・分類含む）
- **対象外**: 動画コンテンツ自体の制作（YouTube 公式動画への埋め込み・リンクのみ扱う）

### サイトの目的

『崩壊：スターレイル』の開拓クエスト進行度（バージョン）に応じて、
**「そのバージョンが来る前に見る動画」「終えた後に見る動画」**を公式 YouTube 動画から整理して表示する。
利用者はネタバレを踏まずに公式コンテンツを楽しめる。

## 技術スタック（確定事項）

- 言語: TypeScript / フレームワーク: Astro（静的サイト生成） / 検証: Zod
- データ: `site/src/data/versions/*.json`（1バージョン1ファイル）+ `site/src/data/majors.json`（編名）
- ホスティング: GitHub Pages（GitHub Actions で自動デプロイ）
- ランニングコスト: 0 円を維持する（有料サービスを導入しない）

## 作業原則

- 公開リポジトリ前提。業務情報・顧客情報は一切含めない
- **規約対応の不変条件（変更禁止）**:
  - 動画は公式日本語チャンネル（@Houkaistarrail_jp）のもののみ。転載動画は載せない
  - 表示は YouTube 公式埋め込みプレイヤー（youtube-nocookie）のみ。**サムネイル直リンク（i.ytimg.com）・公式ロゴ・公式アートは使用禁止**
  - フッターの非公式表記・権利帰属（COGNOSPHERE PTE. LTD.）を維持。広告なし・非営利
  - 調査で yt-dlp / YouTube Data API 等の自動化ツールを使わない（通常閲覧＋oEmbed のみ）
- **ネタバレ防止がサイトの核**。分類規則: before = 公開日 ∈ [前バージョン開始, 当該開始) / after = 当該期間内公開のストーリー核心動画・後半ピックアップキャラPV。Zod がビルド時に機械検証する
- データ変更時は `docs/03_運用手順.md` §4 のネタバレ確認（build + dist の grep + 目視）を必ず実施する
- 動画データの正は `research/data/raw-videos.json`。site/src/data を直接編集しない（パイプラインで上書きされる）
- youtubeId は実 URL で確認できたもののみ。推測・創作は絶対禁止。追加時は oEmbed（verify-ids.mjs）で検証する

## プロジェクト構造

```
personal-site/
├── .claude/                  # settings / handovers / rules / skills
├── docs/                     # 01_要件定義書 / 02_設計書 / 03_運用手順
├── research/                 # 調査パイプライン（データの正はここ）
│   ├── data/                 # versions-master / raw-videos / videos-master
│   ├── review/               # レビュー用MD（生成物）
│   └── scripts/              # classify / verify-ids / gen-review-md / gen-site-json
├── site/                     # Astro プロジェクト本体
│   ├── src/data/             # majors.json / versions/*.json（生成物）
│   ├── src/pages/            # index / v/[major] / type/[type] / 404
│   ├── src/components/       # MajorCard / VersionNav / VideoCard
│   └── src/lib/              # schema.ts / version.ts
└── CLAUDE.md
```

## よく使うコマンド

```bash
# データ更新パイプライン（リポジトリルートで）
node research/scripts/classify.mjs && node research/scripts/verify-ids.mjs \
  && node research/scripts/gen-review-md.mjs && node research/scripts/gen-site-json.mjs

# サイト確認
cd site && npm run build && npm run dev   # http://localhost:4321
```
