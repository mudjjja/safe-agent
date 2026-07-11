package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"security-ops-agent/internal/model"
	"security-ops-agent/internal/service"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type Handler struct {
	db      *gorm.DB
	ai      *service.AIService
	checker *service.AlertChecker
}

func New(db *gorm.DB, ai *service.AIService, checker *service.AlertChecker) *Handler {
	h := &Handler{db: db, ai: ai, checker: checker}
	h.seedData()
	return h
}

func (h *Handler) seedData() {
	skills := []model.Skill{
		{Name: "查看进程", Description: "列出 CPU 占用最高的 10 个进程", Command: "ps aux --sort=-%cpu | head -11", RiskLevel: "safe", Category: "系统"},
		{Name: "查看磁盘使用", Description: "查看各分区磁盘使用情况", Command: "df -h", RiskLevel: "safe", Category: "系统"},
		{Name: "查看内存使用", Description: "查看内存和 Swap 使用情况", Command: "free -h", RiskLevel: "safe", Category: "系统"},
		{Name: "查看系统负载", Description: "查看系统 1/5/15 分钟平均负载", Command: "uptime", RiskLevel: "safe", Category: "系统"},
		{Name: "查看网络连接", Description: "查看当前 ESTABLISHED 状态的 TCP 连接数", Command: "ss -t state established | wc -l", RiskLevel: "safe", Category: "网络"},
		{Name: "查看监听端口", Description: "列出所有正在监听的 TCP/UDP 端口", Command: "ss -tlnp", RiskLevel: "safe", Category: "网络"},
		{Name: "封禁IP", Description: "使用 iptables 封禁指定 IP", Command: "iptables -A INPUT -s {{IP}} -j DROP", RiskLevel: "high", Params: `["IP"]`, Category: "安全"},
		{Name: "解封IP", Description: "解除 iptables 对指定 IP 的封禁", Command: "iptables -D INPUT -s {{IP}} -j DROP", RiskLevel: "high", Params: `["IP"]`, Category: "安全"},
		{Name: "重启服务", Description: "重启指定的 systemd 服务", Command: "systemctl restart {{ServiceName}}", RiskLevel: "high", Params: `["ServiceName"]`, Category: "系统"},
		{Name: "查看最近登录", Description: "查看最近 20 条系统登录记录", Command: "last -20", RiskLevel: "safe", Category: "安全"},
		{Name: "查看SSH失败", Description: "查看 SSH 登录失败的记录", Command: "grep 'Failed password' /var/log/auth.log 2>/dev/null | tail -20 || journalctl -u sshd --no-pager -n 20 2>/dev/null | grep -i failed", RiskLevel: "safe", Category: "安全"},
		{Name: "清理旧日志", Description: "删除指定目录下 7 天前的 .log 文件", Command: "find {{Path}} -name '*.log' -mtime +7 -delete", RiskLevel: "dangerous", Params: `["Path"]`, Category: "系统"},
	}
	for _, s := range skills {
		h.db.Where("name = ?", s.Name).FirstOrCreate(&s)
	}
}

// ==================== 登录 ====================

func (h *Handler) Login(c *gin.Context) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"code": -1, "message": "参数错误"})
		return
	}
	if req.Username == "admin" && req.Password == "admin123" {
		c.JSON(200, gin.H{"code": 0, "data": gin.H{"token": "mock-jwt-token-admin-2024"}})
		return
	}
	c.JSON(401, gin.H{"code": -1, "message": "用户名或密码错误"})
}

// ==================== 监控数据 ====================

