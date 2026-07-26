#!/usr/bin/env bash
# ITP 测试环境一键部署（与生产完全隔离：独立目录/端口/数据库/Tunnel）
#
# 首次运行需要传入与测试版 NBINS 匹配的两个密钥：
#   NBINS_JWT_SECRET=xxx NBINS_SYNC_TOKEN=yyy bash deploy/itp-test-setup.sh
# 之后重复运行（升级代码）不需要再传，值已存入 ~/itp-test/itp-test.env
#
# 完成后： ~/itp-test/start.sh 启动， ~/itp-test/stop.sh 停止
# 访问：   https://itp-test.6666996.xyz
set -euo pipefail

BASE_DIR="$HOME/itp-test"
REPO_URL="https://github.com/xingkaijun/ITP.git"
BRANCH="feature/nbins-itp-integration"
API_PORT=8001
WEB_PORT=8002
TUNNEL_NAME="itp-test"
TUNNEL_HOSTNAME="itp-test.6666996.xyz"
NBINS_API_BASE="https://nbins-api-test.xingcf.workers.dev"

echo "==> 检查依赖"
for cmd in git python3 curl; do
  command -v "$cmd" >/dev/null || { echo "缺少 $cmd，请先安装"; exit 1; }
done
command -v node >/dev/null || { echo "缺少 node（构建前端需要）。Ubuntu: sudo apt install nodejs npm"; exit 1; }

mkdir -p "$BASE_DIR" "$BASE_DIR/data" "$BASE_DIR/bin" "$BASE_DIR/logs"

ENV_FILE="$BASE_DIR/itp-test.env"
if [ ! -f "$ENV_FILE" ]; then
  : "${NBINS_JWT_SECRET:?首次运行必须传入 NBINS_JWT_SECRET（与 nbins-api-test 的 JWT_SECRET 相同）}"
  : "${NBINS_SYNC_TOKEN:?首次运行必须传入 NBINS_SYNC_TOKEN（与 nbins-api-test 的 SYNC_SERVICE_TOKEN 相同）}"
fi

echo "==> 拉取代码 ($BRANCH)"
if [ -d "$BASE_DIR/repo/.git" ]; then
  git -C "$BASE_DIR/repo" fetch origin "$BRANCH"
  git -C "$BASE_DIR/repo" checkout "$BRANCH"
  git -C "$BASE_DIR/repo" pull --ff-only origin "$BRANCH"
else
  git clone --branch "$BRANCH" "$REPO_URL" "$BASE_DIR/repo"
fi

echo "==> 后端依赖 (venv)"
[ -d "$BASE_DIR/venv" ] || python3 -m venv "$BASE_DIR/venv"
"$BASE_DIR/venv/bin/pip" install --quiet --upgrade pip
"$BASE_DIR/venv/bin/pip" install --quiet -r "$BASE_DIR/repo/backend/requirements.txt"

echo "==> 构建前端"
(
  cd "$BASE_DIR/repo/frontend"
  npm install --silent
  VITE_NBINS_API_BASE="$NBINS_API_BASE" npx vite build --base /
)

if [ ! -f "$ENV_FILE" ]; then
  echo "==> 生成环境文件（本地口令随机生成）"
  ADMIN_PW=$(head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n' | cut -c1-12)
  USER_PW=$(head -c 16 /dev/urandom | od -An -tx1 | tr -d ' \n' | cut -c1-12)
  AUTH_SECRET=$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
  cat > "$ENV_FILE" <<EOF
DATABASE_URL=sqlite:///$BASE_DIR/data/itp-test.db
ITP_ADMIN_PASSWORD=$ADMIN_PW
ITP_USER_PASSWORD=$USER_PW
ITP_AUTH_SECRET=$AUTH_SECRET
NBINS_API_BASE=$NBINS_API_BASE
NBINS_JWT_SECRET=$NBINS_JWT_SECRET
NBINS_SYNC_TOKEN=$NBINS_SYNC_TOKEN
NBINS_SYNC_INTERVAL_SECONDS=120
EOF
  chmod 600 "$ENV_FILE"
  echo "    本地应急口令已写入 $ENV_FILE"
fi

echo "==> cloudflared"
CF="$BASE_DIR/bin/cloudflared"
if [ ! -x "$CF" ]; then
  ARCH=$(uname -m)
  case "$ARCH" in
    x86_64) A=amd64 ;;
    aarch64) A=arm64 ;;
    *) echo "未知架构 $ARCH"; exit 1 ;;
  esac
  curl -L -o "$CF" "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-$A"
  chmod +x "$CF"
