import { getToken } from './request';

/**
 * AI SSE 流式对话
 * 后端 SSE 格式：data: {"delta":"文本内容"}\n\ndata: [DONE]\n\n
 * 返回一个 AbortController，可调用 abort() 取消
 */
export function chatSSE(
  message: string,
  onChunk: (text: string) => void,
  onDone?: () => void,
  onError?: (err: Error) => void,
  onToolCall?: (phase: string) => void,
): AbortController {
  const controller = new AbortController();
  const token = getToken();
  const baseURL = (import.meta.env.VITE_API_BASE || '/api').replace(/\/+$/, '');

  (async () => {
    try {
      const response = await fetch(`${baseURL}/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留不完整行

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const data = trimmed.slice(6).trim();
          if (data === '[DONE]') {
            onDone?.();
            return;
          }

          try {
            const parsed = JSON.parse(data);
            // 后端实际格式: {"delta":"文本片段"}
            // 兼容旧格式: {"type":"text","content":"..."}
            const content = parsed.delta || parsed.content || parsed.text || '';
            if (content) {
              onChunk(content);
            }
            if (parsed.type === 'tool_call') {
              onToolCall?.(`🔍 正在调用工具: ${parsed.tool_name || '未知工具'}...`);
            } else if (parsed.type === 'tool_result') {
              onToolCall?.(`✅ 工具 ${parsed.tool_name} 返回结果`);
            } else if (parsed.type === 'tool_status') {
              onToolCall?.(parsed.content || parsed.tool_status || '处理中...');
            } else if (parsed.type === 'done') {
              onDone?.();
            }
            // 如果后端只发了 delta，没有 type 字段，就是普通文本块
          } catch {
            // 非 JSON 行直接当作文本
            onChunk(data);
          }
        }
      }
      onDone?.();
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      onError?.(err);
    }
  })();

  return controller;
}

/** 非流式降级方案 */
export async function chatSync(message: string): Promise<string> {
  const token = getToken();
  const baseURL = (import.meta.env.VITE_API_BASE || '/api').replace(/\/+$/, '');

  const res = await fetch(`${baseURL}/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message, stream: false }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json?.data?.content || json?.content || json?.message || '';
}
