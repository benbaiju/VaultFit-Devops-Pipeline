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

echo "Pulling latest Docker images"

docker pull benbaiju/vaultfit-backend:latest
docker pull benbaiju/vaultfit-frontend:latest

echo "Stopping old containers"

docker compose down

echo "Starting updated containers"

docker compose up -d --remove-orphans

echo "Waiting for services"

sleep 20

echo "Checking backend health"

curl -f http://localhost:4000/health

echo "Checking frontend health"

curl -f http://localhost:3000

echo "Deployment completed successfully"