fi
if [ ! -f "$HOME/.cloudflared/cert.pem" ]; then
  echo "    首次使用需在浏览器里授权（选择 6666996.xyz 域名）："
  "$CF" tunnel login
fi
if ! "$CF" tunnel list 2>/dev/null | grep -qw "$TUNNEL_NAME"; then
  "$CF" tunnel create "$TUNNEL_NAME"
fi
TUNNEL_ID=$("$CF" tunnel list | awk -v n="$TUNNEL_NAME" '$2==n {print $1}')
cat > "$BASE_DIR/cloudflared-config.yml" <<EOF
tunnel: $TUNNEL_ID
credentials-file: $HOME/.cloudflared/$TUNNEL_ID.json
ingress:
  - hostname: $TUNNEL_HOSTNAME
    path: ^/api(\$|/.*)
    service: http://localhost:$API_PORT
  - hostname: $TUNNEL_HOSTNAME
    service: http://localhost:$WEB_PORT
  - service: http_status:404
EOF
"$CF" tunnel route dns "$TUNNEL_NAME" "$TUNNEL_HOSTNAME" 2>/dev/null || true

cat > "$BASE_DIR/start.sh" <<'EOS'
#!/usr/bin/env bash
set -e
BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
"$BASE_DIR/stop.sh" >/dev/null 2>&1 || true
set -a; source "$BASE_DIR/itp-test.env"; set +a
cd "$BASE_DIR/repo/backend"
nohup "$BASE_DIR/venv/bin/python" -m uvicorn app.main:app --host 127.0.0.1 --port 8001 >> "$BASE_DIR/logs/api.log" 2>&1 &
echo $! > "$BASE_DIR/api.pid"
nohup python3 -m http.server 8002 --bind 127.0.0.1 --directory "$BASE_DIR/repo/frontend/dist" >> "$BASE_DIR/logs/web.log" 2>&1 &
echo $! > "$BASE_DIR/web.pid"
nohup "$BASE_DIR/bin/cloudflared" tunnel --config "$BASE_DIR/cloudflared-config.yml" run >> "$BASE_DIR/logs/tunnel.log" 2>&1 &
echo $! > "$BASE_DIR/tunnel.pid"
echo "started -> https://itp-test.6666996.xyz  (logs: $BASE_DIR/logs/)"
EOS
chmod +x "$BASE_DIR/start.sh"

cat > "$BASE_DIR/stop.sh" <<'EOS'
#!/usr/bin/env bash
BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
for p in api web tunnel; do
  if [ -f "$BASE_DIR/$p.pid" ]; then
    kill "$(cat "$BASE_DIR/$p.pid")" 2>/dev/null || true
    rm -f "$BASE_DIR/$p.pid"
    echo "stopped $p"
  fi
done
EOS
chmod +x "$BASE_DIR/stop.sh"

echo ""
echo "==> 部署完成"
echo "    启动：  $BASE_DIR/start.sh"
echo "    停止：  $BASE_DIR/stop.sh"
echo "    地址：  https://$TUNNEL_HOSTNAME"
echo "    NBINS 账号登录：用户名 xkj（测试库，与生产密码无关）"
echo "    本地应急口令：见 $ENV_FILE"
