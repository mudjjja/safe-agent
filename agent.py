from openai import OpenAI
import json
import os
from guardrail import SafetyGuardrail
from plugins import PluginManager

API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
if not API_KEY:
    raise ValueError("请先设置环境变量 DEEPSEEK_API_KEY")

client = OpenAI(
    base_url="https://api.deepseek.com",
    api_key=API_KEY
)

guardrail = SafetyGuardrail()
plugin_manager = PluginManager()

# LLM 意图理解
def parse_intent(user_input: str) -> dict:
    system_prompt = """你是一个 Linux 运维助手。
请把用户的中文指令解析成 JSON 格式的操作计划。

例子：
用户：看看磁盘还有多少空间
返回：{"action": "disk_check", "args": {}, "risk_level": "low"}

用户：把 /tmp 目录清一下
返回：{"action": "clean_dir", "args": {"path": "/tmp"}, "risk_level": "medium"}

用户：把 /etc/passwd 删掉
返回：{"action": "delete_file", "args": {"path": "/etc/passwd"}, "risk_level": "critical"}

只返回 JSON，不要返回其他内容。"""

    response = client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_input}
        ]
    )
    return json.loads(response.choices[0].message.content)

# 完整流程
def process(user_input: str):
    print(f"用户说: {user_input}")

    # 1. LLM 理解
    action = parse_intent(user_input)
    print(f"LLM 解析: {json.dumps(action, ensure_ascii=False)}")

    # 2. 安全护栏
    result = guardrail.check(action)
    if not result["passed"]:
        print(f"护栏拦截: {result['reason']}")
        print("-" * 30)
        return

    # 3. 找插件执行
    plugin = plugin_manager.find_plugin(action)
    if not plugin:
        print(f"没有找到能处理该操作的插件")
        print("-" * 30)
        return

    output = plugin.execute(action)
    print(f"执行结果:\n{output}")
    print("-" * 30)
    return output


if __name__ == "__main__":
    process("帮我看看磁盘还剩多少空间")
    process("查一下 8080 端口")
