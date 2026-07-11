#!/bin/bash
# deploy.sh — 麒麟安全运维系统一键部署脚本
#
# 使用方式:
#   sudo bash deploy/deploy.sh                    # 自动检测架构
#   sudo bash deploy/deploy.sh --build            # 强制重新编译
#   sudo bash deploy/deploy.sh --skip-build       # 跳过编译 (使用已有二进制)
#
# 环境变量 (可选，不设置则交互式输入):
#   LLM_API_KEY="sk-xxx" sudo -E bash deploy/deploy.sh
# ============================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

pass()  { echo -e "${GREEN}[✓]${NC} $*"; }
fail()  { echo -e "${RED}[✗]${NC} $*"; }
warn()  { echo -e "${YELLOW}[⚠]${NC} $*"; }
info()  { echo -e "${CYAN}[*]${NC} $*"; }

# ============================================================
# 配置
# ============================================================
INSTALL_DIR="/opt/safe-agent"
SERVICE_DIR="/etc/systemd/system"
AGENT_ID="${AGENT_ID:-kylin-agent-01}"
ADMIN_URL="${ADMIN_URL:-http://127.0.0.1:8080}"
FORCE_BUILD=false
SKIP_BUILD=false

[[ "${1:-}" == "--build" ]] && FORCE_BUILD=true
[[ "${1:-}" == "--skip-build" ]] && SKIP_BUILD=true

# 获取脚本所在的项目根目录
SCRIPT_DIR="$(cd "$(dirname "$0")"/.. && pwd)"
cd "$SCRIPT_DIR"

# ============================================================
# 权限检查
# ============================================================
if [[ "$(id -u)" -ne 0 ]]; then
    fail "请使用 sudo 运行本脚本"
    exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║   麒麟安全运维 — 一键部署                    ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  安装目录 : ${INSTALL_DIR}"
echo "║  Agent ID : ${AGENT_ID}"
echo "║  Admin    : ${ADMIN_URL}"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ============================================================
# Step 1: 编译
# ============================================================
echo "━━━ Step 1/6: 编译二进制 ━━━"

ARCH=$(uname -m)
GO_ARCH="$ARCH"

case "$ARCH" in
    loongarch64) GO_ARCH="loong64" ;;
    x86_64)      GO_ARCH="amd64" ;;
    aarch64)     GO_ARCH="arm64" ;;
esac

info "检测到架构: ${ARCH} (GOARCH=${GO_ARCH})"

if $SKIP_BUILD; then
    warn "跳过编译 (--skip-build)"
elif $FORCE_BUILD || [[ ! -f "build/admin" ]] || [[ ! -f "build/agent" ]]; then
    info "正在编译 admin..."
    CGO_ENABLED=0 GOARCH="$GO_ARCH" go build -o build/admin ./cmd/admin/
    pass "admin 编译完成"

    info "正在编译 agent..."
    CGO_ENABLED=0 GOARCH="$GO_ARCH" go build -o build/agent ./cmd/agent/
    pass "agent 编译完成"
else
    pass "二进制已存在，跳过编译 (使用 --build 强制重新编译)"
fi

# ============================================================
# Step 2: 创建目录结构
# ============================================================
echo ""
echo "━━━ Step 2/6: 创建目录结构 ━━━"

mkdir -p "${INSTALL_DIR}"/{data,frontend/dist}

# 停止旧服务（如果存在）
systemctl stop kylin-agent kylin-admin 2>/dev/null || true

# ============================================================
# Step 3: 部署文件
# ============================================================
echo ""
echo "━━━ Step 3/6: 部署文件 ━━━"

# 二进制
cp -f build/admin  "${INSTALL_DIR}/admin"
cp -f build/agent "${INSTALL_DIR}/agent"
chmod +x "${INSTALL_DIR}/admin" "${INSTALL_DIR}/agent"
pass "二进制已复制"

