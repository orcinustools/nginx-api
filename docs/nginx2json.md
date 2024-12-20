# nginx2json Converter - Convert Nginx to JSON

The `nginx2json.ts` tool helps you convert existing Nginx configurations to JSON format that's compatible with this API. This is useful when:
- Migrating existing Nginx configurations to use with this API
- Converting legacy configurations to a structured format
- Analyzing and validating Nginx configurations
- Generating documentation from existing setups

#### Key Features
- Parses complex Nginx configurations
- Supports all major Nginx directives
- Validates output against API schema
- Pretty printing for readability
- Handles multiple server blocks
- Preserves comments and structure

#### Installation

```bash
chmod +x tools/nginx2json.ts
```

#### Usage

```bash
luwak tools/nginx2json.ts input.conf [options]
```

Options:
- `-o, --output`: Output JSON file (default: stdout)
- `--pretty`: Pretty print JSON output
- `--validate`: Validate output against API schema

#### Examples

1. Convert a configuration file:
```bash
luwak tools/nginx2json.ts /etc/nginx/sites-available/example.com --pretty
```

2. Convert and save to file:
```bash
luwak tools/nginx2json.ts input.conf -o output.json --pretty
```

3. Convert and validate:
```bash
luwak tools/nginx2json.ts input.conf --validate --pretty
```

#### Supported Nginx Features

The converter handles a wide range of Nginx configurations:

1. **Server Configuration**
   - Multiple server blocks
   - Server names and aliases
   - Listen directives with ports and SSL
   - Client body size limits
   - Root directory settings

2. **SSL/TLS Configuration**
   ```nginx
   ssl_certificate /path/to/cert.pem;
   ssl_certificate_key /path/to/key.pem;
   ssl_protocols TLSv1.2 TLSv1.3;
   ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256;
   ssl_prefer_server_ciphers on;
   ssl_session_timeout 1d;
   ssl_session_tickets off;
   ssl_stapling on;
   ssl_stapling_verify on;
   ```

3. **Security Headers**
   ```nginx
   add_header X-Frame-Options "DENY";
   add_header X-Content-Type-Options "nosniff";
   add_header X-XSS-Protection "1; mode=block";
   add_header Content-Security-Policy "default-src 'self'";
   add_header Strict-Transport-Security "max-age=31536000";
   ```

4. **Location Blocks**
   ```nginx
   location / {
       try_files $uri $uri/ /index.html;
   }

   location /api {
       proxy_pass http://backend;
   }

   location ~ \.php$ {
       fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
   }
   ```

5. **Load Balancing**
   ```nginx
   upstream backend {
       server 10.0.0.1:8080 weight=3;
       server 10.0.0.2:8080 weight=2;
       server backup.example.com:8080 backup;
   }
   ```

6. **Caching**
   ```nginx
   proxy_cache_path /path/to/cache levels=1:2 keys_zone=my_cache:10m;
   location /api {
       proxy_cache my_cache;
       proxy_cache_use_stale error timeout;
       proxy_cache_valid 200 60m;
   }
   ```

7. **Rate Limiting**
   ```nginx
   limit_req_zone $binary_remote_addr zone=one:10m rate=1r/s;
   location /api {
       limit_req zone=one burst=5 nodelay;
   }
   ```

8. **CORS Configuration**
   ```nginx
   location /api {
       add_header 'Access-Control-Allow-Origin' '*';
       add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS';
       add_header 'Access-Control-Allow-Headers' 'DNT,X-CustomHeader,Keep-Alive,User-Agent';
   }
   ```

9. **WebSocket Support**
   ```nginx
   location /ws {
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
   }
   ```

10. **PHP-FPM Configuration**
    ```nginx
    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
    ```

11. **Static File Handling**
    ```nginx
    location /static {
        expires 30d;
        add_header Cache-Control "public, no-transform";
        access_log off;
    }
    ```

12. **Compression**
    ```nginx
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
    gzip_min_length 1000;
    gzip_comp_level 6;
    ```

#### Common Use Cases

1. **Converting Legacy Configurations**
   ```bash
   # Convert a single configuration file
   luwak tools/nginx2json.ts /etc/nginx/sites-available/old-config.conf -o new-config.json

   # Convert and validate against API schema
   luwak tools/nginx2json.ts old-config.conf --validate --pretty
   ```

2. **Migrating Multiple Sites**
   ```bash
   # Create a script to process multiple files
   for conf in /etc/nginx/sites-available/*; do
     luwak tools/nginx2json.ts "$conf" -o "$(basename "$conf").json" --pretty
   done
   ```

3. **Configuration Analysis**
   ```bash
   # Convert to JSON for analysis
   luwak tools/nginx2json.ts nginx.conf --pretty | jq '.locations | length'
   ```

4. **Template Generation**
   ```bash
   # Convert existing config to use as template
   luwak tools/nginx2json.ts template.conf --pretty > template.json
   ```

5. **Validation and Testing**
   ```bash
   # Convert and validate configuration
   luwak tools/nginx2json.ts test.conf --validate --pretty
   ```

#### Example Configurations

1. **Static Website with SSL**

