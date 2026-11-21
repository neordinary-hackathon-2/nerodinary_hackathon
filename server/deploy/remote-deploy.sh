#!/usr/bin/env bash
# Lightsail 인스턴스에서 실행되는 배포 스크립트. (deploy.yml이 SSH로 호출)
# 전제: ~/app/.env.production 은 deploy.yml이 이 스크립트 직전에 GitHub Secrets/Variables 로 써 둔다.
#       (저장소에는 올리지 않고, 인스턴스에서 직접 고치지도 않는다)
set -euo pipefail

APP_DIR="$HOME/app"
PORT="${PORT:-3000}"
cd "$APP_DIR"

if [[ ! -f .env.production ]]; then
  echo "ERROR: $APP_DIR/.env.production 이 없습니다. deploy.yml의 env 쓰기 단계를 확인하세요." >&2
  exit 1
fi

pnpm install --prod --frozen-lockfile
pm2 startOrReload ecosystem.config.cjs --env production
pm2 save

# 새 프로세스가 요청을 받고 DB에도 붙는지 확인한다. 실패하면 배포 실패로 처리.
for attempt in $(seq 1 20); do
  if curl -fsS "http://localhost:${PORT}/api/health" | grep -q '"database":"UP"'; then
    echo "배포 성공 (health check ok, attempt ${attempt})"
    exit 0
  fi
  sleep 2
done

echo "ERROR: health check 실패 (서버 미기동 또는 DB 연결 실패)" >&2
pm2 logs hackathon-api --lines 50 --nostream >&2 || true
exit 1
