import type {ApiEnvelope} from '@shared';

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export const request = async <T>(path: string, init?: RequestInit) => {
  if (!BASE_URL) {
    throw new ApiError(
      'CLIENT_CONFIG',
      'NEXT_PUBLIC_API_URL이 없습니다. web/.env.local에 서버 주소를 넣어 주세요.',
    );
  }

  // init.headers는 객체·배열·Headers 중 무엇이든 올 수 있어 Headers로 합친다.
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${BASE_URL}${path}`, {...init, headers});
  const body = (await response.json()) as ApiEnvelope<T>;

  if (!body.isSuccess) {
    throw new ApiError(body.code, body.message);
  }
  return body.result as T;
};
