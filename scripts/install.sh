#!/bin/sh
# Installs Masir from the published image into ./masir.
#   curl -fsSL https://raw.githubusercontent.com/hamedniroomand/masir/main/scripts/install.sh | sh
# Installs Docker first when the machine has none. Safe to run again: it keeps
# an existing .env and only pulls and restarts.
set -eu

RAW="https://raw.githubusercontent.com/hamedniroomand/masir/${MASIR_REF:-main}"
DIR="${MASIR_DIR:-masir}"

say() { printf '\n==> %s\n' "$1"; }
fail() { printf 'error: %s\n' "$1" >&2; exit 1; }

# `curl | sh` leaves stdin on the pipe, so the prompt talks to the terminal.
ask() {
  printf '%s ' "$1" >/dev/tty
  read -r answer </dev/tty
  printf '%s' "$answer"
}

# Alphanumeric, so the value fits in a connection string and needs no quoting.
secret() { head -c 1024 /dev/urandom | LC_ALL=C tr -dc 'A-Za-z0-9' | head -c "$1"; }

need_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    return
  fi
  [ "$(uname -s)" = Linux ] || fail "install Docker Desktop first, then run this script again"
  say "Installing Docker"
  curl -fsSL https://get.docker.com | sh
  if [ "$(id -u)" != 0 ]; then
    sudo usermod -aG docker "$(id -un)" || true
    echo "Docker was installed. Log out and in again so your user can run it, then run this script again."
    exit 0
  fi
}

write_env() {
  domain="$(ask 'Address people will type, with protocol (https://go.example.com):')"
  case "$domain" in
    http://*|https://*) ;;
    *) fail "the address must start with http:// or https://" ;;
  esac
  domain="${domain%/}"
  curl -fsSL "$RAW/.env.example" -o .env
  set_env() { sed -i.bak "s|^$1=.*|$1=$2|" .env && rm .env.bak; }
  set_env POSTGRES_PASSWORD "$(secret 48)"
  set_env NUXT_SESSION_PASSWORD "$(secret 48)"
  set_env NUXT_VISITOR_HASH_SECRET "$(secret 48)"
  set_env NUXT_ROOT_DOMAIN "$domain"
  set_env NUXT_PUBLIC_SHORT_DOMAIN "$domain"
  set_env NUXT_STORAGE_PUBLIC_BASE_URL "$domain/uploads"
  set_env NUXT_TRUSTED_PROXY_DEPTH 1
  set_env ADMIN_PASSWORD "$(secret 20)"
  chmod 600 .env
}

need_docker

say "Preparing $DIR"
mkdir -p "$DIR"
cd "$DIR"
curl -fsSL "$RAW/compose.image.yaml" -o compose.yaml
if [ -f .env ]; then
  echo "Keeping the existing .env"
else
  write_env
fi

say "Starting Masir"
docker compose pull
docker compose up -d --wait

say "Masir is running"
cat <<MSG
Folder:   $(pwd)
Address:  $(sed -n 's/^NUXT_ROOT_DOMAIN=//p' .env) (port $(sed -n 's/^MASIR_APP_PORT=//p' .env) on this machine)
Admin:    $(sed -n 's/^ADMIN_EMAIL=//p' .env) / $(sed -n 's/^ADMIN_PASSWORD=//p' .env)

Next:
  1. Point a reverse proxy with TLS at port $(sed -n 's/^MASIR_APP_PORT=//p' .env).
     https://hamedniroomand.github.io/masir/guide/self-hosting#behind-a-reverse-proxy
  2. Create the first account, then change its password after sign-in:
       cd $DIR && docker compose exec app bun run db:seed:admin
MSG
