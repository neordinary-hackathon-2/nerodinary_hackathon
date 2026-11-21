import { applyDecorators, HttpStatus, Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiResponse as SwaggerResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { ErrorCode } from '../exception/error-code.js';

interface SuccessOptions {
  status?: HttpStatus.OK | HttpStatus.CREATED;
  isArray?: boolean;
  description?: string;
}

/**
 * 성공 응답을 공통 봉투 형태로 Swagger에 문서화한다.
 * 사용: @ApiSuccess(ContentResponseDto)
 *       @ApiSuccess(ContentResponseDto, { status: HttpStatus.CREATED })
 *       @ApiSuccess(ContentResponseDto, { isArray: true })
 */
export function ApiSuccess<T extends Type<unknown>>(
  model?: T,
  { status = HttpStatus.OK, isArray = false, description }: SuccessOptions = {},
) {
  const created = status === HttpStatus.CREATED;
  const modelRef = model ? { $ref: getSchemaPath(model) } : undefined;
  const result = !modelRef
    ? { type: 'object', nullable: true, example: null }
    : isArray
      ? { type: 'array', items: modelRef }
      : modelRef;

  return applyDecorators(
    ...(model ? [ApiExtraModels(model)] : []),
    SwaggerResponse({
      status,
      description: description ?? (created ? '생성 성공' : '성공'),
      schema: {
        type: 'object',
        properties: {
          isSuccess: { type: 'boolean', example: true },
          code: {
            type: 'string',
            example: created ? 'COMMON201' : 'COMMON200',
          },
          message: {
            type: 'string',
            example: created ? '생성에 성공했습니다.' : '요청에 성공했습니다.',
          },
          result,
        },
      },
    }),
  );
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
