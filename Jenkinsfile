pipeline {
    agent any

    tools {
        jdk 'JDK22'
    }

    environment {
        AWS_DEFAULT_REGION = 'ap-southeast-2'
        EC2_HOST = '15.134.85.70'
    }

    stages {

        stage('Checkout') {
            steps {

                echo 'Cloning repository'

                git branch: 'main',
                    url: 'https://github.com/benbaiju/VaultFit-Devops-Pipeline.git'
            }
        }

        stage('Prepare Environment') {
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

        stage('Code Quality') {
            steps {

                echo 'Running SonarCloud analysis'

                withSonarQubeEnv('Sonar Cloud') {

                    sh """
                        ${tool 'SonarScanner'}/bin/sonar-scanner \
                          -Dsonar.organization=benbaiju \
                          -Dsonar.projectKey=benbaiju_VaultFit-Devops-Pipeline \
                          -Dsonar.host.url=https://sonarcloud.io \
                          -Dsonar.sources=. \
                          -Dsonar.exclusions=**/node_modules/**,**/dist/**,**/coverage/**,**/.git/**,**/mobile/**,**/*.pdf,**/agent-transcripts/**
                    """
                }
            }
        }

        stage('Build and Push Images') {
            steps {

                withCredentials([
                    usernamePassword(
                        credentialsId: 'dockerhub-credentials',
                        usernameVariable: 'DOCKER_USER',
                        passwordVariable: 'DOCKER_PASS'
                    )
                ]) {

                    sh '''
                    echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin

                    docker buildx create --use --name multiarch-builder || true

                    echo "Building backend image"

                    docker buildx build --platform linux/amd64 \
                      -t benbaiju/vaultfit-backend:v1.0.${BUILD_NUMBER} \
                      -t benbaiju/vaultfit-backend:latest \
                      --push ./backend

                    echo "Building frontend image"

                    docker buildx build --platform linux/amd64 \
                      -t benbaiju/vaultfit-frontend:v1.0.${BUILD_NUMBER} \
                      -t benbaiju/vaultfit-frontend:latest \
                      --push ./frontend
                    '''
                }
            }
        }

        stage('Security Scan') {
            steps {

                echo 'Running Trivy security scans'

                sh '''
                /opt/homebrew/bin/trivy image benbaiju/vaultfit-backend:latest || true
                /opt/homebrew/bin/trivy image benbaiju/vaultfit-frontend:latest || true
                '''
            }
        }

        stage('Deploy') {
            steps {

                echo 'Deploying locally to staging'

                sh '''
                docker compose down || true
                docker compose up -d --remove-orphans
                '''
            }
        }

        stage('Release') {
            steps {

                script {
                    input message: 'Approve production release?', ok: 'Deploy'
                }

                withCredentials([
                    string(credentialsId: 'aws-access-key', variable: 'AWS_ACCESS_KEY_ID'),
                    string(credentialsId: 'aws-secret-key', variable: 'AWS_SECRET_ACCESS_KEY')
                ]) {

                    sh '''
                    echo "Creating deployment bundle"

                    zip -r deployment.zip appspec.yml scripts/

                    echo "Uploading deployment bundle to S3"

                    /opt/homebrew/bin/aws s3 cp deployment.zip \
                      s3://vaultfit-deployments/deployment-${BUILD_NUMBER}.zip

                    echo "Starting CodeDeploy deployment"

                    DEPLOYMENT_ID=$(
                      /opt/homebrew/bin/aws deploy create-deployment \
                        --application-name VaultFit \
                        --deployment-group-name vaultfit \
                        --deployment-config-name CodeDeployDefault.AllAtOnce \
                        --s3-location bucket=vaultfit-deployments,bundleType=zip,key=deployment-${BUILD_NUMBER}.zip \
                        --query deploymentId \
                        --output text
                    )

                    echo "Deployment ID: $DEPLOYMENT_ID"

                    echo "Waiting for deployment to complete..."

                    /opt/homebrew/bin/aws deploy wait deployment-successful \
                      --deployment-id $DEPLOYMENT_ID

                    echo "CodeDeploy deployment succeeded"

                    echo "Waiting for services to stabilise..."

                    sleep 20

                    echo "Checking backend health"

                    curl -f http://${EC2_HOST}:4000/health

                    echo "Backend health check passed"

                    echo "Checking frontend health"

                    curl -f http://${EC2_HOST}:3000

                    echo "Frontend health check passed"

                    echo "Production deployment verified successfully"
                    '''
                }
            }
        }

        stage('Monitoring') {
            steps {
                sh '''
                echo "Verifying production monitoring endpoints"

                sleep 10

                echo "Checking backend Prometheus metrics"
                curl -f http://${EC2_HOST}:4000/metrics

                echo "Checking frontend availability"
                curl -f http://${EC2_HOST}:3000

                echo "Waiting for Loki to become ready"

                deadline=$((SECONDS + 60))

                until curl -fsS http://${EC2_HOST}:3100/ready; do
                if [ "$SECONDS" -ge "$deadline" ]; then
                    echo "ERROR: Loki failed readiness check"
                    exit 1
                fi

                echo "Loki not ready yet, retrying..."
                sleep 5
                done

                echo "Loki readiness check passed"

                echo "Monitoring verification passed"
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

        always {
            cleanWs()
        }
    }
}