func (h *Handler) PushMetrics(c *gin.Context) {
	rawBody, _ := c.GetRawData()
	fmt.Printf("收到推送, body: %s\n", string(rawBody))

	c.Request.Body = io.NopCloser(strings.NewReader(string(rawBody)))

	var req struct {
		AgentID string        `json:"agent_id"`
		Metric  *model.Metric `json:"metric"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		fmt.Printf("JSON解析失败: %v\n", err)
		c.JSON(400, gin.H{"code": -1, "message": err.Error()})
		return
	}

	if req.Metric != nil {
		req.Metric.AgentID = req.AgentID
		req.Metric.CreatedAt = time.Now()
		h.db.Create(req.Metric)
		fmt.Printf("指标入库成功: CPU:%.1f%% MEM:%.1f%%\n", req.Metric.CPUPercent, req.Metric.MemPercent)
	}
	c.JSON(200, gin.H{"code": 0, "message": "ok"})
}

func (h *Handler) GetLatestMetrics(c *gin.Context) {
	agentID := c.Query("agent_id")

	var metrics []model.Metric
	query := h.db.Order("created_at DESC").Limit(10)
	if agentID != "" {
		query = query.Where("agent_id = ?", agentID)
	}
	query.Find(&metrics)

	result := make(map[string]interface{})
	if len(metrics) > 0 {
		result["cpu_percent"] = metrics[0].CPUPercent
		result["mem_percent"] = metrics[0].MemPercent
		result["disk_percent"] = metrics[0].DiskPercent
		result["load_1m"] = metrics[0].Load1m
		result["net_rx_bytes"] = metrics[0].NetRxBytes
		result["net_tx_bytes"] = metrics[0].NetTxBytes
		result["tcp_connections"] = metrics[0].TCPConnections
		result["updated_at"] = metrics[0].CreatedAt
	}
	c.JSON(200, gin.H{"code": 0, "data": result})
}

func (h *Handler) GetMetricHistory(c *gin.Context) {
	agentID := c.Query("agent_id")
	minutes, _ := strconv.Atoi(c.DefaultQuery("minutes", "60"))

	var metrics []model.Metric
	h.db.Where("agent_id = ? AND created_at > ?", agentID, time.Now().Add(-time.Duration(minutes)*time.Minute)).
		Order("created_at ASC").Find(&metrics)
	c.JSON(200, gin.H{"code": 0, "data": metrics})
}

// ==================== 告警 ====================

func (h *Handler) ListAlerts(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	severity := c.Query("severity")

	var total int64
	var alerts []model.Alert
	query := h.db.Model(&model.Alert{})
	if severity != "" {
		query = query.Where("severity = ?", severity)
	}
	query.Count(&total)
	query.Order("created_at DESC").Offset((page - 1) * size).Limit(size).Find(&alerts)
	c.JSON(200, gin.H{"code": 0, "data": gin.H{"total": total, "list": alerts}})
}

func (h *Handler) ResolveAlert(c *gin.Context) {
	id := c.Param("id")
	now := time.Now()
	h.db.Model(&model.Alert{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status": "resolved", "resolved_at": now,
	})
	c.JSON(200, gin.H{"code": 0, "message": "ok"})
}

// ==================== Agent ====================

func (h *Handler) Heartbeat(c *gin.Context) {
	var req struct {
		AgentID  string `json:"agent_id"`
		Hostname string `json:"hostname"`
	}
	c.ShouldBindJSON(&req)
	c.JSON(200, gin.H{"code": 0, "message": "ok", "server_time": time.Now()})
}

func (h *Handler) PullTasks(c *gin.Context) {
	agentID := c.Query("agent_id")
	var tasks []model.AgentTask
	h.db.Where("agent_id = ? AND status = 'pending'", agentID).Order("created_at ASC").Find(&tasks)

	for _, t := range tasks {
		now := time.Now()
		h.db.Model(&t).Updates(map[string]interface{}{"status": "running", "started_at": now})
	}
	c.JSON(200, gin.H{"code": 0, "data": tasks})
}

func (h *Handler) ReportTaskResult(c *gin.Context) {
	var req struct {
		TaskID     uint   `json:"task_id"`
		Stdout     string `json:"stdout"`
		Stderr     string `json:"stderr"`
		ExitCode   int    `json:"exit_code"`
		DurationMs int64  `json:"duration_ms"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"code": -1, "message": "参数错误"})
		return
	}

	h.db.Model(&model.AgentTask{}).Where("id = ?", req.TaskID).Updates(map[string]interface{}{
		"status":      map[bool]string{true: "success", false: "failed"}[req.ExitCode == 0],
		"stdout":      req.Stdout,
		"stderr":      req.Stderr,
		"exit_code":   req.ExitCode,
		"duration_ms": req.DurationMs,
	})

	var task model.AgentTask
	h.db.First(&task, req.TaskID)
	h.db.Model(&model.SkillExecution{}).Where("id = ?", task.ExecutionID).Updates(map[string]interface{}{
		"status":      map[bool]string{true: "success", false: "failed"}[req.ExitCode == 0],
		"stdout":      req.Stdout,
		"stderr":      req.Stderr,
		"exit_code":   req.ExitCode,
		"duration_ms": req.DurationMs,
	})

	c.JSON(200, gin.H{"code": 0, "message": "ok"})
}

