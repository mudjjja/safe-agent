package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"
)

type Metric struct {
	CPUPercent     float64 `json:"cpu_percent"`
	MemPercent     float64 `json:"mem_percent"`
	DiskPercent    float64 `json:"disk_percent"`
	Load1m         float64 `json:"load_1m"`
	Load5m         float64 `json:"load_5m"`
	Load15m        float64 `json:"load_15m"`
	NetRxBytes     int64   `json:"net_rx_bytes"`
	NetTxBytes     int64   `json:"net_tx_bytes"`
	TCPConnections int64   `json:"tcp_connections"`
}

type Config struct {
	AgentID       string
	AdminURL      string
	FlushInterval time.Duration
}

// 危险命令黑名单
var dangerousCmds = []string{"rm -rf", "dd if=", "mkfs", "reboot", "shutdown", "poweroff", "halt", ":(){", "chmod 777 /"}

func main() {
	cfg := Config{
		AgentID:       getEnv("AGENT_ID", "agent-001"),
		AdminURL:      getEnv("ADMIN_URL", "http://127.0.0.1:8080"),
		FlushInterval: 10 * time.Second,
	}

	fmt.Printf("=== LCA Agent 启动 ===\n")
	fmt.Printf("Agent ID : %s\n", cfg.AgentID)
	fmt.Printf("Admin    : %s\n", cfg.AdminURL)
	fmt.Printf("推送间隔 : %v\n", cfg.FlushInterval)
	fmt.Println("======================")

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)

	ticker := time.NewTicker(cfg.FlushInterval)
	defer ticker.Stop()

	heartbeatTicker := time.NewTicker(30 * time.Second)
	defer heartbeatTicker.Stop()

	go heartbeat(cfg)
	collectAndPush(cfg)

	for {
		select {
		case <-ticker.C:
			collectAndPush(cfg)
		case <-heartbeatTicker.C:
			go heartbeat(cfg)
			go checkTasks(cfg)
		case <-sig:
			fmt.Println("\nAgent 安全退出")
			return
		}
	}
}

func collectAndPush(cfg Config) {
	m := collect()
	if m == nil {
		return
	}

	body := map[string]interface{}{
		"agent_id": cfg.AgentID,
		"metric":   m,
	}
	data, _ := json.Marshal(body)

	resp, err := http.Post(cfg.AdminURL+"/api/monitor/push", "application/json", bytes.NewReader(data))
	if err != nil {
		fmt.Printf("[推送失败] %v\n", err)
		return
	}
	resp.Body.Close()
	fmt.Printf("[%s] CPU:%.1f%% MEM:%.1f%% DISK:%.1f%% LOAD:%.2f TCP:%d\n",
		time.Now().Format("15:04:05"),
		m.CPUPercent, m.MemPercent, m.DiskPercent, m.Load1m, m.TCPConnections)
}

// ========== 指标采集（仅 Linux） ==========

var lastCPUIdle, lastCPUTotal float64

func collect() *Metric {
	m := &Metric{}
	m.CPUPercent = readCPU()
	m.MemPercent = readMem()
	m.DiskPercent = readDisk("/")
	m.Load1m, m.Load5m, m.Load15m = readLoad()
	m.NetRxBytes, m.NetTxBytes = readNet()
	m.TCPConnections = readTCP()
	return m
}

func readCPU() float64 {
	data, err := os.ReadFile("/proc/stat")
	if err != nil {
		return 0
	}
	fields := strings.Fields(strings.Split(string(data), "\n")[0])[1:]

	var total, idle float64
	for i, f := range fields {
		v, _ := strconv.ParseFloat(f, 64)
		total += v
		if i == 3 {
			idle = v
		}
	}

	deltaTotal := total - lastCPUTotal
	deltaIdle := idle - lastCPUIdle
	lastCPUTotal, lastCPUIdle = total, idle

	if deltaTotal == 0 {
		return 0
	}
	return 100 * (1 - deltaIdle/deltaTotal)
}

func readMem() float64 {
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return 0
	}
	var total, available float64
	for _, line := range strings.Split(string(data), "\n") {
		if strings.HasPrefix(line, "MemTotal:") {
			fmt.Sscanf(line, "MemTotal: %f", &total)
		}
		if strings.HasPrefix(line, "MemAvailable:") {
			fmt.Sscanf(line, "MemAvailable: %f", &available)
		}
	}
	if total == 0 {
		return 0
	}
	return 100 * (1 - available/total)
}

var lastNetRx, lastNetTx int64

func readNet() (int64, int64) {
	data, err := os.ReadFile("/proc/net/dev")
	if err != nil {
		return 0, 0
	}
	var rx, tx int64
	for _, line := range strings.Split(string(data), "\n")[2:] {
		fields := strings.Fields(line)
		if len(fields) < 10 {
			continue
		}
		name := strings.TrimSuffix(fields[0], ":")
		if name == "lo" {
			continue
		}
		v, _ := strconv.ParseInt(fields[1], 10, 64)
		rx += v
		v, _ = strconv.ParseInt(fields[9], 10, 64)
		tx += v
	}

	deltaRx := rx - lastNetRx
	deltaTx := tx - lastNetTx
	lastNetRx, lastNetTx = rx, tx
	if deltaRx < 0 {
		deltaRx = 0
	}
	if deltaTx < 0 {
		deltaTx = 0
	}
	return deltaRx, deltaTx
}

