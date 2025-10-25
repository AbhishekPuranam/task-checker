#!/bin/bash

# Docker Setup and Run Script for Task Tracker
# This script helps you build and run the Task Tracker application using Docker

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🐳 Task Tracker Docker Setup${NC}"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

# Function to show usage
show_usage() {
    echo -e "${YELLOW}Usage: $0 [COMMAND]${NC}"
    echo ""
    echo "Commands:"
    echo "  dev       Start development environment"
    echo "  prod      Start production environment"
    echo "  build     Build Docker images"
    echo "  stop      Stop all containers"
    echo "  clean     Clean up containers and volumes"
    echo "  logs      View application logs"
    echo "  shell     Access application shell"
    echo "  db        Access MongoDB shell"
    echo ""
}

# Function to create .env file if it doesn't exist
create_env_file() {
    if [ ! -f .env ]; then
        echo -e "${YELLOW}📝 Creating .env file...${NC}"
        cat > .env << EOF
NODE_ENV=production
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)
MONGODB_ROOT_PASSWORD=password123
MONGODB_DATABASE=tasktracker
EOF
        echo -e "${GREEN}✅ .env file created with random secrets${NC}"
    fi
}

# Function to start development environment
start_dev() {
    echo -e "${BLUE}🚀 Starting development environment...${NC}"
    docker-compose -f docker-compose.dev.yml up --build -d
    
    echo -e "${GREEN}✅ Development environment started!${NC}"
    echo -e "${BLUE}📱 Frontend: http://localhost:3000${NC}"
    echo -e "${BLUE}🔧 Backend: http://localhost:5000${NC}"
    echo -e "${BLUE}🗄️  MongoDB: localhost:27017${NC}"
    echo ""
    echo -e "${YELLOW}View logs: ./docker-run.sh logs${NC}"
}

# Function to start production environment
start_prod() {
    echo -e "${BLUE}🚀 Starting production environment...${NC}"
    create_env_file
    
    docker-compose up --build -d
    
    echo -e "${GREEN}✅ Production environment started!${NC}"
    echo -e "${BLUE}🌐 Application: http://localhost${NC}"
    echo -e "${BLUE}🔧 API: http://localhost:5000${NC}"
    echo -e "${BLUE}🗄️  MongoDB: localhost:27017${NC}"
    echo ""
    echo -e "${YELLOW}View logs: ./docker-run.sh logs${NC}"
}

# Function to build images
build_images() {
    echo -e "${BLUE}🔨 Building Docker images...${NC}"
    docker-compose build --no-cache
    echo -e "${GREEN}✅ Images built successfully!${NC}"
}

# Function to stop containers
stop_containers() {
    echo -e "${BLUE}🛑 Stopping containers...${NC}"
    docker-compose down
    docker-compose -f docker-compose.dev.yml down
    echo -e "${GREEN}✅ All containers stopped!${NC}"
}

# Function to clean up
cleanup() {
    echo -e "${BLUE}🧹 Cleaning up containers and volumes...${NC}"
    docker-compose down -v --remove-orphans
    docker-compose -f docker-compose.dev.yml down -v --remove-orphans
    
    # Remove unused images
    docker image prune -f
    
    echo -e "${GREEN}✅ Cleanup completed!${NC}"
}

# Function to view logs
view_logs() {
    echo -e "${BLUE}📋 Viewing application logs...${NC}"
    if docker ps --format "table {{.Names}}" | grep -q "tasktracker-app"; then
        docker-compose logs -f tasktracker-app
    elif docker ps --format "table {{.Names}}" | grep -q "tasktracker-app-dev"; then
        docker-compose -f docker-compose.dev.yml logs -f tasktracker-app-dev
    else
        echo -e "${RED}❌ No running Task Tracker containers found${NC}"
    fi
}

# Function to access application shell
access_shell() {
    echo -e "${BLUE}💻 Accessing application shell...${NC}"
    if docker ps --format "table {{.Names}}" | grep -q "tasktracker-app"; then
        docker exec -it tasktracker-app sh
    elif docker ps --format "table {{.Names}}" | grep -q "tasktracker-app-dev"; then
        docker exec -it tasktracker-app-dev sh
    else
        echo -e "${RED}❌ No running Task Tracker containers found${NC}"
    fi
}

# Function to access MongoDB shell
access_db() {
    echo -e "${BLUE}🗄️  Accessing MongoDB shell...${NC}"
    if docker ps --format "table {{.Names}}" | grep -q "tasktracker-mongodb"; then
        docker exec -it tasktracker-mongodb mongosh tasktracker
    elif docker ps --format "table {{.Names}}" | grep -q "tasktracker-dev-mongodb"; then
        docker exec -it tasktracker-dev-mongodb mongosh tasktracker
    else
        echo -e "${RED}❌ No running MongoDB containers found${NC}"
    fi
}

# Main script logic
case "$1" in
    "dev")
        start_dev
        ;;
    "prod")
        start_prod
        ;;
    "build")
        build_images
        ;;
    "stop")
        stop_containers
        ;;
    "clean")
        cleanup
        ;;
    "logs")
        view_logs
        ;;
    "shell")
        access_shell
        ;;
    "db")
        access_db
        ;;
    *)
        show_usage
        ;;
esac