// ==================== Skills ====================

func (h *Handler) ListSkills(c *gin.Context) {
	category := c.Query("category")
	var skills []model.Skill
	query := h.db.Model(&model.Skill{})
	if category != "" {
		query = query.Where("category = ?", category)
	}
	query.Find(&skills)
	c.JSON(200, gin.H{"code": 0, "data": skills})
}

func (h *Handler) ExecuteSkill(c *gin.Context) {
	var req struct {
		SkillName string            `json:"skill_name"`
		AgentID   string            `json:"agent_id"`
		Params    map[string]string `json:"params"`
		Reason    string            `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"code": -1, "message": "参数错误"})
		return
	}

	var skill model.Skill
	if err := h.db.Where("name = ?", req.SkillName).First(&skill).Error; err != nil {
		c.JSON(404, gin.H{"code": -1, "message": "技能不存在"})
		return
	}

	if (skill.RiskLevel == "high" || skill.RiskLevel == "dangerous") && req.Reason == "" {
		c.JSON(400, gin.H{"code": -1, "message": "高危技能执行需填写操作理由"})
		return
	}

	cmd := skill.Command
	for k, v := range req.Params {
		cmd = replaceVar(cmd, k, v)
	}

	execution := model.SkillExecution{
		AgentID:   req.AgentID,
		SkillID:   skill.ID,
		SkillName: skill.Name,
		Command:   cmd,
		Params:    fmt.Sprintf("%v", req.Params),
		Status:    "pending",
		CreatedAt: time.Now(),
	}
	h.db.Create(&execution)

	task := model.AgentTask{
		AgentID:     req.AgentID,
		ExecutionID: execution.ID,
		Command:     cmd,
		Status:      "pending",
		CreatedAt:   time.Now(),
	}
	h.db.Create(&task)

	c.JSON(200, gin.H{"code": 0, "data": gin.H{
		"execution_id": execution.ID,
		"task_id":      task.ID,
		"command":      cmd,
		"message":      "任务已下发，等待 Agent 执行",
	}})
}

func (h *Handler) SkillHistory(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))

	var total int64
	var records []model.SkillExecution
	h.db.Model(&model.SkillExecution{}).Count(&total)
	h.db.Order("created_at DESC").Offset((page - 1) * size).Limit(size).Find(&records)
	c.JSON(200, gin.H{"code": 0, "data": gin.H{"total": total, "list": records}})
}

// ==================== AI 对话 ====================

func (h *Handler) Chat(c *gin.Context) {
	var req struct {
		Message string `json:"message"`
		History []struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"history"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"code": -1, "message": "参数错误"})
		return
	}

	systemMsg := service.ChatMessage{
		Role: "system",
		Content: `你是麒麟 Linux 安全运维 AI 助手。你可以：
1. 分析系统指标、检测安全威胁
2. 解释告警原因、给出修复建议
3. 推荐执行合适的运维技能（Skills）

当前可用的 Skills：
- 查看进程 / 查看磁盘使用 / 查看内存使用 / 查看系统负载
- 查看网络连接 / 查看监听端口
- 封禁IP / 解封IP / 重启服务
- 查看最近登录 / 查看SSH失败

当用户要求执行操作时，建议他们使用 Skills 执行页面。你专注于分析和建议。`,
	}

	history := []service.ChatMessage{systemMsg}
	for _, h := range req.History {
		history = append(history, service.ChatMessage{Role: h.Role, Content: h.Content})
	}
	history = append(history, service.ChatMessage{Role: "user", Content: req.Message})

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		c.JSON(500, gin.H{"code": -1, "message": "不支持 SSE"})
		return
	}

	fullContent, err := h.ai.StreamChat(history, func(delta string) {
		data, _ := json.Marshal(gin.H{"delta": delta})
		fmt.Fprintf(c.Writer, "data: %s\n\n", data)
		flusher.Flush()
	})
	if err != nil {
		data, _ := json.Marshal(gin.H{"error": err.Error()})
		fmt.Fprintf(c.Writer, "data: %s\n\n", data)
		flusher.Flush()
	}
	fmt.Fprintf(c.Writer, "data: [DONE]\n\n")
	flusher.Flush()

	_ = fullContent
}

// ==================== Dashboard ====================

func (h *Handler) DashboardStats(c *gin.Context) {
	var totalMetrics, totalAlerts, openAlerts, todayMetrics int64
	h.db.Model(&model.Metric{}).Count(&totalMetrics)
	h.db.Model(&model.Alert{}).Count(&totalAlerts)
	h.db.Model(&model.Alert{}).Where("status = 'open'").Count(&openAlerts)
	h.db.Model(&model.Metric{}).Where("created_at > ?", time.Now().Truncate(24*time.Hour)).Count(&todayMetrics)

	c.JSON(200, gin.H{"code": 0, "data": gin.H{
		"total_metrics": totalMetrics,
		"total_alerts":  totalAlerts,
		"open_alerts":   openAlerts,
		"today_metrics": todayMetrics,
	}})
}

// ==================== Agent 列表 ====================

type AgentRow struct {
	AgentID  string `json:"agent_id"`
	LastSeen string `json:"last_seen"`
}

func (h *Handler) ListAgents(c *gin.Context) {
	var rows []AgentRow
	h.db.Model(&model.Metric{}).
		Select("agent_id, MAX(created_at) AS last_seen").
		Group("agent_id").
		Order("last_seen DESC").
		Scan(&rows)

	type AgentInfo struct {
		AgentID  string    `json:"agent_id"`
		LastSeen time.Time `json:"last_seen"`
		Online   bool      `json:"online"`
	}
	agents := make([]AgentInfo, 0, len(rows))
	for _, r := range rows {
		t, err := time.Parse("2006-01-02 15:04:05.999999999-07:00", r.LastSeen)
		if err != nil {
			t, _ = time.Parse("2006-01-02T15:04:05.999999999-07:00", r.LastSeen)
		}
		agents = append(agents, AgentInfo{
			AgentID:  r.AgentID,
			LastSeen: t,
			Online:   time.Since(t) < 2*time.Minute,
		})
	}
	c.JSON(200, gin.H{"code": 0, "data": agents})
}

// ==================== 日志管理 ====================

func (h *Handler) LogsPush(c *gin.Context) {
	var req struct {
		AgentID string   `json:"agent_id"`
		Store   string   `json:"store"`
		Lines   []string `json:"lines"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"code": -1, "message": "参数错误"})
		return
	}

	var store model.LogStore
	h.db.Where("name = ?", req.Store).FirstOrCreate(&store, model.LogStore{
		Name: req.Store,
		Type: "系统",
	})

	for _, line := range req.Lines {
		h.db.Create(&model.LogEntry{
			AgentID:   req.AgentID,
			Store:     req.Store,
			Content:   line,
			Level:     detectLevel(line),
			CreatedAt: time.Now(),
		})
	}

	var count int64
	h.db.Model(&model.LogEntry{}).Where("store = ?", req.Store).Count(&count)
	h.db.Model(&store).Update("log_count", count)

	c.JSON(200, gin.H{"code": 0, "message": "ok"})
}

