pipeline {
    agent any

    tools {
        jdk 'JDK22'
    }

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

        stage('Build') {
            steps {
                echo 'Building Docker containers'

                sh 'docker compose build'

                echo 'Tagging images with build number'

                sh "docker tag vaultfit-backend:latest benbaiju/vaultfit-backend:v1.0.${BUILD_NUMBER}"
                sh "docker tag vaultfit-frontend:latest benbaiju/vaultfit-frontend:v1.0.${BUILD_NUMBER}"
            }
        }

        stage('Security Scan') {
            steps {
                echo 'Running Trivy security scans'

                sh '''
                /opt/homebrew/bin/trivy image vaultfit-backend:latest || true
                /opt/homebrew/bin/trivy image vaultfit-frontend:latest || true
                '''
            }
        }

        stage('Deploy') {
            steps {
                echo 'Deploying to staging'

                sh 'docker compose up -d --remove-orphans'
            }
        }

        stage('Release') {
            steps {
                script {
                    input message: 'Approve production release?', ok: 'Deploy'
                }

                withAWS(region: 'ap-southeast-2', credentials: 'aws-creds') {

                    sh '''
                    echo "Creating deployment bundle"

                    zip -r deployment.zip appspec.yaml scripts/

                    echo "Uploading bundle to S3"

                    aws s3 cp deployment.zip \
                    s3://YOUR_BUCKET_NAME/deployment-${BUILD_NUMBER}.zip

                    echo "Triggering CodeDeploy deployment"

                    aws deploy create-deployment \
                    --application-name VaultFitApp \
                    --deployment-group-name VaultFitDG \
                    --deployment-config-name CodeDeployDefault.AllAtOnce \
                    --s3-location bucket=YOUR_BUCKET_NAME,bundleType=zip,key=deployment-${BUILD_NUMBER}.zip
                    '''
                }
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