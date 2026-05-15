pipeline {
    agent any

    stages {

        stage('Checkout') {
            steps {
                echo 'Cloning repository'
                git branch: 'main',
                    url: 'https://github.com/benbaiju/VaultFit-Devops-Pipeline.git'
            }
        }

        stage('Prepare environment') {
            steps {
                echo 'Ensuring .env exists for docker compose'
                sh '''
                  if [ ! -f .env ]; then
                    if [ -f .env.docker.example ]; then
                      cp .env.docker.example .env
                      echo "WARNING: Using .env.docker.example placeholders."
                    else
                      echo "ERROR: No .env file."
                      exit 1
                    fi
                  fi
                '''
            }
        }

        stage('Test') {
            steps {
                echo 'Running backend tests'
                sh '''
                  cd backend
                  npm ci
                  npm test
                '''
                echo 'Running frontend tests'
                sh '''
                  cd frontend
                  npm ci
                  npm test
                '''
            }
        }

        stage('Build') {
            steps {
                echo 'Building Docker containers'
                sh 'docker compose build'
            }
        }

        stage('Deploy') {
            steps {
                echo 'Deploying application'
                sh 'docker compose up -d --remove-orphans'
            }
        }

        stage('Verify') {
            steps {
                echo 'Health checks'
                sh '''
                  set -e
                  docker compose ps

                  for i in $(seq 1 30); do
                    BACKEND_OK=$(docker inspect -f '{{.State.Health.Status}}' vaultfit-backend 2>/dev/null || echo "missing")
                    FRONTEND_OK=$(docker inspect -f '{{.State.Health.Status}}' vaultfit-frontend 2>/dev/null || echo "missing")
                    echo "Attempt $i: backend=$BACKEND_OK frontend=$FRONTEND_OK"
                    if [ "$BACKEND_OK" = "healthy" ] && [ "$FRONTEND_OK" = "healthy" ]; then
                      break
                    fi
                    sleep 3
                  done

                  curl -fsS http://127.0.0.1:4000/health
                  echo ""
                  docker compose exec -T frontend wget -qO- http://127.0.0.1/api/health
                  echo ""

                  for i in $(seq 1 10); do
                    if curl -fsS http://127.0.0.1:3000/api/health; then
                      echo ""
                      exit 0
                    fi
                    sleep 3
                  done
                  docker port vaultfit-frontend || true
                  docker compose logs --tail=30 frontend || true
                  exit 1
                '''
            }
        }
    }

    post {
        success {
            echo 'Pipeline completed successfully'
        }
        failure {
            echo 'Pipeline failed'
        }
    }
}
