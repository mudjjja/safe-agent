#!/bin/bash
# simulate_attack.sh — 攻击模拟脚本
# 队员A交付物：演示时一键跑，模拟安全事件以验证 Agent 采集和告警系统
#
# 执行后自动:
#   1. CPU 打高 — stress 占用 CPU 核（60秒）
#   2. SSH 暴力破解 — 50次模拟登录失败
#   3. 大量网络连接 — 100次并发 curl 请求
#
# 使用方式:
#   麒麟系统上执行: bash scripts/simulate_attack.sh
#   停止: Ctrl+C 即可清理所有模拟进程
# ============================================================

set -euo pipefail
SCRIPT_VERSION="v1.0.0"
START_TIME=$(date '+%Y-%m-%d %H:%M:%S')

echo ""
echo "╔═══════════════════════════════════════════╗"
echo "║    攻击模拟脚本 ${SCRIPT_VERSION}            ║"
echo "║    用于验证麒麟安全运维Agent告警系统       ║"
echo "╚═══════════════════════════════════════════╝"
echo "启动时间: ${START_TIME}"
echo ""

# ============================================================
# 清理函数 — 在退出时恢复系统
# ============================================================
cleanup() {
    echo ""
    echo "[*] 正在清理模拟进程..."
    pkill -f "stress --cpu" 2>/dev/null || true
    pkill -f "yes.*CPU stress" 2>/dev/null || true
    pkill -f "curl.*localhost" 2>/dev/null || true
    echo "  [✓] 所有模拟进程已清理"
    echo ""
    echo "=== 攻击模拟结束 ==="
    exit 0
}

# 捕获退出信号
trap cleanup SIGINT SIGTERM EXIT

# ============================================================
# 模块1: CPU 打高
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  模块1: 模拟 CPU 异常升高"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

CPU_CORES=$(nproc 2>/dev/null || echo 2)
STRESS_CORES=$((CPU_CORES > 4 ? CPU_CORES - 2 : CPU_CORES))

if command -v stress &>/dev/null; then
    echo "  [*] 使用 stress 打高 CPU (${STRESS_CORES} 核, 60s)..."
    stress --cpu "${STRESS_CORES}" --timeout 60 &
elif command -v stress-ng &>/dev/null; then
    echo "  [*] 使用 stress-ng 打高 CPU (${STRESS_CORES} 核, 60s)..."
    stress-ng --cpu "${STRESS_CORES}" --timeout 60 &
else
    echo "  [*] stress 未安装，使用 yes 模拟 CPU 打高..."
    for i in $(seq 1 "${STRESS_CORES}"); do
        yes "CPU stress test - kylin security agent" >/dev/null &
    done
fi
echo "  [✓] CPU 打高已启动"
echo ""

# ============================================================
# 模块2: SSH 暴力破解模拟
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  模块2: 模拟 SSH 暴力破解"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

AUTH_LOG="/var/log/auth.log"
if [ ! -f "$AUTH_LOG" ]; then
    echo "  [⚠] 未找到 $AUTH_LOG，尝试创建目录..."
    mkdir -p /var/log 2>/dev/null || true
fi

ATTACK_IPS=("203.0.113.99" "198.51.100.42" "192.0.2.88" "45.33.32.156")
USERNAMES=("root" "admin" "deploy" "test" "oracle" "postgres")

echo "  [*] 写入 50 条模拟 SSH 失败记录..."
for i in $(seq 1 50); do
    ATTACK_TIME=$(date '+%b %e %H:%M:%S')
    IP=${ATTACK_IPS[$((RANDOM % ${#ATTACK_IPS[@]}))]}
    USER=${USERNAMES[$((RANDOM % ${#USERNAMES[@]}))]}
    PORT=$((1024 + RANDOM % 60000))
    echo "${ATTACK_TIME} $(hostname) sshd[$((i * 1000))]: Failed password for ${USER} from ${IP} port ${PORT} ssh2" >>"$AUTH_LOG" 2>/dev/null || true
done

for i in $(seq 1 10); do
    ATTACK_TIME=$(date '+%b %e %H:%M:%S')
    IP=${ATTACK_IPS[$((RANDOM % ${#ATTACK_IPS[@]}))]}
    echo "${ATTACK_TIME} $(hostname) sshd[$((i + 50000))]: Connection closed by authenticating user root ${IP} port $((1024 + RANDOM % 60000)) [preauth]" >>"$AUTH_LOG" 2>/dev/null || true
done

echo "  [✓] SSH 暴力破解模拟完成（60条日志已写入 ${AUTH_LOG}）"
echo ""

# ============================================================
# 模块3: 大量网络连接
# ============================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  模块3: 模拟大量网络连接"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

ADMIN_URL="${ADMIN_URL:-http://localhost:8080}"
echo "  [*] 目标地址: ${ADMIN_URL}/api/dashboard/stats"
echo "  [*] 发送 100 次并发请求..."

for i in $(seq 1 10); do
    for j in $(seq 1 10); do
        curl -s "${ADMIN_URL}/api/dashboard/stats" >/dev/null 2>&1 &
    done
    sleep 0.2
done
wait
echo "  [✓] 网络连接模拟完成"
echo ""

# ============================================================
# 完成
# ============================================================
END_TIME=$(date '+%Y-%m-%d %H:%M:%S')
echo "═══════════════════════════════════════════"
echo "  攻击模拟全部完成"
echo "═══════════════════════════════════════════"
echo "启动: ${START_TIME}"
echo "完成: ${END_TIME}"
echo ""
echo "下一步验证："
echo "  1. 查看 Agent 采集日志: tail -50 agent.log | grep -E 'CPU|内存|磁盘'"
echo "  2. 查看 SSH 日志: tail -10 /var/log/auth.log"
echo "  3. 检查后端告警: curl http://localhost:8080/api/alerts"
echo ""
echo "按 Ctrl+C 停止所有模拟进程"
sleep 30