Input:
```nginx
server {
    listen 443 ssl http2;
    server_name example.com;
    
    ssl_certificate /etc/ssl/example.com.crt;
    ssl_certificate_key /etc/ssl/example.com.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    
    root /var/www/example;
    index index.html;

    # Security headers
    add_header X-Frame-Options "DENY";
    add_header X-Content-Type-Options "nosniff";
    
    location / {
        try_files $uri $uri/ =404;
        expires 30d;
        add_header Cache-Control "public";
    }
}
```

Output:
```json
{
  "domain": "example.com",
  "serverName": "example.com",
  "port": 443,
  "ssl": {
    "certificate": "/etc/ssl/example.com.crt",
    "certificateKey": "/etc/ssl/example.com.key",
    "protocols": ["TLSv1.2", "TLSv1.3"]
  },
  "security": {
    "xFrameOptions": "DENY",
    "xContentTypeOptions": true
  },
  "locations": [
    {
      "path": "/",
      "root": "/var/www/example",
      "index": "index.html",
      "try_files": "$uri $uri/ =404",
      "extraDirectives": [
        "expires 30d",
        "add_header Cache-Control \"public\""
      ]
    }
  ]
}
```

2. **Microservices with Load Balancing**

Input:
```nginx
upstream auth_service {
    server 10.0.0.1:3000 weight=3;
    server 10.0.0.2:3000 weight=2;
}

upstream api_service {
    server 10.0.0.3:3000;
    server 10.0.0.4:3000;
}

server {
    listen 443 ssl;
    server_name api.example.com;

    ssl_certificate /etc/ssl/api.example.com.crt;
    ssl_certificate_key /etc/ssl/api.example.com.key;

    location /auth {
        proxy_pass http://auth_service;
        proxy_set_header Host $host;
        limit_req zone=one rate=10r/s burst=20;
    }

    location /api {
        proxy_pass http://api_service;
        proxy_cache api_cache;
        proxy_cache_valid 200 60m;
    }
}
```

Output:
```json
{
  "domain": "api.example.com",
  "serverName": "api.example.com",
  "port": 443,
  "ssl": {
    "certificate": "/etc/ssl/api.example.com.crt",
    "certificateKey": "/etc/ssl/api.example.com.key"
  },
  "upstreams": {
    "auth_service": [
      {
        "address": "10.0.0.1:3000",
        "weight": 3
      },
      {
        "address": "10.0.0.2:3000",
        "weight": 2
      }
    ],
    "api_service": [
      {
        "address": "10.0.0.3:3000"
      },
      {
        "address": "10.0.0.4:3000"
      }
    ]
  },
  "locations": [
    {
      "path": "/auth",
      "proxyPass": "http://auth_service",
      "rateLimit": {
        "rate": "10r/s",
        "burstSize": 20
      }
    },
    {
      "path": "/api",
      "proxyPass": "http://api_service",
      "cache": {
        "enabled": true,
        "validTime": "60m"
      }
    }
  ]
}
```

3. **WordPress with PHP-FPM**

Input:
```nginx
server {
    listen 443 ssl;
    server_name blog.example.com;
    root /var/www/wordpress;

    client_max_body_size 64M;

    location / {
        try_files $uri $uri/ /index.php?$args;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location /wp-content {
        expires 30d;
        add_header Cache-Control "public";
    }
}
```

Output:
```json
{
  "domain": "blog.example.com",
  "serverName": "blog.example.com",
  "port": 443,
  "clientMaxBodySize": "64M",
  "locations": [
    {
      "path": "/",
      "root": "/var/www/wordpress",
      "try_files": "$uri $uri/ /index.php?$args"
    },
    {
      "path": "~ \\.php$",
      "php": {
        "enabled": true,
        "socketPath": "unix:/var/run/php/php8.2-fpm.sock",
        "extraParams": {
          "SCRIPT_FILENAME": "$document_root$fastcgi_script_name"
        }
      }
    },
    {
      "path": "/wp-content",
      "extraDirectives": [
        "expires 30d",
        "add_header Cache-Control \"public\""
      ]
    }
  ]
}
```

#### Error Handling and Troubleshooting

1. **Syntax Errors**
   ```bash
   $ luwak tools/nginx2json.ts invalid.conf
   Error: Unexpected token at line 5: "server {"
   ```

2. **Validation Errors**
   ```bash
   $ luwak tools/nginx2json.ts config.conf --validate
   Validation errors:
   - domain: Invalid domain format
   - port: Port must be a number between 1 and 65535
   ```

3. **Common Issues**

   - **Missing Semicolons**: The parser will fail if Nginx directives are missing semicolons
   ```nginx
   # Wrong
   server_name example.com
   
   # Correct
   server_name example.com;
   ```

   - **Unmatched Braces**: Configuration blocks must have matching braces
   ```nginx
   # Wrong
   server {
     location / {
       root /var/www;
   }
   
   # Correct
   server {
     location / {
       root /var/www;
     }
   }
   ```

   - **Invalid Directives**: Unknown directives will be included in extraDirectives
   ```nginx
   location / {
     unknown_directive value;  # Will be included in extraDirectives
   }
   ```

4. **Debug Mode**
   ```bash
   # Enable debug output
   DEBUG=1 luwak tools/nginx2json.ts config.conf
   ```

5. **Common Solutions**

   - **Parse Error**: Check for syntax errors in the Nginx configuration
   - **Validation Error**: Ensure the configuration matches the API schema
   - **Missing Data**: Some directives might not be supported, check documentation
   - **Conversion Error**: Try running with DEBUG=1 for more information
