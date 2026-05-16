#!/bin/bash
set -e

cd /home/ubuntu

if [ ! -d "vaultfit" ]; then
  git clone https://github.com/benbaiju/VaultFit-Devops-Pipeline.git vaultfit
fi

cd vaultfit

git pull origin main

docker pull benbaiju/vaultfit-backend:latest
docker pull benbaiju/vaultfit-frontend:latest

if [ ! -f .env ]; then
  cp .env.docker.example .env
fi

docker-compose up -d --remove-orphans