import { parseArgs } from 'node:util';
import { z } from 'zod';
import { runCollector, type CollectorReport } from './collector.js';
import { createFileChannelSource, createSyncClient } from './sync.client.js';
import {
  DEFAULT_MAX_DURATION_SECONDS,
  DEFAULT_MIN_DURATION_SECONDS,
  DEFAULT_TARGET_PER_CHANNEL,
} from '../youtube/youtube.constants.js';
import { createYoutubeClient } from './youtube.client.js';

/**
 * YouTube 영상 수집기 진입점. 서버(Nest)와 별개로 GitHub Actions 나 로컬에서 실행한다.
 *
 *   pnpm build && pnpm collect:youtube -- --dry-run --channels-file=channels.json --channel=1
 *
 * --dry-run             YouTube 는 호출하되 서버에는 보내지 않는다.
 * --channels-file=경로  서버 대신 JSON 파일에서 채널 설정을 읽는다. --dry-run 과 함께만 쓴다.
 * --channel=번호        해당 번호(1~9)의 채널만 처리한다.
 */
const envSchema = z.object({
  YOUTUBE_API_KEY: z.string().min(1),
  SYNC_API_BASE_URL: z.string().url().optional(),
  SEED_TOKEN: z.string().min(1).optional(),
  TARGET_PER_CHANNEL: z.coerce
    .number()
    .int()
    .min(1)
    .default(DEFAULT_TARGET_PER_CHANNEL),
  ROTATE_PER_CHANNEL: z.coerce.number().int().min(0).default(10),
  FRESH_WINDOW_DAYS: z.coerce.number().int().min(1).default(7),
  SEARCH_CALL_BUDGET: z.coerce.number().int().min(0).max(100).default(60),
  SEARCH_CALLS_PER_CHANNEL: z.coerce.number().int().min(0).max(100).default(6),
  MIN_DURATION_SECONDS: z.coerce
    .number()
    .int()
    .min(240)
    .default(DEFAULT_MIN_DURATION_SECONDS),
  MAX_DURATION_SECONDS: z.coerce
    .number()
    .int()
    .min(240)
    .default(DEFAULT_MAX_DURATION_SECONDS),
  YOUTUBE_REGION_CODE: z.string().length(2).default('KR'),
  YOUTUBE_RELEVANCE_LANGUAGE: z.string().min(2).default('ko'),
});

function printReport(report: CollectorReport, dryRun: boolean): void {
  console.log(dryRun ? '\n[dry-run] 서버에는 보내지 않았습니다.' : '');
  console.table(
    report.channels.map((c) => ({
      채널: c.channelNumber,
      '실행 전': c.storedKnown ? c.storedBefore : '모름',
      삭제: c.removed,
      추가: c.added,
      교체: c.evicted,
      '실행 후': c.storedKnown ? `${c.storedAfter}/${c.target}` : `+${c.added}`,
      '서버 제외': c.rejected,
      검색: c.searchCalls,
      '새 후보': c.candidates,
      통과: c.eligible,
      '검색당 통과':
        c.searchCalls > 0 ? (c.eligible / c.searchCalls).toFixed(1) : '-',
      오류: c.syncError ?? '',
    })),
  );
  console.log(
    `search.list 호출 ${report.searchCalls}회, 종료 사유: ${report.stoppedBy}, 재검증 실패 ${report.reverifyFailed}건`,
  );
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      'dry-run': { type: 'boolean', default: false },
      'channels-file': { type: 'string' },
      channel: { type: 'string' },
    },
  });

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`환경변수 설정이 올바르지 않습니다.\n${details}`);
  }
  const env = parsed.data;
  if (env.MIN_DURATION_SECONDS > env.MAX_DURATION_SECONDS) {
    throw new Error(
      'MIN_DURATION_SECONDS 가 MAX_DURATION_SECONDS 보다 큽니다.',
    );
  }

  // 영상 하나가 밀려나기까지 걸리는 날수(목표 ÷ 하루 교체 수)보다 검색 기간이 짧아야
  // 지운 영상이 다음 검색에 다시 잡히지 않는다.
  if (
    env.ROTATE_PER_CHANNEL > 0 &&
    env.FRESH_WINDOW_DAYS * env.ROTATE_PER_CHANNEL >= env.TARGET_PER_CHANNEL
  ) {
    throw new Error(
      'FRESH_WINDOW_DAYS × ROTATE_PER_CHANNEL 은 TARGET_PER_CHANNEL 보다 작아야 합니다. 그렇지 않으면 지운 영상이 다시 들어옵니다.',
    );
  }

  const dryRun = values['dry-run'];
  const channelsFile = values['channels-file'];
  const onlyChannelNumber =
    values.channel === undefined
      ? undefined
      : z.coerce.number().int().min(0).max(9).parse(values.channel);

  let server;
  if (channelsFile) {
    if (!dryRun) {
      throw new Error('--channels-file 은 --dry-run 과 함께만 쓸 수 있습니다.');
    }
    server = createFileChannelSource(channelsFile);
  } else {
    if (!env.SYNC_API_BASE_URL || !env.SEED_TOKEN) {
      throw new Error(
        'SYNC_API_BASE_URL 과 SEED_TOKEN 이 필요합니다. 서버 없이 실측하려면 --dry-run --channels-file 을 쓰세요.',
      );
    }
    server = createSyncClient({
      baseUrl: env.SYNC_API_BASE_URL,
      token: env.SEED_TOKEN,
    });
  }

  const report = await runCollector(
    {
      youtube: createYoutubeClient({
        apiKey: env.YOUTUBE_API_KEY,
        regionCode: env.YOUTUBE_REGION_CODE,
        relevanceLanguage: env.YOUTUBE_RELEVANCE_LANGUAGE,
      }),
      server,
      log: (message) => console.warn(message),
    },
    {
      targetPerChannel: env.TARGET_PER_CHANNEL,
      rotatePerChannel: env.ROTATE_PER_CHANNEL,
      freshWindowDays: env.FRESH_WINDOW_DAYS,
      searchCallBudget: env.SEARCH_CALL_BUDGET,
      searchCallsPerChannel: env.SEARCH_CALLS_PER_CHANNEL,
      limits: {
        minSeconds: env.MIN_DURATION_SECONDS,
        maxSeconds: env.MAX_DURATION_SECONDS,
      },
      dryRun,
      onlyChannelNumber,
    },
  );

  printReport(report, dryRun);
  if (report.failed) {
    process.exitCode = 1;
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
