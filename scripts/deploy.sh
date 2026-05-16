#!/bin/bash
set -e

cd /home/ubuntu

if [ ! -d "vaultfit" ]; then
  git clone https://github.com/benbaiju/VaultFit-Devops-Pipeline.git vaultfit
fi

cd vaultfit

git pull origin main

aws secretsmanager get-secret-value \
  --secret-id vaultfit/prod/env \
  --region ap-southeast-2 \
  --query SecretString \
  --output text | jq -r '
to_entries
| map("\(.key)=\(.value)")
| .[]
' > .env

docker pull benbaiju/vaultfit-backend:latest
docker pull benbaiju/vaultfit-frontend:latest

docker-compose up -d --remove-orphans