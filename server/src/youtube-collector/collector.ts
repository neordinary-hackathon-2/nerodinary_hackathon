import type {
  DurationLimits,
  SearchDuration,
  SyncVideo,
  VideoDetail,
} from './collector.types.js';
import type { CollectorServer } from './sync.client.js';
import { isEligible, isPlayable } from './video-filter.js';
import {
  isQuotaError,
  YoutubeApiError,
  type SearchQuery,
  type YoutubeClient,
} from './youtube.client.js';

/** 하한이 4분 이상이므로 short(4분 미만) 구간은 검색하지 않는다. 숏폼도 여기서 빠진다. */
const SEARCH_DURATIONS: SearchDuration[] = ['medium', 'long'];

export interface CollectorOptions {
  /** 채널당 유지할 활성 영상 수. 모자란 만큼만 새로 찾는다. */
  targetPerChannel: number;
  /** 한 번 실행에서 쓸 수 있는 search.list 호출 수. 일일 한도(100회)를 지키기 위한 상한. */
  searchCallBudget: number;
  /** 한 채널이 한 번 실행에서 쓸 수 있는 search.list 호출 수(페이지 넘김 포함). */
  searchCallsPerChannel: number;
  limits: DurationLimits;
  /** true 면 YouTube 는 실제로 호출하되 서버에는 아무것도 보내지 않는다. */
  dryRun: boolean;
  /** 지정하면 이 채널만 처리한다. 실측할 때 할당량을 아끼는 용도. */
  onlyChannelId?: number;
}

export interface CollectorDeps {
  youtube: YoutubeClient;
  server: CollectorServer;
  log?: (message: string) => void;
}

export interface ChannelReport {
  channelId: number;
  target: number;
  activeBefore: number;
  deactivated: number;
  added: number;
  activeAfter: number;
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
   * done: 더 찾을 것이 없음, budget: 실행당 상한 도달, quota: YouTube 일일 한도 초과,
   * rejected: YouTube 가 요청을 거부함(잘못된 키 등). 이 경우만 실패로 본다.
   */
  stoppedBy: 'done' | 'budget' | 'quota' | 'rejected';
  /** 재검증 호출이 실패해 상태를 확인하지 못한 영상 수. */
  reverifyFailed: number;
  failed: boolean;
}

interface ChannelPlan {
  report: ChannelReport;
  aliveCount: number;
  refreshed: VideoDetail[];
  deactivateVideoIds: string[];
  added: VideoDetail[];
  queue: SearchQuery[];
}

