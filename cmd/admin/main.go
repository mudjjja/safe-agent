package main

import (
	"log"
	"security-ops-agent/config"
	"security-ops-agent/internal/handler"
	"security-ops-agent/internal/model"
	"security-ops-agent/internal/service"
	"time"

	"net/http"
	"os"
	"path/filepath"

	_ "github.com/ncruces/go-sqlite3/embed"
	"github.com/ncruces/go-sqlite3/gormlite"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func main() {
	cfg := config.Load()

	db, err := gorm.Open(gormlite.Open(cfg.DBPath), &gorm.Config{})
	if err != nil {
		log.Fatal("数据库连接失败:", err)
	}
	db.AutoMigrate(&model.Metric{}, &model.Alert{}, &model.Skill{}, &model.SkillExecution{}, &model.AgentTask{}, &model.LogStore{}, &model.LogEntry{}, &model.Backup{}, &model.SysUser{}, &model.OperateLog{})

	aiSvc := service.NewAIService(cfg)
	checker := service.NewAlertChecker(db, aiSvc)
	go checker.Run(30 * time.Second)

	h := handler.New(db, aiSvc, checker)

	r := gin.Default()
	r.Use(cors())

	r.POST("/api/login", h.Login)
	r.GET("/api/monitor/latest", h.GetLatestMetrics)
	r.GET("/api/monitor/history", h.GetMetricHistory)
	r.POST("/api/monitor/push", h.PushMetrics)
	r.GET("/api/alerts", h.ListAlerts)
	r.GET("/api/alerts/:id", h.GetAlert)
	r.PUT("/api/alerts/:id/resolve", h.ResolveAlert)
	r.POST("/api/agent/heartbeat", h.Heartbeat)
	r.GET("/api/agent/tasks", h.PullTasks)
	r.POST("/api/agent/task-result", h.ReportTaskResult)
	r.GET("/api/agent/list", h.ListAgents)
	r.GET("/api/skills", h.ListSkills)
	r.POST("/api/skills/execute", h.ExecuteSkill)
	r.GET("/api/skills/history", h.SkillHistory)
	r.GET("/api/skills/task/:id", h.GetSkillTask)
	r.POST("/api/ai/chat", h.Chat)
	r.GET("/api/dashboard/stats", h.DashboardStats)
		r.POST("/api/logs/push", h.LogsPush)
		r.GET("/api/log-stores", h.ListLogStores)
		r.GET("/api/logs", h.ListLogs)
	r.GET("/api/backups", h.ListBackups)
	r.POST("/api/backups", h.CreateBackup)
	r.DELETE("/api/backups/:id", h.DeleteBackup)
	r.GET("/api/users", h.ListUsers)
	r.POST("/api/users", h.CreateUser)
	r.PUT("/api/users/:id", h.UpdateUser)
	r.DELETE("/api/users/:id", h.DeleteUser)
	r.GET("/api/operate-logs", h.ListOperateLogs)
	r.GET("/api/analysis/trend", h.AnalysisTrend)

	// 托管前端构建产物
	serveStatic(r)

	log.Println("admin 启动在", cfg.ListenAddr)
	r.Run(cfg.ListenAddr)
}

func serveStatic(r *gin.Engine) {
	exe, _ := os.Executable()
	base := filepath.Join(filepath.Dir(exe), "..", "frontend", "dist")
	r.StaticFS("/assets", http.Dir(filepath.Join(base, "assets")))
	r.NoRoute(func(c *gin.Context) {
		if len(c.Request.URL.Path) >= 4 && c.Request.URL.Path[:4] == "/api" {
			c.JSON(404, gin.H{"code": -1, "message": "not found"})
			return
		}
		c.File(filepath.Join(base, "index.html"))
	})
}

func cors() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		c.Header("Access-Control-Allow-Headers", "*")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}
