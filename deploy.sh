#!/bin/bash

# AWS EC2 배포 스크립트
# 사용법: chmod +x deploy.sh && ./deploy.sh

echo "🚀 FileBlocker 배포 시작..."

# 패키지 업데이트
echo "📦 시스템 업데이트 중..."
sudo yum update -y

# Node.js 설치 (NVM 사용)
echo "📥 Node.js 설치 중..."
if ! command -v node &> /dev/null; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    source ~/.bashrc
    nvm install 18
    nvm use 18
    nvm alias default 18
fi

# PM2 전역 설치
echo "🔧 PM2 설치 중..."
npm install -g pm2

# 프로젝트 디렉토리로 이동
cd /home/ec2-user/FileBlocker

# 종속성 설치
echo "📦 npm 패키지 설치 중..."
npm install --production

# 로그 디렉토리 생성
mkdir -p logs

# 데이터베이스 권한 설정
chmod 664 extensions.db 2>/dev/null || echo "데이터베이스 파일이 아직 없습니다. 첫 실행 시 생성됩니다."

# PM2로 앱 시작/재시작
echo "🚀 애플리케이션 시작 중..."
pm2 delete file-blocker 2>/dev/null || echo "기존 프로세스가 없습니다."
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Nginx 설치 및 설정
echo "🌐 Nginx 설치 중..."
sudo yum install -y nginx

# Nginx 설정 파일 생성
sudo tee /etc/nginx/conf.d/filebllocker.conf > /dev/null <<EOF
server {
    listen 80;
    server_name _;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Nginx 시작
sudo systemctl start nginx
sudo systemctl enable nginx

# 방화벽 설정 (Amazon Linux 2)
echo "🔥 방화벽 설정 중..."
sudo systemctl start firewalld 2>/dev/null || echo "firewalld가 설치되어 있지 않습니다."
sudo firewall-cmd --permanent --add-service=http 2>/dev/null || echo "firewalld 설정을 건너뜁니다."
sudo firewall-cmd --reload 2>/dev/null || echo "firewalld 설정을 건너뜁니다."

echo "✅ 배포 완료!"
echo "🌐 브라우저에서 EC2 퍼블릭 IP로 접속하세요!"
echo "📊 PM2 상태 확인: pm2 status"
echo "📋 PM2 로그 확인: pm2 logs"