func (h *Handler) ListLogStores(c *gin.Context) {
	var stores []model.LogStore
	h.db.Order("created_at DESC").Find(&stores)
	c.JSON(200, gin.H{"code": 0, "data": stores})
}

func (h *Handler) ListLogs(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	store := c.Query("store")
	keyword := c.Query("keyword")
	level := c.Query("level")

	var total int64
	var entries []model.LogEntry
	query := h.db.Model(&model.LogEntry{})
	if store != "" {
		query = query.Where("store = ?", store)
	}
	if keyword != "" {
		query = query.Where("content LIKE ?", "%"+keyword+"%")
	}
	if level != "" {
		query = query.Where("level = ?", level)
	}
	query.Count(&total)
	query.Order("created_at DESC").Offset((page - 1) * size).Limit(size).Find(&entries)
	c.JSON(200, gin.H{"code": 0, "data": gin.H{"total": total, "list": entries}})
}

// ==================== 单条告警 ====================

func (h *Handler) GetAlert(c *gin.Context) {
	id := c.Param("id")
	var alert model.Alert
	if err := h.db.First(&alert, id).Error; err != nil {
		c.JSON(404, gin.H{"code": -1, "message": "告警不存在"})
		return
	}
	c.JSON(200, gin.H{"code": 0, "data": alert})
}

