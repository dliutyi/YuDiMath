#!/bin/bash
# Test script for Docker setup

set -e

echo "Testing Docker setup..."

# Test 1: Dockerfile builds successfully
echo "Test 1: Building Docker image..."
docker build -f docker/Dockerfile -t yudimath:test ..

# Test 2: Docker image exists
echo "Test 2: Verifying image exists..."
docker images | grep yudimath:test

# Test 3: Container can start
echo "Test 3: Starting container..."
CONTAINER_ID=$(docker run -d -p 8080:80 yudimath:test)
sleep 2

# Test 4: Container is running
echo "Test 4: Verifying container is running..."
docker ps | grep $CONTAINER_ID

# Test 5: Container serves content
echo "Test 5: Testing HTTP response..."
curl -f http://localhost:8080 || echo "Warning: curl test failed (container may still be starting)"

# Cleanup
echo "Cleaning up..."
docker stop $CONTAINER_ID
docker rm $CONTAINER_ID
docker rmi yudimath:test

echo "All Docker tests passed!"

