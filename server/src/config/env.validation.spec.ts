import { validateEnv } from './env.validation.js';

/** 부팅 시 환경변수 검증. 잘못된 설정으로 서버가 뜨는 것을 막는지 확인한다. */
const validEnv = {
  DB_HOST: 'localhost',
  DB_USERNAME: 'root',
  DB_PASSWORD: '',
  DB_DATABASE: 'hackathon',
  SEED_TOKEN: 'test-seed-token-0123456789',
};

describe('validateEnv', () => {
  it('필수 값이 모두 있으면 통과한다', () => {
    expect(() => validateEnv(validEnv)).not.toThrow();
  });

  it('SEED_TOKEN 이 없으면 서버가 뜨지 않는다', () => {
    const { SEED_TOKEN: _omitted, ...withoutToken } = validEnv;
    expect(() => validateEnv(withoutToken)).toThrow('SEED_TOKEN');
  });

  it('MIN 이 MAX 보다 크면 거부한다 (모든 영상이 거부되는 설정)', () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        MIN_DURATION_SECONDS: '7200',
        MAX_DURATION_SECONDS: '600',
      }),
    ).toThrow('MIN_DURATION_SECONDS');
  });

  it('MIN 만 설정해도 기본 MAX(7200초)와 비교한다', () => {
    expect(() =>
      validateEnv({ ...validEnv, MIN_DURATION_SECONDS: '9000' }),
    ).toThrow('MIN_DURATION_SECONDS');
  });

  it('MAX 만 설정해도 기본 MIN(600초)과 비교한다', () => {
    expect(() =>
      validateEnv({ ...validEnv, MAX_DURATION_SECONDS: '300' }),
    ).toThrow('MIN_DURATION_SECONDS');
  });

  it('MIN ≤ MAX 면 통과한다', () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        MIN_DURATION_SECONDS: '600',
        MAX_DURATION_SECONDS: '7200',
      }),
    ).not.toThrow();
  });
});
