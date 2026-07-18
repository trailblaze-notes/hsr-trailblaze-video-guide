# personal-site — ネタバレ回避 公式動画ガイド

ゲームの進行度に合わせて、**ネタバレを踏まずに見られる公式 YouTube 動画だけ**を一覧表示する個人サイト。
要件定義から設計・実装・運用まで AI 駆動開発（Claude Code）で構築。

## 何ができるか

- ゲームごとに「いまの進行度」を選ぶと、そこまでで安全な公式動画だけが表示される
- まだ先の内容を含む動画はタイトル・サムネイルごと隠れ、「未解禁 n 件」とだけ出る
- 選んだ進行度はブラウザに保存され、次回訪問時も引き継がれる

## 構成

| パス | 内容 |
|---|---|
| `docs/01_要件定義書.md` | 何を作るか・機能/非機能要件 |
| `docs/02_設計書.md` | 技術選定の理由・データモデル・画面/インフラ設計 |
| `docs/03_運用手順.md` | 公開手順・データ追加手順・保守 |
| `site/` | Astro + TypeScript 実装本体 |
| `site/src/data/games/` | ゲーム・動画データ（運用で触るのはここだけ） |
| `.github/workflows/deploy.yml` | GitHub Pages 自動デプロイ |

## クイックスタート

```bash
cd site
npm install
npm run dev      # http://localhost:4321 で確認
npm run build    # データ検証込みのビルド
```

技術スタック: Astro / TypeScript / Zod / GitHub Pages（ランニングコスト 0 円）
