import type {
  DurationLimits,
  SearchDuration,
  SyncVideo,
  VideoDetail,
} from './collector.types.js';
import { describeError } from './retry.js';
import type { CollectorServer } from './sync.client.js';
import { isEligible, isStorable } from './video-filter.js';
import {
  isQuotaError,
  YoutubeApiError,
  type SearchQuery,
  type YoutubeClient,
} from './youtube.client.js';

/** 하한이 4분 이상이므로 short(4분 미만) 구간은 검색하지 않는다. 숏폼도 여기서 빠진다. */
const SEARCH_DURATIONS: SearchDuration[] = ['medium', 'long'];

/** sync 요청 한 번에 싣는 영상 수. 서버의 요청 본문 크기 제한(100KB)을 넘지 않게 한다. */
export const SYNC_CHUNK_SIZE = 50;

export interface CollectorOptions {
  /** 채널당 유지할 활성 영상 수. */
  targetPerChannel: number;
  /**
   * 한 번 실행에서 채널마다 새로 들일 최근 영상 수. 0 이면 모자란 만큼만 채운다.
   * 들어온 만큼 서버가 오래된 영상을 지워 목표 개수를 유지한다.
   */
  rotatePerChannel: number;
  /** 교체용 검색이 보는 기간(일). 이 기간 안에 공개된 영상만 새로 들인다. */
  freshWindowDays: number;
  /** 기간 계산의 기준 시각. 테스트에서 고정하려고 둔다. 기본은 현재 시각. */
  now?: Date;
  /** 한 번 실행에서 쓸 수 있는 search.list 호출 수. 일일 한도(100회)를 지키기 위한 상한. */
  searchCallBudget: number;
  /** 한 채널이 한 번 실행에서 쓸 수 있는 search.list 호출 수(페이지 넘김 포함). */
  searchCallsPerChannel: number;
  /**
   * 실행 시작부터 이 시간(ms)이 지나면 새 검색과 검색 재시도를 멈춘다.
   * YouTube 가 응답하지 않는 날에도 워크플로 제한(15분) 안에 동기화까지 끝내기 위한 상한.
   * 없으면 시간으로 멈추지 않는다.
   */
  searchTimeLimitMs?: number;
  limits: DurationLimits;
  /** true 면 YouTube 는 실제로 호출하되 서버에는 아무것도 보내지 않는다. */
  dryRun: boolean;
  /** 지정하면 이 번호의 채널만 처리한다. 실측할 때 할당량을 아끼는 용도. */
  onlyChannelNumber?: number;
}

export interface CollectorDeps {
  youtube: YoutubeClient;
  server: CollectorServer;
  log?: (message: string) => void;
  /** 현재 시각(ms). 테스트에서 시간을 흘려보내려고 둔다. 기본은 Date.now. */
  clock?: () => number;
}

export interface ChannelReport {
  channelNumber: number;
  target: number;
  /**
   * 서버가 저장된 영상 목록(storedVideoIds)을 내려줬는지.
   * false 면 현재 개수를 몰라 재검증 없이 매번 목표 개수만큼 새로 찾는다.
   */
  storedKnown: boolean;
  storedBefore: number;
  removed: number;
  added: number;
  /** 목표 개수를 넘어 서버가 지운(dry-run 이면 지울) 오래된 영상 수. */
  evicted: number;
  storedAfter: number;
  /** 서버가 검증에서 제외한 영상 수. 동기화하지 않았으면 0. */
  rejected: number;
  searchCalls: number;
  /** 검색으로 받은 ID 중 처음 보는 것의 수. */
  candidates: number;
  /** 그중 길이·임베드·공개 조건을 통과한 수. */
  eligible: number;
  syncError: string | null;
}

export interface CollectorReport {
  channels: ChannelReport[];
  searchCalls: number;
  /**
   * done: 더 찾을 것이 없음, budget: 실행당 상한 도달, time: 검색 시간 상한 도달,
   * quota: YouTube 일일 한도 초과(429 포함),
   * rejected: YouTube 가 요청을 거부함(잘못된 키 등). 이 경우만 실패로 본다.
   */
  stoppedBy: 'done' | 'budget' | 'time' | 'quota' | 'rejected';
  /** 재검증 호출이 실패해 상태를 확인하지 못한 영상 수. */
  reverifyFailed: number;
  failed: boolean;
}

