import { plainToInstance, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export enum Environment {
  Local = 'local',
  Production = 'production',
  Test = 'test',
}

const toBoolean = ({ value }: { value: unknown }) =>
  value === true || value === 'true';

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Local;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  CORS_ORIGINS: string = '*';

  @IsString()
  DB_HOST: string;

  @Type(() => Number)
  @IsInt()
  DB_PORT: number = 3306;

  @IsString()
  DB_USERNAME: string;

  @IsString()
  DB_PASSWORD: string;

  @IsString()
  DB_DATABASE: string;

  @IsOptional()
  @IsBoolean()
  DB_MIGRATE_ON_START: boolean = false;

  @IsOptional()
  @IsBoolean()
  DB_LOGGING: boolean = false;
}

/**
 * 부팅 시 환경변수를 검증한다. 필수 값이 없거나 형식이 틀리면 즉시 실패시켜
 * 잘못된 설정으로 서버가 뜨는 것을 막는다.
 */
export function validateEnv(config: Record<string, unknown>) {
  const normalized = {
    ...config,
    ...(config.DB_MIGRATE_ON_START !== undefined && {
      DB_MIGRATE_ON_START: toBoolean({ value: config.DB_MIGRATE_ON_START }),
    }),
    ...(config.DB_LOGGING !== undefined && {
      DB_LOGGING: toBoolean({ value: config.DB_LOGGING }),
    }),
  };
  const validated = plainToInstance(EnvironmentVariables, normalized);
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .map((e) => `  - ${Object.values(e.constraints ?? {}).join(', ')}`)
      .join('\n');
    throw new Error(`환경변수 설정이 올바르지 않습니다.\n${details}`);
  }
  return validated;
}
