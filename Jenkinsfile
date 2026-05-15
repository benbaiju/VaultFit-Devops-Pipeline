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
                      echo "WARNING: Using .env.docker.example placeholders. Add a Jenkins Secret file credential named vaultfit-env and copy it to .env for production."
                    else
                      echo "ERROR: No .env file. Create one from .env.docker.example on the Jenkins agent or bind a Secret file credential."
                      exit 1
                    fi
                  fi
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
                sh 'docker compose up -d'
            }
        }

        stage('Verify') {
            steps {
                echo 'Health checks'
                sh '''
                  sleep 10
                  curl -fsS http://127.0.0.1:4000/health
                  echo ""
                  curl -fsS http://127.0.0.1:3000/api/health
                  echo ""
                  docker compose ps
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
