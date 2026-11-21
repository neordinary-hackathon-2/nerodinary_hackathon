import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiResponse as SwaggerResponse } from '@nestjs/swagger';
import { z } from 'zod';
import { ErrorCodes } from '../exception/error-code.js';
import type { ErrorCode } from '../exception/error-code.js';

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
            schema: {
              type: 'object',
              required: ['isSuccess', 'code', 'message', 'result'],
              properties: {
                isSuccess: { type: 'boolean', enum: [false], example: false },
                code: { type: 'string', example: codes[0].code },
                message: { type: 'string', example: codes[0].message },
                result: errorResultSchema(codes),
              },
            },
            examples: Object.fromEntries(
              codes.map((c) => [
                c.code,
                {
                  value: {
                    isSuccess: false,
                    code: c.code,
                    message: c.message,
                    result: errorResultExample(c),
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

function errorResultSchema(errorCodes: ErrorCode[]) {
  const validationResult = {
    type: 'array',
    items: {
      type: 'object',
      required: ['field', 'reasons'],
      properties: {
        field: { type: 'string', example: 'channelNumber' },
        reasons: {
          type: 'array',
          items: { type: 'string' },
          example: ['Invalid input'],
        },
      },
    },
  };

  const hasValidationError = errorCodes.some(
    (error) => error.code === ErrorCodes.VALIDATION_FAILED.code,
  );
  const hasNullResultError = errorCodes.some(
    (error) => error.code !== ErrorCodes.VALIDATION_FAILED.code,
  );

  if (hasValidationError && hasNullResultError) {
    return {
      oneOf: [
        validationResult,
        { type: 'object', nullable: true, example: null },
      ],
    };
  }
  if (hasValidationError) {
    return validationResult;
  }

  return { nullable: true, example: null };
}

function errorResultExample(errorCode: ErrorCode): unknown {
  return errorCode.code === ErrorCodes.VALIDATION_FAILED.code
    ? [{ field: 'channelNumber', reasons: ['Invalid input'] }]
    : null;
}
