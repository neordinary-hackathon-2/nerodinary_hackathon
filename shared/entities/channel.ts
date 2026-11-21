import {z} from 'zod';

/** DB와 서버에서 공유하는 서비스 채널 엔티티. 공개 응답에는 DTO로 필요한 필드만 보낸다. */
export const channelSchema = z
  .object({
    id: z.number().int().positive().meta({example: 1}),
    code: z.string().min(1).max(10).meta({example: 'CH05'}),
    name: z.string().min(1).max(50).meta({example: '예능'}),
    slogan: z.string().max(150).nullable().meta({example: '웃다 체하지 마세요'}),
    role: z.string().max(200).nullable().meta({example: '가벼운 웃음, 기본 채널'}),
    displayOrder: z.number().int().positive().meta({example: 1}),
    createdAt: z.string().meta({example: '2026-11-21T08:00:00.000Z'}),
    updatedAt: z.string().meta({example: '2026-11-21T08:00:00.000Z'}),
  })
  .meta({id: 'Channel'});

export type Channel = z.infer<typeof channelSchema>;