// ==================== 按 ID 查任务结果 ====================

func (h *Handler) GetSkillTask(c *gin.Context) {
	id := c.Param("id")
	var exec model.SkillExecution
	if err := h.db.First(&exec, id).Error; err != nil {
		c.JSON(404, gin.H{"code": -1, "message": "任务不存在"})
		return
	}
	c.JSON(200, gin.H{"code": 0, "data": exec})
}

// ==================== 备份管理 ====================

func (h *Handler) ListBackups(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	agentID := c.Query("agent_id")
	status := c.Query("status")

	var total int64
	var backups []model.Backup
	query := h.db.Model(&model.Backup{})
	if agentID != "" {
		query = query.Where("agent_id = ?", agentID)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	query.Count(&total)
	query.Order("created_at DESC").Offset((page - 1) * size).Limit(size).Find(&backups)
	c.JSON(200, gin.H{"code": 0, "data": gin.H{"total": total, "list": backups}})
}


func (h *Handler) CreateBackup(c *gin.Context) {
	var req struct {
		AgentID  string `json:"agent_id"`
		Name     string `json:"name"`
		Type     string `json:"type"`
		FilePath string `json:"file_path"`
		Size     int64  `json:"size"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"code": -1, "message": "参数错误"})
		return
	}
	if req.AgentID == "" || req.Name == "" {
		c.JSON(400, gin.H{"code": -1, "message": "agent_id 和 name 不能为空"})
		return
	}
	backupType := req.Type
	if backupType == "" {
		backupType = "full"
	}
	b := model.Backup{
		AgentID:   req.AgentID,
		Name:      req.Name,
		Type:      backupType,
		FilePath:  req.FilePath,
		Size:      req.Size,
		Status:    "success",
		CreatedAt: time.Now(),
	}
	h.db.Create(&b)
	c.JSON(200, gin.H{"code": 0, "data": b, "message": "备份记录已创建"})
}

func (h *Handler) DeleteBackup(c *gin.Context) {
	id := c.Param("id")
	result := h.db.Delete(&model.Backup{}, id)
	if result.RowsAffected == 0 {
		c.JSON(404, gin.H{"code": -1, "message": "备份记录不存在"})
		return
	}
	c.JSON(200, gin.H{"code": 0, "message": "已删除"})
}

// ==================== 系统用户管理 ====================

func (h *Handler) ListUsers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	role := c.Query("role")
	status := c.Query("status")

	var total int64
	var users []model.SysUser
	query := h.db.Model(&model.SysUser{})
	if role != "" {
		query = query.Where("role = ?", role)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	query.Count(&total)
	query.Order("created_at DESC").Offset((page - 1) * size).Limit(size).Find(&users)
	c.JSON(200, gin.H{"code": 0, "data": gin.H{"total": total, "list": users}})
}

func (h *Handler) CreateUser(c *gin.Context) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
		Role     string `json:"role"`
		Email    string `json:"email"`
		Phone    string `json:"phone"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"code": -1, "message": "参数错误"})
		return
	}
	if req.Username == "" || req.Password == "" {
		c.JSON(400, gin.H{"code": -1, "message": "用户名和密码不能为空"})
		return
	}
	userRole := req.Role
	if userRole == "" {
		userRole = "user"
	}
	u := model.SysUser{
		Username:  req.Username,
		Password:  req.Password,
		Role:      userRole,
		Email:     req.Email,
		Phone:     req.Phone,
		Status:    "active",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	h.db.Create(&u)
	h.logOperate(0, req.Username, "create", "user", fmt.Sprintf("%d", u.ID), "创建用户: "+req.Username)
	c.JSON(200, gin.H{"code": 0, "data": u, "message": "用户已创建"})
}

