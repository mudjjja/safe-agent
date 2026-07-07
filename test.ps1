# 用 .NET WebClient，比 PowerShell cmdlet 可靠
$wc = New-Object System.Net.WebClient
$wc.Headers.Add("Content-Type", "application/json")

Write-Host "=== 推送指标 ==="
$json = '{"agent_id":"agent-001","metric":{"cpu_percent":95.5,"mem_percent":72.1,"disk_percent":45.0,"load_1m":3.2,"load_5m":2.8,"load_15m":2.1,"net_rx_bytes":1024000,"net_tx_bytes":512000,"tcp_connections":128}}'
try {
    $result = $wc.UploadString("http://localhost:8080/api/monitor/push", $json)
    Write-Host $result
} catch {
    Write-Host "错误: $_"
}

Write-Host "`n=== 最新指标 ==="
(Invoke-WebRequest "http://localhost:8080/api/monitor/latest?agent_id=agent-001").Content

Write-Host "`n=== 告警 ==="
(Invoke-WebRequest "http://localhost:8080/api/alerts").Content

Write-Host "`n=== Dashboard ==="
(Invoke-WebRequest "http://localhost:8080/api/dashboard/stats").Content
