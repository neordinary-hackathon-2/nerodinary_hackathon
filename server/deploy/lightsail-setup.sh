#!/usr/bin/env bash
# Lightsail 인스턴스(Ubuntu 24.04) 최초 1회 세팅. 접속해서 ubuntu 계정으로 실행한다.
#   bash lightsail-setup.sh
# 설치: Node 24, pnpm, pm2, Caddy(HTTPS 리버스 프록시)
set -euo pipefail

sudo apt-get update -y
sudo apt-get install -y curl debian-keyring debian-archive-keyring apt-transport-https

# Node 24 + pnpm + pm2
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pnpm@11 pm2

# Caddy
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
sudo apt-get update -y && sudo apt-get install -y caddy

# 재부팅 시 pm2 자동 시작
sudo env PATH="$PATH" pm2 startup systemd -u ubuntu --hp /home/ubuntu

mkdir -p ~/app
cat <<'NEXT'

완료. 남은 작업:
  1) /etc/caddy/Caddyfile 을 deploy/Caddyfile 내용으로 교체 후: sudo systemctl reload caddy
  2) 운영 환경변수는 여기서 만들지 않는다. GitHub Secrets/Variables 에 등록하면
     배포(deploy.yml)가 ~/app/.env.production 을 권한 600으로 써 준다.
NEXT
