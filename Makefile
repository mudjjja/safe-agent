.PHONY: build build-admin-loong64 build-agent-loong64 run clean

# 默认：编译 admin（后端）
build:
	go build -o bin/admin ./cmd/admin

# 编译麒麟版 Admin（龙芯架构）
build-admin-loong64:
	GOOS=linux GOARCH=loong64 go mod tidy
	GOOS=linux GOARCH=loong64 go build -o bin/admin-loong64 ./cmd/admin

# 编译麒麟版 Agent（龙芯架构）
build-agent-loong64:
	GOOS=linux GOARCH=loong64 go mod tidy
	GOOS=linux GOARCH=loong64 go build -o bin/agent-loong64 ./cmd/agent

# 编译本地 Agent（调试用）
build-agent-local:
	go build -o bin/agent ./cmd/agent

# 启动后端
run:
	go run ./cmd/admin

# 清理
clean:
	rm -rf bin data