func (h *Handler) UpdateUser(c *gin.Context) {
	id := c.Param("id")
	var user model.SysUser
	if err := h.db.First(&user, id).Error; err != nil {
		c.JSON(404, gin.H{"code": -1, "message": "用户不存在"})
		return
	}
	var req struct {
		Password string `json:"password"`
		Role     string `json:"role"`
		Email    string `json:"email"`
		Phone    string `json:"phone"`
		Status   string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"code": -1, "message": "参数错误"})
		return
	}
	updates := map[string]interface{}{"updated_at": time.Now()}
	if req.Password != "" {
		updates["password"] = req.Password
	}
	if req.Role != "" {
		updates["role"] = req.Role
	}
	if req.Email != "" {
		updates["email"] = req.Email
	}
	if req.Phone != "" {
		updates["phone"] = req.Phone
	}
	if req.Status != "" {
		updates["status"] = req.Status
	}
	h.db.Model(&user).Updates(updates)
	h.logOperate(0, user.Username, "update", "user", id, "更新用户: "+user.Username)
	c.JSON(200, gin.H{"code": 0, "message": "用户已更新"})
}

func (h *Handler) DeleteUser(c *gin.Context) {
	id := c.Param("id")
	var user model.SysUser
	if err := h.db.First(&user, id).Error; err != nil {
		c.JSON(404, gin.H{"code": -1, "message": "用户不存在"})
		return
	}
	h.db.Delete(&user)
	h.logOperate(0, user.Username, "delete", "user", id, "删除用户: "+user.Username)
	c.JSON(200, gin.H{"code": 0, "message": "已删除"})
}

// ==================== 操作日志 ====================

func (h *Handler) ListOperateLogs(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("size", "20"))
	action := c.Query("action")
	username := c.Query("username")

	var total int64
	var logs []model.OperateLog
	query := h.db.Model(&model.OperateLog{})
	if action != "" {
		query = query.Where("action = ?", action)
	}
	if username != "" {
		query = query.Where("username = ?", username)
	}
	query.Count(&total)
	query.Order("created_at DESC").Offset((page - 1) * size).Limit(size).Find(&logs)
	c.JSON(200, gin.H{"code": 0, "data": gin.H{"total": total, "list": logs}})
}

// ==================== 数据分析统计 ====================

func (h *Handler) AnalysisTrend(c *gin.Context) {
	days, _ := strconv.Atoi(c.DefaultQuery("days", "7"))
	store := c.Query("store")

	type DailyCount struct {
		Date  string `json:"date"`
		Count int64  `json:"count"`
	}
	var logTrend []DailyCount
	logQuery := h.db.Model(&model.LogEntry{}).
		Select("DATE(created_at) AS date, COUNT(*) AS count").
		Where("created_at > ?", time.Now().AddDate(0, 0, -days)).
		Group("DATE(created_at)").
		Order("date ASC")
	if store != "" {
		logQuery = logQuery.Where("store = ?", store)
	}
	logQuery.Scan(&logTrend)

	type SeverityCount struct {
		Severity string `json:"severity"`
		Count    int64  `json:"count"`
	}
	var alertStats []SeverityCount
	h.db.Model(&model.Alert{}).
		Select("severity, COUNT(*) AS count").
		Group("severity").
		Scan(&alertStats)

	type StatusCount struct {
		Status string `json:"status"`
		Count  int64  `json:"count"`
	}
	var alertStatus []StatusCount
	h.db.Model(&model.Alert{}).
		Select("status, COUNT(*) AS count").
		Group("status").
		Scan(&alertStatus)

	var agentMetrics int64
	h.db.Model(&model.Metric{}).Where("created_at > ?", time.Now().AddDate(0, 0, -1)).Count(&agentMetrics)

	c.JSON(200, gin.H{"code": 0, "data": gin.H{
		"log_trend":     logTrend,
		"alert_stats":   alertStats,
		"alert_status":  alertStatus,
		"agent_metrics": agentMetrics,
	}})
}

// ==================== 内部辅助方法 ====================

func (h *Handler) logOperate(userID uint, username, action, target, targetID, detail string) {
	h.db.Create(&model.OperateLog{
		UserID:    userID,
		Username:  username,
		Action:    action,
		Target:    target,
		TargetID:  targetID,
		Detail:    detail,
		Status:    "success",
		CreatedAt: time.Now(),
	})
}

func detectLevel(line string) string {
	upper := strings.ToUpper(line)
	if strings.Contains(upper, "ERROR") || strings.Contains(upper, "FAIL") || strings.Contains(upper, "CRIT") {
		return "ERROR"
	}
	if strings.Contains(upper, "WARN") {
		return "WARN"
	}
	return "INFO"
}

func replaceVar(s, key, val string) string {
	return strings.ReplaceAll(s, "{{"+key+"}}", val)
}
