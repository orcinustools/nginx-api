import { NginxConfig } from "./types.ts";

export function generateNginxConfig(config: NginxConfig): string {
  let nginxConfig = '';

  // Generate upstream blocks if defined
  if (config.upstreams) {
    for (const [name, servers] of Object.entries(config.upstreams)) {
      nginxConfig += `upstream ${name} {\n`;
      servers.forEach(server => {
        let serverConfig = `    server ${server.address}`;
        if (server.weight) serverConfig += ` weight=${server.weight}`;
        if (server.maxFails) serverConfig += ` max_fails=${server.maxFails}`;
        if (server.failTimeout) serverConfig += ` fail_timeout=${server.failTimeout}`;
        nginxConfig += serverConfig + ';\n';
      });
      nginxConfig += '}\n\n';
    }
  }

  // Generate HTTP to HTTPS redirect if needed
  if (config.ssl?.forceRedirect) {
    nginxConfig += `server {
    listen 80;
    server_name ${config.serverName};
    return 301 https://$server_name$request_uri;
}\n\n`;
  }

  // Generate microservices routes if defined
  if (config.microservices) {
    config.microservices.forEach(ms => {
      const location = {
        path: ms.path,
        proxyPass: `http://${ms.upstream}`,
        extraDirectives: []
      };

      if (ms.rewrite) {
        location.extraDirectives?.push(`rewrite ${ms.rewrite}`);
      }

      if (ms.stripPath) {
        location.extraDirectives?.push('rewrite ^/[^/]+/(.*) /$1 break');
      }

      if (ms.methods) {
        location.extraDirectives?.push(`limit_except ${ms.methods.join(' ')} { deny all; }`);
      }

      if (ms.cors?.enabled) {
        location.extraDirectives?.push(
          `add_header 'Access-Control-Allow-Origin' '${ms.cors.origins?.join(' ') || '*'}'`,
          `add_header 'Access-Control-Allow-Methods' '${ms.cors.methods?.join(' ') || 'GET, POST, OPTIONS'}'`,
          `add_header 'Access-Control-Allow-Headers' '${ms.cors.headers?.join(' ') || 'DNT,X-CustomHeader,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type'}'`
        );
        if (ms.cors.credentials) {
          location.extraDirectives?.push(`add_header 'Access-Control-Allow-Credentials' 'true'`);
        }
      }

      config.locations.push(location);
    });
  }

  // Generate location blocks
  const locations = config.locations.map(loc => {
    let locationConfig = `    location ${loc.path} {\n`;
    
    if (loc.proxyPass) {
      locationConfig += `        proxy_pass ${loc.proxyPass};\n`;
      locationConfig += `        proxy_set_header Host $host;\n`;
      locationConfig += `        proxy_set_header X-Real-IP $remote_addr;\n`;
      locationConfig += `        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n`;
      locationConfig += `        proxy_set_header X-Forwarded-Proto $scheme;\n`;
    }

    if (loc.websocket?.enabled) {
      locationConfig += `        proxy_http_version 1.1;\n`;
      locationConfig += `        proxy_set_header Upgrade $http_upgrade;\n`;
      locationConfig += `        proxy_set_header Connection "upgrade";\n`;
      if (loc.websocket.timeout) {
        locationConfig += `        proxy_read_timeout ${loc.websocket.timeout}s;\n`;
      }
      if (loc.websocket.keepaliveTimeout) {
        locationConfig += `        proxy_send_timeout ${loc.websocket.keepaliveTimeout}s;\n`;
        locationConfig += `        proxy_read_timeout ${loc.websocket.keepaliveTimeout}s;\n`;
      }
    }

    if (loc.root) {
      locationConfig += `        root ${loc.root};\n`;
    }

    if (loc.index) {
      locationConfig += `        index ${loc.index};\n`;
    }

    if (loc.try_files) {
      locationConfig += `        try_files ${loc.try_files};\n`;
    }

    // PHP configuration
    if (loc.php?.enabled) {
      locationConfig += `        fastcgi_pass ${loc.php.socketPath || 'unix:/var/run/php/php-fpm.sock'};\n`;
      locationConfig += '        fastcgi_index index.php;\n';
      locationConfig += '        include fastcgi_params;\n';
      if (loc.php.extraParams) {
        Object.entries(loc.php.extraParams).forEach(([key, value]) => {
          locationConfig += `        fastcgi_param ${key} ${value};\n`;
        });
      }
    }

    // Advanced cache configuration
    if (loc.cache?.enabled) {
      locationConfig += `        proxy_cache_valid ${loc.cache.validTime || '60m'};\n`;
      if (loc.cache.keys) {
        locationConfig += `        proxy_cache_key ${loc.cache.keys.join(' ')};\n`;
      }
      if (loc.cache.useStale) {
        locationConfig += `        proxy_cache_use_stale ${loc.cache.useStale.join(' ')};\n`;
      }
      if (loc.cache.minUses) {
        locationConfig += `        proxy_cache_min_uses ${loc.cache.minUses};\n`;
      }
      if (loc.cache.bypass) {
        locationConfig += `        proxy_cache_bypass ${loc.cache.bypass.join(' ')};\n`;
      }
      if (loc.cache.noCache) {
        locationConfig += `        proxy_no_cache ${loc.cache.noCache.join(' ')};\n`;
      }
      if (loc.cache.methods) {
        locationConfig += `        proxy_cache_methods ${loc.cache.methods.join(' ')};\n`;
      }
    }

    // CORS configuration
    if (loc.cors?.enabled) {
      locationConfig += `        add_header 'Access-Control-Allow-Origin' '${loc.cors.origins?.join(' ') || '*'}';\n`;
      locationConfig += `        add_header 'Access-Control-Allow-Methods' '${loc.cors.methods?.join(' ') || 'GET, POST, OPTIONS'}';\n`;
      locationConfig += `        add_header 'Access-Control-Allow-Headers' '${loc.cors.headers?.join(' ') || 'DNT,X-CustomHeader,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type'}';\n`;
      if (loc.cors.credentials) {
        locationConfig += `        add_header 'Access-Control-Allow-Credentials' 'true';\n`;
      }
    }

    // Rate limiting
    if (loc.rateLimit) {
      locationConfig += `        limit_req zone=one rate=${loc.rateLimit.rate}`;
      if (loc.rateLimit.burstSize) {
        locationConfig += ` burst=${loc.rateLimit.burstSize}`;
        if (loc.rateLimit.nodelay) {
          locationConfig += ' nodelay';
        }
      }
      locationConfig += ';\n';
    }

    if (loc.extraDirectives) {
      locationConfig += loc.extraDirectives.map(d => `        ${d};\n`).join('');
    }

    locationConfig += '    }\n';
    return locationConfig;
  }).join('\n');

  // Main server block
  let serverConfig = `server {
    listen ${config.port}${config.ssl ? ' ssl' : ''};
    server_name ${config.serverName};\n`;

  // SSL configuration
  if (config.ssl) {
    serverConfig += `
    ssl_certificate ${config.ssl.certificate};
    ssl_certificate_key ${config.ssl.certificateKey};`;
    
    if (config.ssl.protocols) {
      serverConfig += `\n    ssl_protocols ${config.ssl.protocols.join(' ')};`;
    }
    if (config.ssl.ciphers) {
      serverConfig += `\n    ssl_ciphers ${config.ssl.ciphers.join(':')};`;
    }
    if (config.ssl.preferServerCiphers) {
      serverConfig += `\n    ssl_prefer_server_ciphers on;`;
    }
    if (config.ssl.dhParam) {
      serverConfig += `\n    ssl_dhparam ${config.ssl.dhParam};`;
    }
    if (config.ssl.ocspStapling) {
      serverConfig += `\n    ssl_stapling on;\n    ssl_stapling_verify on;`;
    }
    if (config.ssl.sessionTimeout) {
      serverConfig += `\n    ssl_session_timeout ${config.ssl.sessionTimeout};`;
    }
    if (config.ssl.sessionTickets === false) {
      serverConfig += `\n    ssl_session_tickets off;`;
    }
    if (config.ssl.hsts?.enabled) {
      let hstsDirective = `\n    add_header Strict-Transport-Security "max-age=${config.ssl.hsts.maxAge || 31536000}`;
      if (config.ssl.hsts.includeSubdomains) {
        hstsDirective += '; includeSubDomains';
      }
      if (config.ssl.hsts.preload) {
        hstsDirective += '; preload';
      }
      hstsDirective += '";';
      serverConfig += hstsDirective;
    }
  }

  // Security headers
  if (config.security) {
    if (config.security.xFrameOptions) {
      serverConfig += `\n    add_header X-Frame-Options "${config.security.xFrameOptions}";`;
    }
    if (config.security.xContentTypeOptions) {
      serverConfig += `\n    add_header X-Content-Type-Options "nosniff";`;
    }
    if (config.security.xXSSProtection) {
      serverConfig += `\n    add_header X-XSS-Protection "1; mode=block";`;
    }
    if (config.security.referrerPolicy) {
      serverConfig += `\n    add_header Referrer-Policy "${config.security.referrerPolicy}";`;
    }
    if (config.security.contentSecurityPolicy) {
      serverConfig += `\n    add_header Content-Security-Policy "${config.security.contentSecurityPolicy.join('; ')}";`;
    }
  }

  if (config.clientMaxBodySize) {
    serverConfig += `\n    client_max_body_size ${config.clientMaxBodySize};`;
  }

  // Gzip configuration
  if (config.gzip) {
    serverConfig += `\n    gzip on;`;
    if (config.gzipTypes) {
      serverConfig += `\n    gzip_types ${config.gzipTypes.join(' ')};`;
    } else {
      serverConfig += `\n    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;`;
    }
  }

  serverConfig += `\n\n${locations}}`;
  nginxConfig += serverConfig;
  return nginxConfig;
}