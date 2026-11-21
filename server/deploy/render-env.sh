#!/usr/bin/env bash
# 운영용 .env.production 내용을 표준출력으로 만든다. (deploy.yml이 Actions 러너에서 실행)
# 값은 환경변수로 받는다. 출처는 GitHub Secrets / Variables 이고 인스턴스에는 사람이 쓰지 않는다.
#
# 환경변수를 추가할 때는 src/config/env.validation.ts, .env.example, 이 파일,
# deploy.yml 의 env 블록, GitHub 설정(Secrets 또는 Variables)을 함께 고친다.
set -euo pipefail

# 비어 있으면 배포를 중단할 값. 인스턴스의 기존 파일을 건드리기 전에 걸러낸다.
REQUIRED=(CORS_ORIGINS DB_HOST DB_USERNAME DB_PASSWORD DB_DATABASE SEED_TOKEN)

missing=()
for name in "${REQUIRED[@]}"; do
  if [[ -z "${!name:-}" ]]; then missing+=("$name"); fi
done
if (( ${#missing[@]} > 0 )); then
  echo "ERROR: 운영 환경변수가 비어 있습니다: ${missing[*]}" >&2
  echo "       GitHub → Settings → Secrets and variables → Actions 에 등록하세요." >&2
  exit 1
fi

# 값은 작은따옴표로 감싼다. dotenv가 #, 공백, $ 를 그대로 읽게 하기 위해서다.
# 작은따옴표나 줄바꿈이 든 값은 이 방식으로 표현할 수 없으므로 거부한다.
# 전부 검사를 통과한 뒤에 한꺼번에 출력한다. (실패 시 일부만 출력되지 않게)
output=""
emit() {
  local key=$1 value=$2
  if [[ "$value" == *"'"* || "$value" == *$'\n'* || "$value" == *$'\r'* ]]; then
    echo "ERROR: ${key} 값에 작은따옴표나 줄바꿈이 있어 .env 로 쓸 수 없습니다." >&2
    exit 1
  fi
  output+="${key}='${value}'"$'\n'
}

emit NODE_ENV production
emit PORT 3000
emit CORS_ORIGINS "$CORS_ORIGINS"

emit DB_HOST "$DB_HOST"
emit DB_PORT "${DB_PORT:-3306}"
emit DB_USERNAME "$DB_USERNAME"
emit DB_PASSWORD "$DB_PASSWORD"
emit DB_DATABASE "$DB_DATABASE"
emit DB_MIGRATE_ON_START true
emit DB_LOGGING "${DB_LOGGING:-false}"

emit SEED_TOKEN "$SEED_TOKEN"

printf '%s' "$output"
