import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { FieldError } from '../../../../shared/index.js';

/** 요청 값이 zod 스키마 검증에 실패했을 때 던지는 예외. */
export class ValidationException extends Error {
  readonly fieldErrors: FieldError[];

  constructor(issues: readonly StandardSchemaV1.Issue[]) {
    super('Validation failed');
    this.name = 'ValidationException';
    this.fieldErrors = ValidationException.groupByField(issues);
  }

  /** 같은 필드의 오류를 하나로 묶는다. 경로가 없는 값(단일 파라미터)은 `value`로 표시한다. */
  private static groupByField(
    issues: readonly StandardSchemaV1.Issue[],
  ): FieldError[] {
    const byField = Map.groupBy(issues, (issue) =>
      (issue.path ?? [])
        .map((segment) => (typeof segment === 'object' ? segment.key : segment))
        .join('.'),
    );

    return [...byField].map(([field, fieldIssues]) => ({
      field: field || 'value',
      reasons: fieldIssues.map((issue) => issue.message),
    }));
  }
}
