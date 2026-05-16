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
                echo 'Awaiting approval to release to production'
                input message: 'Deploy to production?', ok: 'Approve Release'

                echo 'Pushing images to Docker Hub'
                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub-credentials',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh '''
                    echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
                    docker push benbaiju/vaultfit-backend:v1.0.${BUILD_NUMBER}
                    docker push benbaiju/vaultfit-frontend:v1.0.${BUILD_NUMBER}
                    '''
                }

                echo 'Triggering CodeDeploy'
                withCredentials([
                    string(credentialsId: 'aws-access-key', variable: 'AWS_ACCESS_KEY'),
                    string(credentialsId: 'aws-secret-key', variable: 'AWS_SECRET_KEY')
                ]) {
                    awsCodeDeploy(
                        applicationName: 'vaultfit',
                        deploymentGroupName: 'vaultfit-prod',
                        deploymentConfig: 'CodeDeployDefault.AllAtOnce',
                        awsAccessKey: "${AWS_ACCESS_KEY}",
                        awsSecretKey: "${AWS_SECRET_KEY}",
                        awsRegion: 'us-east-1',
                        s3bucket: 'vaultfit-deployments-benbaiju',
                        s3prefix: '',
                        includes: '**',
                        excludes: 'node_modules/**'
                    )
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