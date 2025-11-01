# scripts/deploy-ssh.ps1
$ErrorActionPreference = 'Stop'

# 1) 本地路径固定
Set-Location 'C:\Users\PC\Desktop\vben1\vue-vben-admin'
pnpm --filter @vben/web-antd build

# 2) 要上传的文件（vben 已经帮你打好了）
$localZip = 'C:\Users\PC\Desktop\vben1\vue-vben-admin\apps\web-antd\dist.zip'
# 3) 私钥
$key      = "$env:USERPROFILE\.ssh\id_ed25519"
# 4) 远程固定信息
$remoteZip = '/tmp/dist.zip'
$remoteDir = '/mnt/www/wwwroot/playvue'

# 5) 上传（写死 deploy@...）

scp -i $key -P 22 $localZip "deploy@47.117.179.59:$remoteZip"



# 6) 远程解压（也写死 deploy@...）


# 组一条真正要跑的 ssh 命令
$sshCmd = "ssh -i `"$key`" -p 22 deploy@47.117.179.59 `"mkdir -p $remoteDir && cd $remoteDir && unzip -o -DD $remoteZip && rm -f $remoteZip`""

Write-Host "== run remote =="
Write-Host $sshCmd

# 真正执行
cmd /c $sshCmd

if ($LASTEXITCODE -ne 0) {
  Write-Error "remote ssh failed: $LASTEXITCODE"
  exit 1
}

Write-Host "Deploy OK."