interface ChannelPlan {
  report: ChannelReport;
  aliveCount: number;
  refreshed: VideoDetail[];
  removedVideoIds: string[];
  /** 이 채널에서 이미 알고 있는 영상. 같은 영상이 다른 채널에 있는 것은 막지 않는다. */
  knownIds: Set<string>;
  added: VideoDetail[];
  /** 이번 실행에서 새로 들일 최근 영상 수. 교체하지 않는 채널은 0. */
  rotate: number;
  /** 교체용 검색. 기간 조건이 붙어 있고, 모자란 만큼 채우는 검색보다 먼저 쓴다. */
  freshQueue: SearchQuery[];
  /** 모자란 만큼 채우는 검색. 공개 시각을 가리지 않는다. */
  queue: SearchQuery[];
}

function toSyncVideo(video: VideoDetail & { thumbnailUrl: string }): SyncVideo {
  return {
    youtubeVideoId: video.youtubeVideoId,
    title: video.title,
    thumbnailUrl: video.thumbnailUrl,
    durationSeconds: video.durationSeconds,
    publishedAt: video.publishedAt,
    sourceYoutubeChannelId: video.sourceYoutubeChannelId,
    sourceChannelTitle: video.sourceChannelTitle,
    // 수집기는 공개·임베드 가능한 영상만 보낸다. 서버가 같은 조건을 다시 확인한다.
    privacyStatus: 'public',
    isEmbeddable: video.embeddable,
  };
}

/** 썸네일이 있는 영상만 남긴다. isStorable 을 통과한 영상은 모두 해당한다. */
function hasThumbnail(
  video: VideoDetail,
): video is VideoDetail & { thumbnailUrl: string } {
  return video.thumbnailUrl !== null;
}

/**
 * 한 번의 수집 실행.
 *
 * 1. 서버에서 채널별 검색어와 저장된 영상을 읽는다.
 * 2. 저장된 영상을 재검증해 재생할 수 없게 된 영상을 삭제 대상으로 고른다.
 * 3. 채널마다 최근 공개된 영상을 정해진 수만큼 새로 찾는다(교체). 그래도 목표 개수에
 *    모자라면 모자란 만큼 공개 시각을 가리지 않고 더 찾는다.
 * 4. 채널별로 결과를 서버에 보낸다. 한 채널이 실패해도 나머지는 계속한다.
 *    목표 개수를 넘는 만큼은 서버가 저장된 지 오래된 영상부터 지운다.
 */
