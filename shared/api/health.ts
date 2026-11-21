import {z} from 'zod';

export const healthResponseSchema = z
  .object({
    status: z.literal('UP').meta({description: '서버 상태'}),
    database: z.enum(['UP', 'DOWN']).meta({description: 'DB 연결 상태'}),
    timestamp: z.string().meta({
      description: '응답 시각 (ISO 8601)',
      example: '2026-11-21T08:00:00.000Z',
    }),
  })
  .meta({id: 'HealthResponseDto'});

export type HealthResponseDto = z.infer<typeof healthResponseSchema>;
