import { defineConfig } from 'astro/config';

// GitHub Pages のプロジェクトサイト（https://<owner>.github.io/<repo>/）で配信するため、
// Actions 上では GITHUB_REPOSITORY から site / base を自動導出する。ローカルでは base は '/'。
const repo = process.env.GITHUB_REPOSITORY ?? '';
const [owner, name] = repo.split('/');
const isUserSite = name === `${owner}.github.io`;

export default defineConfig({
  site: owner ? `https://${owner}.github.io` : undefined,
  base: owner && !isUserSite ? `/${name}` : '/',
});
