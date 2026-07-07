from .disk import DiskPlugin
from .process import ProcessPlugin

def get_all_plugins():
    return [DiskPlugin(), ProcessPlugin()]

class PluginManager:
    def __init__(self):
        self.plugins = get_all_plugins()

    def find_plugin(self, action):
        for plugin in self.plugins:
            if plugin.can_handle(action):
                return plugin
        return None
