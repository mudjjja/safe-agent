package model

import "time"

// Metric 主机监控指标
type Metric struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	AgentID        string    `gorm:"index;not null" json:"agent_id"`
	CPUPercent     float64   `json:"cpu_percent"`
	MemPercent     float64   `json:"mem_percent"`
	DiskPercent    float64   `json:"disk_percent"`
	Load1m         float64   `json:"load_1m"`
	Load5m         float64   `json:"load_5m"`
	Load15m        float64   `json:"load_15m"`
	NetRxBytes     int64     `json:"net_rx_bytes"`
	NetTxBytes     int64     `json:"net_tx_bytes"`
	TCPConnections int64     `json:"tcp_connections"`
	CreatedAt      time.Time `gorm:"index" json:"created_at"`
}

// Alert 告警记录
type Alert struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	AgentID         string    `gorm:"index" json:"agent_id"`
	Title           string    `json:"title"`
	Severity        string    `gorm:"default:medium" json:"severity"` // low/medium/high/critical
	Status          string    `gorm:"default:open" json:"status"`     // open/resolved
	TriggerReason   string    `json:"trigger_reason"`                 // 触发原因（规则描述）
	Summary         string    `json:"summary"`                        // AI 异常摘要
	RootCause       string    `json:"root_cause"`                     // AI 根因分析
	Suggestion      string    `json:"suggestion"`                     // AI 修复建议
	RelatedSkillID  *uint     `json:"related_skill_id"`               // 推荐的处置 Skill
	CreatedAt       time.Time `gorm:"index" json:"created_at"`
	ResolvedAt      *time.Time `json:"resolved_at,omitempty"`
}

// Skill 运维技能定义
type Skill struct {
	ID          uint   `gorm:"primaryKey" json:"id"`
	Name        string `gorm:"uniqueIndex;not null" json:"name"`
	Description string `json:"description"`
	Command     string `gorm:"not null" json:"command"`
	RiskLevel   string `gorm:"default:safe" json:"risk_level"` // safe/medium/high/dangerous
	Params      string `json:"params"`                         // JSON 数组: ["IP","Port"]
	Category    string `gorm:"default:系统" json:"category"`       // 系统/网络/安全/自定义
}

// SkillExecution 技能执行记录
type SkillExecution struct {
	ID         uint       `gorm:"primaryKey" json:"id"`
	AgentID    string     `gorm:"index" json:"agent_id"`
	SkillID    uint       `json:"skill_id"`
	SkillName  string     `json:"skill_name"`
	Command    string     `json:"command"`
	Params     string     `json:"params"`
	Status     string     `gorm:"default:pending" json:"status"` // pending/running/success/failed
	Stdout     string     `json:"stdout"`
	Stderr     string     `json:"stderr"`
	ExitCode   int        `json:"exit_code"`
	DurationMs int64      `json:"duration_ms"`
	StartedAt  *time.Time `json:"started_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
}

// AgentTask Agent 待执行任务
type AgentTask struct {
	ID         uint       `gorm:"primaryKey" json:"id"`
	AgentID    string     `gorm:"index;not null" json:"agent_id"`
	ExecutionID uint      `gorm:"index" json:"execution_id"`
	Command    string     `gorm:"not null" json:"command"`
	Status     string     `gorm:"default:pending" json:"status"` // pending/running/success/failed
	Stdout     string     `json:"stdout"`
	Stderr     string     `json:"stderr"`
	ExitCode   int        `json:"exit_code"`
	DurationMs int64      `json:"duration_ms"`
	CreatedAt  time.Time  `json:"created_at"`
	StartedAt  *time.Time `json:"started_at,omitempty"`
}

// LogStore 日志库
type LogStore struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"uniqueIndex;not null" json:"name"`
	Type      string    `json:"type"`   // 系统日志/Nginx/应用日志/安全日志
	LogCount  int64     `json:"log_count"`
	CreatedAt time.Time `json:"created_at"`
}

// LogEntry 日志条目
type LogEntry struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	AgentID   string    `gorm:"index" json:"agent_id"`
	Store     string    `gorm:"index" json:"store"`
	Content   string    `json:"content"`
	Level     string    `gorm:"default:INFO" json:"level"`
	CreatedAt time.Time `gorm:"index" json:"created_at"`
}