func readTCP() int64 {
	data, err := os.ReadFile("/proc/net/tcp")
	if err != nil {
		return 0
	}
	count := 0
	for _, line := range strings.Split(string(data), "\n")[1:] {
		fields := strings.Fields(line)
		if len(fields) >= 4 && fields[3] == "01" {
			count++
		}
	}
	return int64(count)
}

func readLoad() (float64, float64, float64) {
	data, err := os.ReadFile("/proc/loadavg")
	if err != nil {
		return 0, 0, 0
	}
	fields := strings.Fields(string(data))
	l1, _ := strconv.ParseFloat(fields[0], 64)
	l5, _ := strconv.ParseFloat(fields[1], 64)
	l15, _ := strconv.ParseFloat(fields[2], 64)
	return l1, l5, l15
}

func readDisk(mountPoint string) float64 {
	var stat syscall.Statfs_t
	err := syscall.Statfs(mountPoint, &stat)
	if err != nil {
		return 0
	}
	total := stat.Blocks * uint64(stat.Bsize)
	free := stat.Bfree * uint64(stat.Bsize)
	if total == 0 {
		return 0
	}
	return 100 * float64(total-free) / float64(total)
}

// ========== 心跳 ==========

func heartbeat(cfg Config) {
	body, _ := json.Marshal(map[string]interface{}{
		"agent_id": cfg.AgentID,
		"hostname": hostname(),
	})
	resp, err := http.Post(cfg.AdminURL+"/api/agent/heartbeat", "application/json", bytes.NewReader(body))
	if err != nil {
		fmt.Printf("心跳失败: %v\n", err)
		return
	}
	resp.Body.Close()
	fmt.Println("心跳 - OK")
}

// ========== 命令执行 ==========

func checkTasks(cfg Config) {
	resp, err := http.Get(fmt.Sprintf("%s/api/agent/tasks?agent_id=%s", cfg.AdminURL, cfg.AgentID))
	if err != nil {
		return
	}
	raw, err := io.ReadAll(resp.Body)
	resp.Body.Close()
	if err != nil {
		return
	}

	var result struct {
		Data []struct {
			ID      uint   `json:"id"`
			Command string `json:"command"`
		} `json:"data"`
	}
	json.Unmarshal(raw, &result)

	for _, task := range result.Data {
		fmt.Printf("===== 执行任务 #%d =====\n", task.ID)
		fmt.Printf("命令: %s\n", task.Command)

		if !isSafe(task.Command) {
			reportResult(cfg, task.ID, "", "危险命令被 Agent 拦截", -1, 0)
			continue
		}

		startTime := time.Now()
		stdout, stderr, exitCode := runCmd(task.Command)
		duration := time.Since(startTime).Milliseconds()

		fmt.Printf("stdout: %s\n", truncate(stdout, 200))
		fmt.Printf("stderr: %s\n", truncate(stderr, 200))
		fmt.Printf("exit  : %d 耗时: %dms\n", exitCode, duration)

		reportResult(cfg, task.ID, stdout, stderr, exitCode, duration)
	}
}

func runCmd(cmdStr string) (stdout, stderr string, exitCode int) {
	cmd := exec.Command("sh", "-c", cmdStr)
	var outBuf, errBuf bytes.Buffer
	cmd.Stdout = &outBuf
	cmd.Stderr = &errBuf

	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

	err := cmd.Run()
	stdout = outBuf.String()
	stderr = errBuf.String()

	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			exitCode = -1
		}
	}
	return
}

func reportResult(cfg Config, taskID uint, stdout, stderr string, exitCode int, durationMs int64) {
	body, _ := json.Marshal(map[string]interface{}{
		"task_id":     taskID,
		"stdout":      stdout,
		"stderr":      stderr,
		"exit_code":   exitCode,
		"duration_ms": durationMs,
	})
	resp, err := http.Post(cfg.AdminURL+"/api/agent/task-result", "application/json", bytes.NewReader(body))
	if err != nil {
		fmt.Printf("上报任务结果失败: %v\n", err)
		return
	}
	resp.Body.Close()
}

func isSafe(cmd string) bool {
	lower := strings.ToLower(cmd)
	for _, dangerous := range dangerousCmds {
		if strings.Contains(lower, strings.ToLower(dangerous)) {
			return false
		}
	}
	return true
}

func hostname() string {
	h, _ := os.Hostname()
	return h
}

func getEnv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}

func truncate(s string, n int) string {
	s = strings.TrimSpace(s)
	lines := strings.Split(s, "\n")
	if len(lines) > 5 {
		lines = lines[:5]
		s = strings.Join(lines, "\n") + "\n..."
	}
	if len(s) > n {
		return s[:n] + "..."
	}
	return s
}
