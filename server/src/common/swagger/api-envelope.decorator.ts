import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiResponse as SwaggerResponse } from '@nestjs/swagger';
import { z } from 'zod';
import { ErrorCode } from '../exception/error-code.js';

interface SuccessOptions {
  status?: HttpStatus.OK | HttpStatus.CREATED;
  description?: string;
}

/**
 * 성공 응답을 공통 봉투 형태로 Swagger에 문서화한다. `result`의 모양은 zod 스키마에서 만든다.
 * 사용: @ApiSuccess(contentResponseSchema)
 *       @ApiSuccess(contentResponseSchema, { status: HttpStatus.CREATED })
 *       @ApiSuccess(z.array(contentResponseSchema))
 *       @ApiSuccess()   // result가 null인 응답
 */
export function ApiSuccess(
  resultSchema: z.ZodType = z.null(),
  { status = HttpStatus.OK, description }: SuccessOptions = {},
) {
  const created = status === HttpStatus.CREATED;

  return SwaggerResponse({
    status,
    description: description ?? (created ? '생성 성공' : '성공'),
    standardSchema: z.object({
      isSuccess: z.literal(true),
      code: z.string().meta({ example: created ? 'COMMON201' : 'COMMON200' }),
      message: z.string().meta({
        example: created ? '생성에 성공했습니다.' : '요청에 성공했습니다.',
      }),
      result: resultSchema,
    }),
  });
}

/**
 * 실패 응답을 Swagger에 문서화한다. 같은 상태 코드의 에러는 하나의 응답에 예시로 묶인다.
 * 사용: @ApiFailure(ErrorCodes.VALIDATION_FAILED, ErrorCodes.NOT_FOUND)
 */
export function ApiFailure(...errorCodes: ErrorCode[]) {
  const byStatus = Map.groupBy(errorCodes, (errorCode) => errorCode.status);

  return applyDecorators(
    ...[...byStatus].map(([status, codes]) =>
      SwaggerResponse({
        status,
        description: codes.map((c) => c.message).join(' / '),
        content: {
          'application/json': {
            examples: Object.fromEntries(
              codes.map((c) => [
                c.code,
                {
                  value: {
                    isSuccess: false,
                    code: c.code,
                    message: c.message,
                    result: null,
                  },
                },
              ]),
            ),
          },
        },
      }),
    ),
  );
}
