#!/bin/bash
set -e

cd /home/ubuntu

if [ ! -d "vaultfit" ]; then
  git clone https://github.com/benbaiju/VaultFit-Devops-Pipeline.git vaultfit
fi

cd vaultfit

git pull origin main

echo "Fetching production environment variables"

aws secretsmanager get-secret-value \
  --secret-id vaultfit/prod/env \
  --region ap-southeast-2 \
  --query SecretString \
  --output text | jq -r '
to_entries
| map("\(.key)=\(.value)")
| .[]
' > .env

echo "Stopping old containers"

docker-compose down || true

echo "Pulling latest Docker images"

docker-compose pull

echo "Starting updated containers"

docker-compose up -d --remove-orphans

echo "Waiting for services"

sleep 20

echo "Checking backend health"

curl -f http://localhost:4000/health

echo "Checking frontend health"

curl -f http://localhost:3000

echo "Checking Loki readiness"

curl -f http://localhost:3100/ready

echo "Waiting for Promtail to ship logs to Loki (timeout 30s)"

deadline=$((SECONDS + 30))
until curl -fsS "http://localhost:3100/loki/api/v1/labels" | grep -q container; do
  if [ "$SECONDS" -ge "$deadline" ]; then
    echo "ERROR: Timed out waiting for Loki log labels (check Promtail)"
    exit 1
  fi
  sleep 2
done

echo "Loki log pipeline ready"

echo "Deployment completed successfully"