function toSyncVideo(video: VideoDetail): SyncVideo {
  const {
    embeddable: _embeddable,
    privacyStatus: _privacyStatus,
    ...rest
  } = video;
  return rest;
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * 한 번의 수집 실행.
 *
 * 1. 서버에서 채널별 검색어와 활성 영상을 읽는다.
 * 2. 활성 영상을 재검증해 재생할 수 없게 된 영상을 비활성화 대상으로 고른다.
 * 3. 채널당 목표 개수에 모자란 만큼만 새 영상을 검색한다.
 * 4. 채널별로 결과를 서버에 보낸다. 한 채널이 실패해도 나머지는 계속한다.
 */
export async function runCollector(
  deps: CollectorDeps,
  options: CollectorOptions,
): Promise<CollectorReport> {
  const { youtube, server } = deps;
  const log = deps.log ?? (() => {});

  const allChannels = await server.fetchChannels();
  const channels =
    options.onlyChannelId === undefined
      ? allChannels
      : allChannels.filter((c) => c.channelId === options.onlyChannelId);

  // 한 영상은 한 채널에만 속한다. 다른 채널에 이미 있는 영상도 후보에서 뺀다.
  const knownIds = new Set(
    allChannels.flatMap((c) => [...c.activeVideoIds, ...c.excludedVideoIds]),
  );

  const lookup = await youtube.fetchVideoDetails(
    channels.flatMap((c) => c.activeVideoIds),
  );

  const plans: ChannelPlan[] = channels.map((channel) => {
    const refreshed: VideoDetail[] = [];
    const deactivateVideoIds: string[] = [];
    let aliveCount = 0;

    for (const id of channel.activeVideoIds) {
      if (lookup.failedIds.has(id)) {
        // 확인하지 못한 영상은 살아 있는 것으로 둔다.
        aliveCount += 1;
        continue;
      }
      const detail = lookup.found.get(id);
      if (detail && isPlayable(detail)) {
        aliveCount += 1;
        refreshed.push(detail);
      } else {
        deactivateVideoIds.push(id);
      }
    }

    return {
      report: {
        channelId: channel.channelId,
        target: options.targetPerChannel,
        activeBefore: channel.activeVideoIds.length,
        deactivated: deactivateVideoIds.length,
        added: 0,
        activeAfter: aliveCount,
        searchCalls: 0,
        candidates: 0,
        eligible: 0,
        syncError: null,
      },
      aliveCount,
      refreshed,
      deactivateVideoIds,
      added: [],
      queue: channel.seedKeywords.flatMap((query) =>
        SEARCH_DURATIONS.map((duration) => ({
          query,
          duration,
          pageToken: null,
        })),
      ),
    };
  });

  const shortage = (plan: ChannelPlan) =>
    options.targetPerChannel - plan.aliveCount - plan.added.length;

  let searchCalls = 0;
  let stoppedBy: CollectorReport['stoppedBy'] = 'done';

  // 채널을 돌아가며 한 번에 한 페이지씩 검색한다. 한 채널이 상한을 다 쓰지 않게 하기 위함이다.
  search: while (true) {
    const pending = plans.filter(
      (p) =>
        shortage(p) > 0 &&
        p.queue.length > 0 &&
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
      const query = plan.queue.shift();
      if (!query) {
        continue;
      }

      searchCalls += 1;
      plan.report.searchCalls += 1;
      let page;
      try {
        page = await youtube.searchVideoIds(query);
      } catch (error) {
        if (isQuotaError(error)) {
          stoppedBy = 'quota';
          log(`YouTube 할당량 초과로 검색을 중단합니다: ${describe(error)}`);
          break search;
        }
        if (error instanceof YoutubeApiError && error.status < 500) {
          // 잘못된 키·권한 문제는 다시 불러도 같다. 호출 수만 쓰므로 바로 멈춘다.
          stoppedBy = 'rejected';
          log(`YouTube 가 검색 요청을 거부했습니다: ${describe(error)}`);
          break search;
        }
        // 일시적인 오류는 이 검색어·구간만 버리고 계속한다.
        log(
          `채널 ${plan.report.channelId} 검색 실패 ("${query.query}", ${query.duration}): ${describe(error)}`,
        );
        continue;
      }

      if (page.nextPageToken) {
        // 다음 페이지는 큐 맨 뒤로 보내 다른 검색어의 첫 페이지를 먼저 본다.
        plan.queue.push({ ...query, pageToken: page.nextPageToken });
      }

      const fresh = [...new Set(page.videoIds)].filter(
        (id) => !knownIds.has(id),
      );
      for (const id of fresh) {
        knownIds.add(id);
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
        if (shortage(plan) > 0) {
          plan.added.push(detail);
        }
      }
    }
  }

  for (const plan of plans) {
    plan.report.added = plan.added.length;
    plan.report.activeAfter = plan.aliveCount + plan.added.length;

    const upserts = [...plan.refreshed, ...plan.added].map(toSyncVideo);
    if (
      options.dryRun ||
      (upserts.length === 0 && plan.deactivateVideoIds.length === 0)
    ) {
      continue;
    }
    try {
      await server.sync({
        channelId: plan.report.channelId,
        upserts,
        deactivateVideoIds: plan.deactivateVideoIds,
      });
    } catch (error) {
      plan.report.syncError = describe(error);
      log(`채널 ${plan.report.channelId} 동기화 실패: ${describe(error)}`);
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
