package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"security-ops-agent/config"
	"strings"
	"time"
)

type AIService struct {
	cfg    *config.Config
	client *http.Client
}

func NewAIService(cfg *config.Config) *AIService {
	return &AIService{cfg: cfg, client: &http.Client{Timeout: 120 * time.Second}}
}

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ToolCall struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

type ChatRequest struct {
	Messages []ChatMessage `json:"messages"`
	Stream   bool          `json:"stream"`
}

type ChatChoice struct {
	Message struct {
		Content   string     `json:"content"`
		ToolCalls []ToolCall `json:"tool_calls"`
	} `json:"delta"`
}

type ChatStreamChunk struct {
	Choices []ChatChoice `json:"choices"`
}

// AnalyzeAlert 对告警做 AI 深度分析（非流式）
func (s *AIService) AnalyzeAlert(triggerReason, metrics string) (summary, rootCause, suggestion string, err error) {
	prompt := fmt.Sprintf(`你是一个麒麟 Linux 安全运维专家。系统触发了一条告警：

触发原因: %s

当前系统指标:
%s

请用 JSON 格式返回分析结果，不要包含其他文字：
{"summary":"一句话异常摘要","root_cause":"根因分析","suggestion":"修复建议步骤"}

要求：
- summary 一段话以内
- root_cause 分析可能的攻击类型或系统问题
- suggestion 给出3-5步具体可执行的修复步骤`, triggerReason, metrics)

	content, err := s.chat([]ChatMessage{{Role: "user", Content: prompt}})
	if err != nil {
		return "", "", "", err
	}

	var result struct {
		Summary    string `json:"summary"`
		RootCause  string `json:"root_cause"`
		Suggestion string `json:"suggestion"`
	}
	if err := json.Unmarshal([]byte(cleanJSON(content)), &result); err != nil {
		return triggerReason, content, "", nil
	}
	return result.Summary, result.RootCause, result.Suggestion, nil
}

// StreamChat 流式对话，每收到一段内容就调用 onChunk
func (s *AIService) StreamChat(history []ChatMessage, onChunk func(delta string)) (string, error) {
	reqBody := map[string]interface{}{
		"model":    s.cfg.LLM.Model,
		"messages": history,
		"stream":   true,
		"temperature": s.cfg.LLM.Temperature,
	}
	body, _ := json.Marshal(reqBody)

	req, _ := http.NewRequest("POST", s.cfg.LLM.BaseURL+"/v1/chat/completions", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.cfg.LLM.APIKey)
	req.Header.Set("Accept", "text/event-stream")

	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		errBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("AI API 错误 (%d): %s", resp.StatusCode, string(errBody))
	}

	var fullContent strings.Builder
	buf := make([]byte, 4096)
	for {
		n, err := resp.Body.Read(buf)
		if n > 0 {
			lines := strings.Split(string(buf[:n]), "\n")
			for _, line := range lines {
				if !strings.HasPrefix(line, "data: ") || line == "data: [DONE]" {
					continue
				}
				var chunk ChatStreamChunk
				json.Unmarshal([]byte(line[6:]), &chunk)
				if len(chunk.Choices) > 0 && chunk.Choices[0].Message.Content != "" {
					delta := chunk.Choices[0].Message.Content
					fullContent.WriteString(delta)
					if onChunk != nil {
						onChunk(delta)
					}
				}
			}
		}
		if err == io.EOF || n == 0 {
			break
		}
		if err != nil {
			return fullContent.String(), nil
		}
	}
	return fullContent.String(), nil
}

func (s *AIService) chat(messages []ChatMessage) (string, error) {
	reqBody := map[string]interface{}{
		"model":       s.cfg.LLM.Model,
		"messages":    messages,
		"temperature": s.cfg.LLM.Temperature,
	}
	body, _ := json.Marshal(reqBody)

	req, _ := http.NewRequest("POST", s.cfg.LLM.BaseURL+"/v1/chat/completions", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.cfg.LLM.APIKey)

	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		errBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("AI API 错误 (%d): %s", resp.StatusCode, string(errBody))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	respBody, _ := io.ReadAll(resp.Body)
	json.Unmarshal(respBody, &result)
	if len(result.Choices) > 0 {
		return result.Choices[0].Message.Content, nil
	}
	return "", fmt.Errorf("AI 返回为空: %s", string(respBody))
}

func cleanJSON(s string) string {
	s = strings.TrimSpace(s)
	s = strings.TrimPrefix(s, "```json")
	s = strings.TrimPrefix(s, "```")
	s = strings.TrimSuffix(s, "```")
	return strings.TrimSpace(s)
}
