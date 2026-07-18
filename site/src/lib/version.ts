// "major.minor" 形式のバージョン ID を数値で比較する（"1.10" > "1.9" を正しく扱う）
// サーバー（schema.ts）とクライアント <script> の両方から使うため、依存ゼロで分離している
export function compareVersion(a: string, b: string): number {
  const [aMajor, aMinor] = a.split('.').map(Number);
  const [bMajor, bMinor] = b.split('.').map(Number);
  return aMajor - bMajor || aMinor - bMinor;
}
