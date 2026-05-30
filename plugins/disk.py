from .base import BasePlugin
import platform
import subprocess

class DiskPlugin(BasePlugin):
    name = "disk"
    description = "磁盘管理：查看空间、查找大文件"

    def can_handle(self, action):
        return action["action"] in ("disk_check", "disk_clean", "disk_usage")

    def execute(self, action):
        action_type = action["action"]

        if action_type == "disk_check":
            if platform.system() == "Windows":
                # Windows 模拟
                result = subprocess.run(["wmic", "logicaldisk", "get", "size,freespace,caption"],
                                      capture_output=True, text=True)
                return result.stdout
            else:
                # Linux
                result = subprocess.run(["df", "-h"], capture_output=True, text=True)
                return result.stdout

        return f"未知的磁盘操作: {action_type}"
