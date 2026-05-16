#!/bin/bash
set -e

docker pull benbaiju/vaultfit-backend:latest
docker pull benbaiju/vaultfit-frontend:latest

cd /home/ubuntu/vaultfit
cp .env.docker.example .env
docker compose -p vaultfit-prod up -d --remove-orphans