# Nginx Configuration API

A Orcinus API for generating Nginx configuration files with support for templates, validation, and advanced features.

## Features

- 🔧 Pre-defined templates for common setups
- ✅ Configuration validation
- 🔒 Advanced SSL/Security configurations
- 🚀 Microservices support
- 📝 Detailed documentation
- 🔄 WebSocket support
- 💾 Caching strategies
- ⚡ Rate limiting

## Quick Start

1. Install Deno:
```bash

```

2. Run the server:
```bash

```

The server will start on http://localhost:3000

## API Endpoints

### GET /
Returns available templates and documentation.

### POST /
Generates Nginx configuration based on template or custom configuration.

## Using Templates

### Available Templates

1. **Static Website**
```json
{
  "template": "static",
  "templateParams": {
    "domain": "example.com",
    "rootPath": "/var/www/example",
    "sslEnabled": true
  }
}
```

2. **Single Page Application (SPA)**
```json
{
  "template": "spa",
  "templateParams": {
    "domain": "myapp.com",
    "rootPath": "/var/www/myapp",
    "apiUrl": "http://api.myapp.com",
    "sslEnabled": true
  }
}
```

3. **WordPress**
```json
{
  "template": "wordpress",
  "templateParams": {
    "domain": "blog.com",
    "rootPath": "/var/www/wordpress",
    "phpVersion": "8.2",
    "sslEnabled": true
  }
}
```

4. **Microservices**
```json
{
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
      }
    ],
    "sslEnabled": true
  }
}
```

## Custom Configuration

You can also provide a custom configuration:

```json
{
  "config": {
    "domain": "custom.com",
    "serverName": "custom.com www.custom.com",
    "port": 443,
    "ssl": {
      "certificate": "/etc/ssl/custom.com.crt",
      "certificateKey": "/etc/ssl/custom.com.key",
      "protocols": ["TLSv1.2", "TLSv1.3"],
      "forceRedirect": true
    },
    "security": {
      "xFrameOptions": "DENY",
      "xContentTypeOptions": true,
      "xXSSProtection": true
    },
    "locations": [
      {
        "path": "/",
        "root": "/var/www/custom",
        "index": "index.html"
      }
    ]
  }
}
```

## Advanced Features

### SSL Configuration
```json
{
  "ssl": {
    "certificate": "/path/to/cert.pem",
    "certificateKey": "/path/to/key.pem",
    "protocols": ["TLSv1.2", "TLSv1.3"],
    "ciphers": ["ECDHE-ECDSA-AES128-GCM-SHA256"],
    "preferServerCiphers": true,
    "dhParam": "/path/to/dhparam.pem",
    "ocspStapling": true,
    "sessionTimeout": "1d",
    "hsts": {
      "enabled": true,
      "maxAge": 31536000,
      "includeSubdomains": true,
      "preload": true
    }
  }
}
```

### Security Headers
```json
{
  "security": {
    "xFrameOptions": "DENY",
    "xContentTypeOptions": true,
    "xXSSProtection": true,
    "referrerPolicy": "strict-origin-when-cross-origin",
    "contentSecurityPolicy": [
      "default-src 'self'",
      "img-src 'self' data: https:",
      "script-src 'self' 'unsafe-inline'"
    ]
  }
}
```

### WebSocket Support
```json
{
  "websocket": {
    "enabled": true,
    "timeout": 3600,
    "keepaliveTimeout": 60
  }
}
```

### Caching Configuration
```json
{
  "cache": {
    "enabled": true,
    "validTime": "30m",
    "keys": ["$host", "$request_uri"],
    "useStale": ["error", "timeout", "updating"],
    "minUses": 2,
    "bypass": ["$http_cache_control"],
    "methods": ["GET", "HEAD"]
  }
}
```

### Rate Limiting
```json
{
  "rateLimit": {
    "rate": "10r/s",
    "burstSize": 20,
    "nodelay": true
  }
}
```

### CORS Configuration
```json
{
  "cors": {
    "enabled": true,
    "origins": ["https://example.com"],
    "methods": ["GET", "POST", "OPTIONS"],
    "headers": ["Authorization", "Content-Type"],
    "credentials": true
  }
}
```

## Project Structure

- `main.ts` - Main server file
- `types.ts` - TypeScript interfaces
- `validator.ts` - Configuration validation
- `generator.ts` - Nginx config generation
- `templates.ts` - Pre-defined templates

## Validation

The API validates:
- Domain format
- Port ranges
- SSL configuration
- Security headers
- Rate limit format
- URL formats
- Required fields

## Response Format

Success Response:
```json
{
  "success": true,
  "config": "... nginx configuration ...",
  "fileName": "example.com.conf",
  "template": "static"
}
```

Error Response:
```json
{
  "error": "Configuration validation failed",
  "validationErrors": [
    {
      "field": "domain",
      "message": "Invalid domain format"
    }
  ]
}
```

## Examples

### 1. Basic Static Website
```bash
curl -X POST -H "Content-Type: application/json" -d '{
  "template": "static",
  "templateParams": {
    "domain": "example.com",
    "rootPath": "/var/www/example",
    "sslEnabled": true
  }
}' http://localhost:3000
```

### 2. WordPress Site
```bash
curl -X POST -H "Content-Type: application/json" -d '{
  "template": "wordpress",
  "templateParams": {
    "domain": "blog.com",
    "rootPath": "/var/www/wordpress",
    "phpVersion": "8.2",
    "sslEnabled": true
  }
}' http://localhost:3000
```

### 3. Microservices API
```bash
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
      }
    ],
    "sslEnabled": true
  }
}' http://localhost:3000
```

## Error Handling

The API provides detailed error messages for:
- Invalid configuration
- Missing required fields
- Invalid template names
- Invalid parameter values
- Server errors

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License