# 前端静态文件
if [[ -d "frontend/dist" ]]; then
    cp -rf frontend/dist/* "${INSTALL_DIR}/frontend/dist/"
    pass "前端静态文件已复制"
else
    warn "frontend/dist 目录不存在，跳过前端文件"
fi

# 攻击模拟脚本
if [[ -f "scripts/simulate_attack.sh" ]]; then
    cp -f scripts/simulate_attack.sh "${INSTALL_DIR}/simulate_attack.sh"
    chmod +x "${INSTALL_DIR}/simulate_attack.sh"
    pass "攻击模拟脚本已复制"
fi

# ============================================================
# Step 4: 配置环境变量
# ============================================================
echo ""
echo "━━━ Step 4/6: 配置环境 ━━━"

ENV_FILE="${INSTALL_DIR}/env"

if [[ -n "${LLM_API_KEY:-}" ]]; then
    cat > "$ENV_FILE" << EOF
# 麒麟安全运维 — 环境变量
LLM_API_KEY=${LLM_API_KEY}
LLM_BASE_URL=${LLM_BASE_URL:-https://api.deepseek.com}
LLM_MODEL=${LLM_MODEL:-deepseek-chat}
EOF
    pass "环境文件已创建 (使用环境变量 LLM_API_KEY)"
else
    if [[ -f "$ENV_FILE" ]]; then
        pass "环境文件已存在，跳过"
    else
        warn "未设置 LLM_API_KEY 环境变量"
        echo ""
        read -rp "  请输入 DeepSeek API Key: " API_KEY_INPUT
        cat > "$ENV_FILE" << EOF
LLM_API_KEY=${API_KEY_INPUT}
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-chat
EOF
        pass "环境文件已创建"
    fi
fi

chmod 600 "$ENV_FILE"

# ============================================================
# Step 5: 安装 systemd 服务
# ============================================================
echo ""
echo "━━━ Step 5/6: 安装 systemd 服务 ━━━"

# agent service
sed -e "s|Environment=AGENT_ID=.*|Environment=AGENT_ID=${AGENT_ID}|" \
    -e "s|Environment=ADMIN_URL=.*|Environment=ADMIN_URL=${ADMIN_URL}|" \
    deploy/kylin-agent.service > /tmp/kylin-agent.service
cp -f /tmp/kylin-agent.service "${SERVICE_DIR}/kylin-agent.service"

# admin service
sed -e "s|Environment=LISTEN_ADDR=.*|Environment=LISTEN_ADDR=:8080|" \
    deploy/kylin-admin.service > /tmp/kylin-admin.service
cp -f /tmp/kylin-admin.service "${SERVICE_DIR}/kylin-admin.service"

pass "systemd 服务文件已安装"

systemctl daemon-reload
pass "systemd 已重新加载"

# ============================================================
# Step 6: 启动服务
# ============================================================
echo ""
echo "━━━ Step 6/6: 启动服务 ━━━"

systemctl enable --now kylin-admin
pass "kylin-admin 已启动并设为开机自启"

systemctl enable --now kylin-agent
pass "kylin-agent 已启动并设为开机自启"

sleep 2

# ============================================================
# 验证
# ============================================================
echo ""
echo "━━━ 部署验证 ━━━"

# admin
ADMIN_OK=false
for i in $(seq 1 5); do
    if curl -s --connect-timeout 2 "http://localhost:8080/api/dashboard/stats" > /dev/null 2>&1; then
        ADMIN_OK=true
        break
    fi
    sleep 1
done

if $ADMIN_OK; then
    pass "Admin API 正常响应"
else
    fail "Admin API 无响应，查看日志: journalctl -u kylin-admin -n 20"
fi

# agent
if systemctl is-active --quiet kylin-agent; then
    pass "Agent 服务运行中"
else
    fail "Agent 服务未运行，查看日志: journalctl -u kylin-agent -n 20"
fi

# 验证 agent 是否有采集数据
if $ADMIN_OK; then
    curl -s "http://localhost:8080/api/agent/list" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print('Agent 在线' if any(a.get('online') for a in d) else 'Agent 未上报数据')" 2>/dev/null || true
fi

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║           部署完成                            ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  管理后台 : http://localhost:8080              ║"
echo "║  Agent ID : ${AGENT_ID}                       "
echo "║  配置文件 : ${ENV_FILE}                       "
echo "║                                                "
echo "║  常用命令:                                     "
echo "║    systemctl status kylin-admin               "
echo "║    systemctl status kylin-agent               "
echo "║    journalctl -u kylin-admin -f              "
echo "║    journalctl -u kylin-agent -f              "
echo "║    bash ${INSTALL_DIR}/simulate_attack.sh    "
echo "╚══════════════════════════════════════════════╝"
