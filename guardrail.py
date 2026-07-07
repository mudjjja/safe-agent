class SafetyGuardrail:
    def __init__(self):
        self.rules = [
            HighRiskActionRule(),        # 拦截 high 及以上
            DangerousPathRule(),         # 路径白名单
            DangerousArgsRule(),         # 危险参数检测
        ]

    def check(self, action: dict) -> dict:
        for rule in self.rules:
            result = rule.check(action)
            if not result["passed"]:
                return result
        return {"passed": True, "message": "安全检查通过"}


# 规则1：拦截 high 及以上
class HighRiskActionRule:
    def check(self, action):
        risk_level = action.get("risk_level", "low")
        if risk_level in ("critical", "high"):
            return {"passed": False, "reason": f"拦截：操作风险等级为 {risk_level}"}
        return {"passed": True}


# 规则2：路径白名单
class DangerousPathRule:
    ALLOWED_PATHS = ["/tmp", "/var/log", "/home", "/opt"]

    def check(self, action):
        path = action.get("args", {}).get("path", "")
        if not path:
            return {"passed": True}  # 没路径就跳过
        if any(path.startswith(p) for p in self.ALLOWED_PATHS):
            return {"passed": True}
        return {"passed": False, "reason": f"拦截：路径 {path} 不在操作白名单内"}


# 规则3：危险参数检测
class DangerousArgsRule:
    DANGEROUS_FLAGS = [
        {"flag": "recursive", "value": True, "reason": "禁止递归删除系统目录"},
        {"flag": "force", "value": True, "reason": "禁止强制删除操作"},
    ]

    def check(self, action):
        args = action.get("args", {})
        for flag in self.DANGEROUS_FLAGS:
            if args.get(flag["flag"]) == flag["value"]:
                return {"passed": False, "reason": flag["reason"]}
        return {"passed": True}
