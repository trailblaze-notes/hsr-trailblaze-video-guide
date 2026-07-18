import { z } from 'zod';

export const checkpointSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  label: z.string().min(1),
});

export const videoSchema = z.object({
  // YouTube 動画 ID は 11 文字の [A-Za-z0-9_-]
  youtubeId: z.string().regex(/^[\w-]{11}$/),
  title: z.string().min(1),
  type: z.enum(['PV', 'キャラ紹介', 'インタビュー', 'その他']),
  safeAfter: z.string(),
  reason: z.string().min(1),
});

export const gameSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string().min(1),
    officialChannel: z.string().url(),
    checkpoints: z.array(checkpointSchema).min(1),
    videos: z.array(videoSchema),
  })
  .superRefine((game, ctx) => {
    const checkpointIds = new Set(game.checkpoints.map((c) => c.id));
    game.videos.forEach((video, i) => {
      if (!checkpointIds.has(video.safeAfter)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['videos', i, 'safeAfter'],
          message: `safeAfter "${video.safeAfter}" が checkpoints に存在しません`,
        });
      }
    });
  });

export type Checkpoint = z.infer<typeof checkpointSchema>;
export type Video = z.infer<typeof videoSchema>;
export type Game = z.infer<typeof gameSchema>;

const modules = import.meta.glob('../data/games/*.json', { eager: true });

export function loadGames(): Game[] {
  return Object.entries(modules)
    .map(([path, mod]) => {
      const parsed = gameSchema.safeParse((mod as { default: unknown }).default);
      if (!parsed.success) {
        throw new Error(`ゲームデータが不正です: ${path}\n${parsed.error.message}`);
      }
      return parsed.data;
    })
    .sort((a, b) => a.title.localeCompare(b.title, 'ja'));
}