export async function runCollector(
  deps: CollectorDeps,
  options: CollectorOptions,
): Promise<CollectorReport> {
  const { youtube, server } = deps;
  const log = deps.log ?? (() => {});
  const clock = deps.clock ?? Date.now;
  const startedAt = clock();
  const outOfTime = () =>
    options.searchTimeLimitMs !== undefined &&
    clock() - startedAt >= options.searchTimeLimitMs;

  const allChannels = await server.fetchChannels();
  const channels =
    options.onlyChannelNumber === undefined
      ? allChannels
      : allChannels.filter(
          (c) => c.channelNumber === options.onlyChannelNumber,
        );

  const publishedAfter = new Date(
    (options.now ?? new Date()).getTime() -
      options.freshWindowDays * 86_400_000,
  ).toISOString();

  const lookup = await youtube.fetchVideoDetails(
    channels.flatMap((c) => c.storedVideoIds ?? []),
  );

  const plans: ChannelPlan[] = channels.map((channel) => {
    const stored = channel.storedVideoIds ?? [];
    const refreshed: VideoDetail[] = [];
    const removedVideoIds: string[] = [];
    let aliveCount = 0;

    for (const id of stored) {
      if (lookup.failedIds.has(id)) {
        // 확인하지 못한 영상은 살아 있는 것으로 둔다.
        aliveCount += 1;
        continue;
      }
      const detail = lookup.found.get(id);
      if (detail && isStorable(detail)) {
        aliveCount += 1;
        refreshed.push(detail);
      } else {
        removedVideoIds.push(id);
      }
    }

    if (channel.storedVideoIds === undefined && channel.seedKeywords.length) {
      log(
        `채널 ${channel.channelNumber}: 서버가 저장된 영상 목록을 주지 않아 재검증을 건너뛰고 목표 개수만큼 새로 찾습니다.`,
      );
    }

    // 처음 채울 때처럼 많이 모자란 채널은 교체하지 않고 채우기만 한다.
    // 저장된 영상을 모르면 무엇이 새 영상인지 알 수 없으므로 교체하지 않는다.
    const rotate =
      channel.storedVideoIds !== undefined &&
      options.targetPerChannel - aliveCount <= options.rotatePerChannel
        ? options.rotatePerChannel
        : 0;
    const queries = (extra: Partial<SearchQuery>): SearchQuery[] =>
      channel.seedKeywords.flatMap((query) =>
        SEARCH_DURATIONS.map((duration) => ({
          query,
          duration,
          pageToken: null,
          ...extra,
        })),
      );

    return {
      report: {
        channelNumber: channel.channelNumber,
        target: options.targetPerChannel,
        storedKnown: channel.storedVideoIds !== undefined,
        storedBefore: stored.length,
        removed: removedVideoIds.length,
        added: 0,
        evicted: 0,
        storedAfter: aliveCount,
        rejected: 0,
        searchCalls: 0,
        candidates: 0,
        eligible: 0,
        syncError: null,
      },
      aliveCount,
      refreshed,
      removedVideoIds,
      knownIds: new Set(stored),
      added: [],
      rotate,
      freshQueue: rotate > 0 ? queries({ publishedAfter }) : [],
      queue: queries({}),
    };
  });

  const shortage = (plan: ChannelPlan) =>
    options.targetPerChannel - plan.aliveCount - plan.added.length;
  /** 교체용으로 더 들일 수 있는 최근 영상 수. */
  const freshRoom = (plan: ChannelPlan) => plan.rotate - plan.added.length;
  /** 다음에 쓸 검색 큐. 교체용 검색을 먼저 쓰고, 그래도 모자라면 채우는 검색을 쓴다. */
  const nextQueue = (plan: ChannelPlan): 'fresh' | 'fill' | null => {
    if (plan.freshQueue.length > 0 && freshRoom(plan) > 0) {
      return 'fresh';
    }
    if (plan.queue.length > 0 && shortage(plan) > 0) {
      return 'fill';
    }
    return null;
  };

  let searchCalls = 0;
  let stoppedBy: CollectorReport['stoppedBy'] = 'done';

  // 채널을 돌아가며 한 번에 한 페이지씩 검색한다. 한 채널이 상한을 다 쓰지 않게 하기 위함이다.
  search: while (true) {
    const pending = plans.filter(
      (p) =>
        nextQueue(p) !== null &&
        p.report.searchCalls < options.searchCallsPerChannel,
    );
    if (pending.length === 0) {
      break;
    }
    for (const plan of pending) {
      if (searchCalls >= options.searchCallBudget) {
        stoppedBy = 'budget';
        break search;
      }
      if (outOfTime()) {
        stoppedBy = 'time';
        log('검색 시간 상한에 닿아 검색을 멈추고 동기화로 넘어갑니다.');
        break search;
      }
      const kind = nextQueue(plan);
      if (kind === null) {
        continue;
      }
      const queue = kind === 'fresh' ? plan.freshQueue : plan.queue;
      const room = kind === 'fresh' ? freshRoom : shortage;
      const query = queue.shift();
      if (!query) {
        continue;
      }

      searchCalls += 1;
      plan.report.searchCalls += 1;
      let page;
      try {
        page = await youtube.searchVideoIds(query, {
          // 실패한 호출도 할당량을 썼을 수 있으므로 재시도도 한 번의 검색으로 센다.
          // 전체·채널별 상한이나 시간 상한에 닿으면 재시도하지 않는다.
          beforeRetry: (info) => {
            if (
              searchCalls >= options.searchCallBudget ||
              plan.report.searchCalls >= options.searchCallsPerChannel ||
              outOfTime()
            ) {
              return false;
            }
            searchCalls += 1;
            plan.report.searchCalls += 1;
            log(
              `채널 ${plan.report.channelNumber} 검색 재시도 ${info.attempt + 1}/${info.attempts} ("${query.query}", ${query.duration}): ${describeError(info.error)}`,
            );
            return true;
          },
        });
      } catch (error) {
        if (isQuotaError(error)) {
          stoppedBy = 'quota';
          log(
            `YouTube 할당량 초과로 검색을 중단합니다: ${describeError(error)}`,
          );
          break search;
        }
        if (error instanceof YoutubeApiError && error.status < 500) {
          // 잘못된 키·권한 문제는 다시 불러도 같다. 호출 수만 쓰므로 바로 멈춘다.
          stoppedBy = 'rejected';
          log(`YouTube 가 검색 요청을 거부했습니다: ${describeError(error)}`);
          break search;
        }
        // 일시적인 오류는 이 검색어·구간만 버리고 계속한다.
        log(
          `채널 ${plan.report.channelNumber} 검색 실패 ("${query.query}", ${query.duration}): ${describeError(error)}`,
        );
        continue;
      }

      if (page.nextPageToken) {
        // 다음 페이지는 큐 맨 뒤로 보내 다른 검색어의 첫 페이지를 먼저 본다.
        queue.push({ ...query, pageToken: page.nextPageToken });
      }

      const fresh = [...new Set(page.videoIds)].filter(
        (id) => !plan.knownIds.has(id),
      );
      for (const id of fresh) {
        plan.knownIds.add(id);
      }
      plan.report.candidates += fresh.length;
      if (fresh.length === 0) {
        continue;
      }

      const details = await youtube.fetchVideoDetails(fresh);
      for (const id of fresh) {
        const detail = details.found.get(id);
        if (!detail || !isEligible(detail, options.limits)) {
          continue;
        }
        plan.report.eligible += 1;
        if (room(plan) > 0) {
          plan.added.push(detail);
        }
      }
    }
  }

  for (const plan of plans) {
    plan.report.added = plan.added.length;
    // 목표 개수를 넘는 만큼은 서버가 오래된 영상부터 지운다.
    const total = plan.aliveCount + plan.added.length;
    plan.report.evicted = Math.max(0, total - options.targetPerChannel);
    plan.report.storedAfter = total - plan.report.evicted;

    const videos = [...plan.refreshed, ...plan.added]
      .filter(hasThumbnail)
      .map(toSyncVideo);
    if (
      options.dryRun ||
      (videos.length === 0 && plan.removedVideoIds.length === 0)
    ) {
      continue;
    }
    try {
      // 요청 본문이 커지지 않게 나눠 보낸다. 삭제 목록은 첫 요청에만 싣는다.
      const chunks: SyncVideo[][] = [];
      for (let start = 0; start < videos.length; start += SYNC_CHUNK_SIZE) {
        chunks.push(videos.slice(start, start + SYNC_CHUNK_SIZE));
      }
      if (chunks.length === 0) {
        chunks.push([]);
      }
      let evicted = 0;
      for (const [index, chunk] of chunks.entries()) {
        const result = await server.sync({
          channelNumber: plan.report.channelNumber,
          videos: chunk,
          // 지울 영상이 없으면 필드를 생략한다.
          ...(index === 0 && plan.removedVideoIds.length > 0
            ? { removedVideoIds: plan.removedVideoIds }
            : {}),
        });
        evicted += result.evictedCount;
        plan.report.rejected += result.rejectedCount;
        for (const item of result.rejected) {
          log(
            `채널 ${plan.report.channelNumber}: 서버가 ${item.youtubeVideoId} 를 제외했습니다 (${item.reason})`,
          );
        }
      }
      // 예상값 대신 서버가 실제로 지운 수를 남긴다.
      plan.report.evicted = evicted;
    } catch (error) {
      plan.report.syncError = describeError(error);
      log(
        `채널 ${plan.report.channelNumber} 동기화 실패: ${describeError(error)}`,
      );
    }
  }

  return {
    channels: plans.map((p) => p.report),
    searchCalls,
    stoppedBy,
    reverifyFailed: lookup.failedIds.size,
    failed:
      stoppedBy === 'rejected' ||
      plans.some((p) => p.report.syncError !== null),
  };
}
