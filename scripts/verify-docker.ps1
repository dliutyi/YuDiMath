# PowerShell script to verify Docker setup
# This script builds and starts the Docker container, then verifies it works

Write-Host "Building Docker image..." -ForegroundColor Cyan
docker-compose -f docker/docker-compose.yml build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Starting Docker container..." -ForegroundColor Cyan
docker-compose -f docker/docker-compose.yml up -d

if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker start failed!" -ForegroundColor Red
    exit 1
}

Write-Host "Waiting for container to be ready..." -ForegroundColor Cyan
Start-Sleep -Seconds 3

Write-Host "Checking container status..." -ForegroundColor Cyan
docker-compose -f docker/docker-compose.yml ps

Write-Host "Testing HTTP endpoint..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ HTTP request successful (Status: $($response.StatusCode))" -ForegroundColor Green
        if ($response.Content -match "YuDiMath") {
            Write-Host "✓ Application content verified" -ForegroundColor Green
        } else {
            Write-Host "⚠ Warning: Expected content not found" -ForegroundColor Yellow
        }
    } else {
        Write-Host "✗ HTTP request returned status: $($response.StatusCode)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ HTTP request failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Container logs:" -ForegroundColor Yellow
    docker-compose -f docker/docker-compose.yml logs --tail=20
    exit 1
}

Write-Host "Checking container logs for errors..." -ForegroundColor Cyan
$logs = docker-compose -f docker/docker-compose.yml logs --tail=50
if ($logs -match "error|Error|ERROR|fatal|Fatal|FATAL") {
    Write-Host "⚠ Warning: Errors found in logs:" -ForegroundColor Yellow
    $logs | Select-String -Pattern "error|Error|ERROR|fatal|Fatal|FATAL"
} else {
    Write-Host "✓ No errors found in logs" -ForegroundColor Green
}

Write-Host "`nDocker verification complete!" -ForegroundColor Green

