package service

import (
	"fmt"
	"security-ops-agent/internal/model"
	"time"

	"gorm.io/gorm"
)

type AlertChecker struct {
	db *gorm.DB
	ai *AIService
}

func NewAlertChecker(db *gorm.DB, ai *AIService) *AlertChecker {
	return &AlertChecker{db: db, ai: ai}
}

// Run 后台定时检测异常指标并生成告警
func (c *AlertChecker) Run(interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for range ticker.C {
			c.check()
		}
	}()
}

func (c *AlertChecker) check() {
	c.checkMetrics()
	c.checkSSHBruteForce()
}

func (c *AlertChecker) checkMetrics() {
	// 查每个 Agent 最近 2 分钟的最新指标
	var latest []model.Metric
	c.db.Raw(`
		SELECT * FROM metrics
		WHERE id IN (
			SELECT MAX(id) FROM metrics
			WHERE created_at > ?
			GROUP BY agent_id
		)
	`, time.Now().Add(-2*time.Minute)).Scan(&latest)

	for _, m := range latest {
		var triggers []string

		if m.CPUPercent > 90 {
			triggers = append(triggers, fmt.Sprintf("CPU 使用率异常: %.1f%%", m.CPUPercent))
		}
		if m.MemPercent > 95 {
			triggers = append(triggers, fmt.Sprintf("内存使用率异常: %.1f%%", m.MemPercent))
		}
		if m.DiskPercent > 90 {
			triggers = append(triggers, fmt.Sprintf("磁盘使用率异常: %.1f%%", m.DiskPercent))
		}
		if m.Load1m > float64(8) {
			triggers = append(triggers, fmt.Sprintf("系统负载过高: %.2f", m.Load1m))
		}

		if len(triggers) == 0 {
			continue
		}

		// 检查 5 分钟内是否已告警过（防重复）
		var existing model.Alert
		if err := c.db.Where("agent_id = ? AND status = 'open' AND created_at > ?",
			m.AgentID, time.Now().Add(-5*time.Minute)).First(&existing).Error; err == nil {
			continue
		}

		reason := joinStrings(triggers, "; ")
		metricsStr := fmt.Sprintf("CPU:%.1f%% 内存:%.1f%% 磁盘:%.1f%% 负载:%.2f",
			m.CPUPercent, m.MemPercent, m.DiskPercent, m.Load1m)

		severity := "medium"
		if m.CPUPercent > 95 || m.MemPercent > 98 {
			severity = "critical"
		} else if m.CPUPercent > 90 || m.MemPercent > 95 {
			severity = "high"
		}

		summary, rootCause, suggestion, err := c.ai.AnalyzeAlert(reason, metricsStr)

		alert := model.Alert{
			AgentID:       m.AgentID,
			Title:         reason,
			Severity:      severity,
			TriggerReason: reason,
		}

		if err == nil {
			alert.Summary = summary
			alert.RootCause = rootCause
			alert.Suggestion = suggestion
		}

		c.db.Create(&alert)
	}
}

func (c *AlertChecker) checkSSHBruteForce() {
	// 查询最近 2 分钟内每个 agent 的 SSH 失败次数
	type SSHCount struct {
		AgentID string
		Count   int64
	}
	var counts []SSHCount
	c.db.Raw(`
		SELECT agent_id, COUNT(*) AS count FROM log_entries
		WHERE created_at > ? AND (content LIKE '%Failed password%' OR content LIKE '%Failed password for%')
		GROUP BY agent_id
	`, time.Now().Add(-2*time.Minute)).Scan(&counts)

	for _, c2 := range counts {
		if c2.Count < 15 {
			continue
		}

		// 防重复
		var existing model.Alert
		if err := c.db.Where("agent_id = ? AND status = 'open' AND trigger_reason LIKE '%SSH%' AND created_at > ?",
			c2.AgentID, time.Now().Add(-5*time.Minute)).First(&existing).Error; err == nil {
			continue
		}

		reason := fmt.Sprintf("SSH暴力破解嫌疑: %d次失败登录/2分钟", c2.Count)
		metricsStr := fmt.Sprintf("SSH失败登录次数: %d (2分钟内)", c2.Count)
		summary, rootCause, suggestion, err := c.ai.AnalyzeAlert(reason, metricsStr)

		alert := model.Alert{
			AgentID:       c2.AgentID,
			Title:         reason,
			Severity:      "high",
			TriggerReason: reason,
		}
		if err == nil {
			alert.Summary = summary
			alert.RootCause = rootCause
			alert.Suggestion = suggestion
		}
		c.db.Create(&alert)
	}
}

func joinStrings(ss []string, sep string) string {
	result := ""
	for i, s := range ss {
		if i > 0 {
			result += sep
		}
		result += s
	}
	return result
}
