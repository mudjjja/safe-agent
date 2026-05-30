from .base import BasePlugin
import platform
import subprocess

class ProcessPlugin(BasePlugin):
    name = "process"
    description = "进程管理：查看进程、结束进程"

    def can_handle(self, action):
        return action["action"] in ("process_list", "kill_process")

    def execute(self, action):
        if action["action"] == "process_list":
            if platform.system() == "Windows":
                result = subprocess.run(["tasklist"], capture_output=True, text=True)
                return result.stdout[:2000]  # 截断，不然太多了
            else:
                result = subprocess.run(["ps", "aux"], capture_output=True, text=True)
                return result.stdout[:2000]

        elif action["action"] == "kill_process":
            pid = str(action["args"].get("pid", ""))
            if platform.system() == "Windows":
                subprocess.run(["taskkill", "/F", "/PID", pid], capture_output=True, text=True)
                return f"进程 {pid} 已结束"
            else:
                subprocess.run(["kill", pid], capture_output=True, text=True)
                return f"进程 {pid} 已结束"

        return f"未知的进程操作: {action['action']}"
