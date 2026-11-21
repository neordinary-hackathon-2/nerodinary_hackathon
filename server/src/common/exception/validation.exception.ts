import { ValidationError } from '@nestjs/common';

export interface FieldError {
  field: string;
  reasons: string[];
}

/** ValidationPipe가 DTO 검증에 실패했을 때 던지는 예외. */
export class ValidationException extends Error {
  readonly fieldErrors: FieldError[];

  constructor(errors: ValidationError[]) {
    super('Validation failed');
    this.name = 'ValidationException';
    this.fieldErrors = ValidationException.flatten(errors);
  }

  private static flatten(
    errors: ValidationError[],
    parentPath = '',
  ): FieldError[] {
    return errors.flatMap((error) => {
      const path = parentPath
        ? `${parentPath}.${error.property}`
        : error.property;
      const own: FieldError[] = error.constraints
        ? [{ field: path, reasons: Object.values(error.constraints) }]
        : [];
      return [
        ...own,
        ...ValidationException.flatten(error.children ?? [], path),
      ];
    });
  }
}
