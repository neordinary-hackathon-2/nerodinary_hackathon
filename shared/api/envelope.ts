/**
 * 모든 API 응답이 공유하는 봉투.
 * 도메인 타입은 `result` 안쪽만 정의한다.
 */
export type ApiEnvelope<T> = {
  isSuccess: boolean;
  code: string;
  message: string;
  result: T | null;
};

/** 검증 실패(COMMON400_VALIDATION) 응답의 `result` 항목. */
export type FieldError = {
  field: string;
  reasons: string[];
};
