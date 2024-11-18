#!/bin/bash

# Static website example
echo "Generating static website configuration..."
curl -X POST -H "Content-Type: application/json" -d '{
  "template": "static",
  "templateParams": {
    "domain": "example.com",
    "rootPath": "/var/www/example",
    "sslEnabled": true
  }
}' http://localhost:3000

echo -e "\n\nGenerating WordPress configuration..."
curl -X POST -H "Content-Type: application/json" -d '{
  "template": "wordpress",
  "templateParams": {
    "domain": "blog.com",
    "rootPath": "/var/www/wordpress",
    "phpVersion": "8.2",
    "sslEnabled": true
  }
}' http://localhost:3000

echo -e "\n\nGenerating microservices configuration..."
curl -X POST -H "Content-Type: application/json" -d '{
  "template": "microservices",
  "templateParams": {
    "domain": "api.myapp.com",
    "services": [
      {
        "name": "auth",
        "port": 3001,
        "path": "/auth",
        "methods": ["POST", "GET"],
        "corsEnabled": true
      },
      {
        "name": "users",
        "port": 3002,
        "path": "/users",
        "methods": ["GET", "POST", "PUT", "DELETE"],
        "corsEnabled": true
      },
      {
        "name": "websocket",
        "port": 3003,
        "path": "/ws"
      }
    ],
    "sslEnabled": true
  }
}' http://localhost:3000