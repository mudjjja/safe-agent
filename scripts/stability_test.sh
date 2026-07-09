#!/bin/bash
# stability_test.sh — 稳定性测试脚本
# 用法: bash scripts/stability_test.sh [时长(分钟)]
# 默认30分钟，自动检测 agent 是否持续运行，每30秒curl一次latest数据

set -euo pipefail

DURATION_MIN=${1:-30}
INTERVAL_SEC=30
ADMIN_URL="${ADMIN_URL:-http://localhost:8080}"
START_TIME=$(date +%s)
END_TIME=$((START_TIME + DURATION_MIN * 60))
CHECK_COUNT=0
FAIL_COUNT=0
SERVICE_NAME="agent"

echo "╔═══════════════════════════════════════════╗"
echo "║    麒麟安全Agent 稳定性测试                ║"
echo "╚═══════════════════════════════════════════╝"
echo "测试时长: ${DURATION_MIN} 分钟"
echo "检查间隔: ${INTERVAL_SEC} 秒"
echo "Admin地址: ${ADMIN_URL}"
echo "启动时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "预计结束: $(date -d "@${END_TIME}" '+%Y-%m-%d %H:%M:%S')"
echo ""

while [ "$(date +%s)" -lt "$END_TIME" ]; do
    CHECK_COUNT=$((CHECK_COUNT + 1))
    NOW=$(date '+%H:%M:%S')
    ELAPSED=$(( ($(date +%s) - START_TIME) / 60 ))
    ERRORS=""

    # 1. systemd 状态
    SVC_STATUS=$(sudo systemctl is-active "${SERVICE_NAME}" 2>/dev/null || echo "unknown")
    if [ "$SVC_STATUS" != "active" ]; then
        ERRORS="${ERRORS}[service=✗${SVC_STATUS}]"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi

    # 2. curl latest
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "${ADMIN_URL}/api/monitor/latest" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" != "200" ]; then
        ERRORS="${ERRORS}[latest=✗${HTTP_CODE}]"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi

    # 3. curl stats
    HTTP_CODE2=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "${ADMIN_URL}/api/dashboard/stats" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE2" != "200" ]; then
        ERRORS="${ERRORS}[stats=✗${HTTP_CODE2}]"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi

    # 4. 检查 agent.log 最近一条时间戳（agent在 /opt/kylin-agent/agent.log）
    if [ -f /opt/kylin-agent/agent.log ]; then
        LAST_MOD=$(stat -c %Y /opt/kylin-agent/agent.log 2>/dev/null || echo 0)
        NOW_SEC=$(date +%s)
        AGE=$((NOW_SEC - LAST_MOD))
        if [ "$AGE" -gt 120 ]; then
            ERRORS="${ERRORS}[log=${AGE}s前更新]"
            FAIL_COUNT=$((FAIL_COUNT + 1))
        fi
    fi

    if [ -z "$ERRORS" ]; then
        echo "  [${NOW}] 第${ELAPSED}分钟  ✓ service=${SVC_STATUS}  latest=${HTTP_CODE}  stats=${HTTP_CODE2}"
    else
        echo "  [${NOW}] 第${ELAPSED}分钟  ✗ ${ERRORS}"
    fi

    sleep "${INTERVAL_SEC}"
done

echo ""
echo "═══════════════════════════════════════════"
echo "  稳定性测试结束"
echo "═══════════════════════════════════════════"
echo "结束时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "总计检查: ${CHECK_COUNT} 次"
echo "失败次数: ${FAIL_COUNT} 次"

if [ "$FAIL_COUNT" -eq 0 ]; then
    echo "结论: ✅ 稳定性测试通过"
else
    echo "结论: ✗ 存在 ${FAIL_COUNT} 次异常"
fi
