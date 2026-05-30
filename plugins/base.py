class BasePlugin:
    name = ""        # 插件名
    description = "" # 描述

    def can_handle(self, action: dict) -> bool:
        """判断这个插件能不能处理这个 action"""
        raise NotImplementedError

    def execute(self, action: dict) -> str:
        """执行操作，返回结果"""
        raise NotImplementedError
