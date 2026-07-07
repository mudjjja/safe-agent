package main

import (
	"log"
	"security-ops-agent/config"
	"security-ops-agent/internal/handler"
	"security-ops-agent/internal/model"
	"security-ops-agent/internal/service"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func main() {
	cfg := config.Load()

	db, err := gorm.Open(sqlite.Open(cfg.DBPath), &gorm.Config{})
	if err != nil {
		log.Fatal("数据库连接失败:", err)
	}
	db.AutoMigrate(&model.Metric{}, &model.Alert{}, &model.Skill{}, &model.SkillExecution{}, &model.AgentTask{})

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
	r.PUT("/api/alerts/:id/resolve", h.ResolveAlert)
	r.POST("/api/agent/heartbeat", h.Heartbeat)
	r.GET("/api/agent/tasks", h.PullTasks)
	r.POST("/api/agent/task-result", h.ReportTaskResult)
	r.GET("/api/skills", h.ListSkills)
	r.POST("/api/skills/execute", h.ExecuteSkill)
	r.GET("/api/skills/history", h.SkillHistory)
	r.POST("/api/ai/chat", h.Chat)
	r.GET("/api/dashboard/stats", h.DashboardStats)

	log.Println("admin 启动在", cfg.ListenAddr)
	r.Run(cfg.ListenAddr)
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
