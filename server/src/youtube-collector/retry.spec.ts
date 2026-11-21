import {
  isNetworkError,
  readJson,
  MAX_RETRY_AFTER_MS,
  parseRetryAfter,
  withRetry,
} from './retry.js';

class FakeError extends Error {
  constructor(
    readonly retryable: boolean,
    readonly retryAfterMs?: number,
  ) {
    super(retryable ? '일시 오류' : '영구 오류');
  }
}

const isRetryable = (error: unknown) =>
  error instanceof FakeError && error.retryable;

/** 정해진 순서대로 실패하다가 마지막에 성공하는 함수. */
function sequence(failures: FakeError[]) {
  let calls = 0;
  const fn = () => {
    const failure = failures[calls];
    calls += 1;
    return failure ? Promise.reject(failure) : Promise.resolve('ok');
  };
  return { fn, calls: () => calls };
}

function fakeSleep() {
  const waits: number[] = [];
  return {
    waits,
    sleep: (ms: number) => {
      waits.push(ms);
      return Promise.resolve();
    },
  };
}

describe('withRetry', () => {
  it('일시 오류 뒤 성공하면 결과를 돌려준다', async () => {
    const { fn, calls } = sequence([new FakeError(true)]);
    const { sleep } = fakeSleep();

    await expect(withRetry(fn, { isRetryable, sleep })).resolves.toBe('ok');
    expect(calls()).toBe(2);
  });

  it('영구 오류는 한 번만 시도하고 그대로 던진다', async () => {
    const permanent = new FakeError(false);
    const { fn, calls } = sequence([permanent]);
    const { sleep, waits } = fakeSleep();

    await expect(withRetry(fn, { isRetryable, sleep })).rejects.toBe(permanent);
    expect(calls()).toBe(1);
    expect(waits).toEqual([]);
  });

  it('계속 실패하면 3번 시도한 뒤 마지막 오류를 던진다', async () => {
    const last = new FakeError(true);
    const { fn, calls } = sequence([
      new FakeError(true),
      new FakeError(true),
      last,
    ]);
    const { sleep } = fakeSleep();

    await expect(withRetry(fn, { isRetryable, sleep })).rejects.toBe(last);
    expect(calls()).toBe(3);
  });

  it('대기 시간은 1초, 2초로 늘리고 0~500ms 를 더한다', async () => {
    const { fn } = sequence([new FakeError(true), new FakeError(true)]);
    const { sleep, waits } = fakeSleep();

    await withRetry(fn, { isRetryable, sleep, random: () => 0.5 });

    expect(waits).toEqual([1_250, 2_250]);
  });

  it('Retry-After 가 있으면 그 시간만큼 기다리되 10초를 넘기지 않는다', async () => {
    const { fn } = sequence([
      new FakeError(true, 3_000),
      new FakeError(true, 60_000),
    ]);
    const { sleep, waits } = fakeSleep();

    await withRetry(fn, { isRetryable, sleep });

    expect(waits).toEqual([3_000, MAX_RETRY_AFTER_MS]);
  });

  it('beforeRetry 가 false 면 재시도하지 않고 마지막 오류를 던진다', async () => {
    const first = new FakeError(true);
    const { fn, calls } = sequence([first]);
    const { sleep } = fakeSleep();
    const infos: number[] = [];

    await expect(
      withRetry(fn, {
        isRetryable,
        sleep,
        beforeRetry: (info) => {
          infos.push(info.attempt);
          return false;
        },
      }),
    ).rejects.toBe(first);
    expect(calls()).toBe(1);
    expect(infos).toEqual([1]);
  });
});

describe('isNetworkError', () => {
  it('fetch 실패와 타임아웃은 네트워크 오류다', () => {
    expect(isNetworkError(new TypeError('fetch failed'))).toBe(true);
    const timeout = new Error('timed out');
    timeout.name = 'TimeoutError';
    expect(isNetworkError(timeout)).toBe(true);
  });

  it('코드 버그로 생긴 TypeError 나 일반 오류는 아니다', () => {
    expect(
      isNetworkError(new TypeError('Cannot read properties of undefined')),
    ).toBe(false);
    expect(isNetworkError(new Error('x'))).toBe(false);
  });
});

describe('parseRetryAfter', () => {
  it('초 단위 값만 밀리초로 바꾼다', () => {
    expect(parseRetryAfter('3')).toBe(3_000);
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter('Wed, 21 Oct 2015 07:28:00 GMT')).toBeUndefined();
  });
});

const timeoutError = () =>
  new DOMException('The operation was aborted due to timeout', 'TimeoutError');

describe('타임아웃 재시도 상한', () => {
  it('타임아웃은 기본 1번만 다시 시도한다', async () => {
    let calls = 0;
    const fn = () => {
      calls += 1;
      return Promise.reject(timeoutError());
    };

    await expect(
      withRetry(fn, {
        isRetryable: () => true,
        sleep: () => Promise.resolve(),
      }),
    ).rejects.toMatchObject({ name: 'TimeoutError' });
    expect(calls).toBe(2);
  });

  it('timeoutRetries 가 0 이면 타임아웃은 다시 시도하지 않는다', async () => {
    let calls = 0;
    const fn = () => {
      calls += 1;
      return Promise.reject(timeoutError());
    };

    await expect(
      withRetry(fn, {
        isRetryable: () => true,
        timeoutRetries: 0,
        sleep: () => Promise.resolve(),
      }),
    ).rejects.toMatchObject({ name: 'TimeoutError' });
    expect(calls).toBe(1);
  });

  it('타임아웃 상한은 다른 일시 오류의 재시도 횟수와 따로 센다', async () => {
    const failures: unknown[] = [new TypeError('fetch failed'), timeoutError()];
    let calls = 0;
    const fn = () => {
      calls += 1;
      const failure = failures.shift();
      return failure ? Promise.reject(failure) : Promise.resolve('ok');
    };

    await expect(
      withRetry(fn, {
        isRetryable: isNetworkError,
        sleep: () => Promise.resolve(),
      }),
    ).resolves.toBe('ok');
    expect(calls).toBe(3);
  });

  it('DOMException 타임아웃과 본문 수신 중 끊김도 네트워크 오류다', () => {
    expect(isNetworkError(timeoutError())).toBe(true);
    expect(isNetworkError(new TypeError('terminated'))).toBe(true);
  });
});

describe('readJson', () => {
  it('JSON 이 아닌 본문은 null 로 읽는다', async () => {
    await expect(readJson(new Response('Bad Gateway'))).resolves.toBeNull();
  });

  it('본문을 받다가 끊기면 삼키지 않고 던진다', async () => {
    const broken = new Response(
      new ReadableStream({
        start(controller) {
          controller.error(new TypeError('terminated'));
        },
      }),
    );

    await expect(readJson(broken)).rejects.toThrow('terminated');
  });
});
