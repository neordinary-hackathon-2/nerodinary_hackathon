/**
 * 도메인 엔티티. zod 스키마와 그 타입을 함께 내보낸다.
 * 파일을 만들면 여기에 한 줄 추가한다.
 *
 *   // entities/content.ts
 *   export const contentSchema = z
 *     .object({
 *       id: z.number().int().meta({example: 1}),
 *       title: z.string().min(1).max(100).meta({example: '권태'}),
 *       createdAt: z.string().meta({example: '2026-11-21T08:00:00.000Z'}),
 *     })
 *     .meta({id: 'Content'});
 *   export type Content = z.infer<typeof contentSchema>;
 *
 *   // 여기에 추가
 *   export * from './content.js';
 */
export {};
