package config

import (
	"os"
	"path/filepath"
)

type Config struct {
	ListenAddr string
	DBPath     string
	LLM        LLMConfig
	JWTSecret  string
}

type LLMConfig struct {
	Provider    string
	APIKey      string
	BaseURL     string
	Model       string
	MaxTokens   int
	Temperature float64
}

func Load() *Config {
	return &Config{
		ListenAddr: getEnv("LISTEN_ADDR", ":8080"),
		DBPath:     resolvePath(getEnv("DB_PATH", "data/agent.db")),
		JWTSecret:  getEnv("JWT_SECRET", "security-ops-2024"),
		LLM: LLMConfig{
			Provider:    getEnv("LLM_PROVIDER", "deepseek"),
			APIKey:      getEnv("LLM_API_KEY", "sk-your-api-key"),
			BaseURL:     getEnv("LLM_BASE_URL", "https://api.deepseek.com"),
			Model:       getEnv("LLM_MODEL", "deepseek-chat"),
			MaxTokens:   4096,
			Temperature: 0.3,
		},
	}
}

func getEnv(key, defaultVal string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultVal
}

func resolvePath(p string) string {
	if filepath.IsAbs(p) {
		return p
	}
	dir, _ := os.Getwd()
	return filepath.Join(dir, p)
}
