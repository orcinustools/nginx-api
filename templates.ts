import { NginxConfig } from "./types.ts";

export const templates: { [key: string]: (params: any) => NginxConfig } = {
  static: (params: {
    domain: string;
    rootPath: string;
    sslEnabled?: boolean;
  }): NginxConfig => ({
    domain: params.domain,
    serverName: `${params.domain} www.${params.domain}`,
    port: params.sslEnabled ? 443 : 80,
    ...(params.sslEnabled && {
      ssl: {
        certificate: `/etc/letsencrypt/live/${params.domain}/fullchain.pem`,
        certificateKey: `/etc/letsencrypt/live/${params.domain}/privkey.pem`,
        forceRedirect: true
      }
    }),
    gzip: true,
    locations: [
      {
        path: "/",
        root: params.rootPath,
        index: "index.html",
        try_files: "$uri $uri/ =404"
      },
      {
        path: "/assets",
        root: params.rootPath,
        extraDirectives: [
          "expires 30d",
          "add_header Cache-Control public"
        ]
      }
    ]
  }),

  spa: (params: {
    domain: string;
    rootPath: string;
    apiUrl?: string;
    sslEnabled?: boolean;
  }): NginxConfig => ({
    domain: params.domain,
    serverName: `${params.domain} www.${params.domain}`,
    port: params.sslEnabled ? 443 : 80,
    ...(params.sslEnabled && {
      ssl: {
        certificate: `/etc/letsencrypt/live/${params.domain}/fullchain.pem`,
        certificateKey: `/etc/letsencrypt/live/${params.domain}/privkey.pem`,
        forceRedirect: true
      }
    }),
    gzip: true,
    security: {
      xFrameOptions: "DENY",
      xContentTypeOptions: true,
      xXSSProtection: true
    },
    locations: [
      {
        path: "/",
        root: params.rootPath,
        index: "index.html",
        try_files: "$uri $uri/ /index.html"
      },
      ...(params.apiUrl ? [{
        path: "/api",
        proxyPass: params.apiUrl,
        cors: {
          enabled: true,
          origins: [`https://${params.domain}`],
          methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
          headers: ["Authorization", "Content-Type"],
          credentials: true
        }
      }] : []),
      {
        path: "/assets",
        root: params.rootPath,
        extraDirectives: [
          "expires 30d",
          "add_header Cache-Control public"
        ]
      }
    ]
  }),

  wordpress: (params: {
    domain: string;
    rootPath: string;
    phpVersion?: string;
    sslEnabled?: boolean;
  }): NginxConfig => ({
    domain: params.domain,
    serverName: `${params.domain} www.${params.domain}`,
    port: params.sslEnabled ? 443 : 80,
    ...(params.sslEnabled && {
      ssl: {
        certificate: `/etc/letsencrypt/live/${params.domain}/fullchain.pem`,
        certificateKey: `/etc/letsencrypt/live/${params.domain}/privkey.pem`,
        forceRedirect: true
      }
    }),
    gzip: true,
    clientMaxBodySize: "64M",
    locations: [
      {
        path: "/",
        root: params.rootPath,
        index: "index.php",
        try_files: "$uri $uri/ /index.php?$args",
        php: {
          enabled: true,
          socketPath: `/var/run/php/php${params.phpVersion || "8.1"}-fpm.sock`,
          extraParams: {
            "SCRIPT_FILENAME": "$document_root$fastcgi_script_name",
            "PATH_INFO": "$fastcgi_path_info"
          }
        }
      },
      {
        path: "~ \\.php$",
        php: {
          enabled: true,
          socketPath: `/var/run/php/php${params.phpVersion || "8.1"}-fpm.sock`,
          extraParams: {
            "SCRIPT_FILENAME": "$document_root$fastcgi_script_name",
            "PATH_INFO": "$fastcgi_path_info"
          }
        }
      },
      {
        path: "/wp-content",
        root: params.rootPath,
        extraDirectives: [
          "expires 30d",
          "add_header Cache-Control public"
        ]
      }
    ]
  }),

  microservices: (params: {
    domain: string;
    services: {
      name: string;
      port: number;
      path: string;
      methods?: string[];
      corsEnabled?: boolean;
    }[];
    sslEnabled?: boolean;
  }): NginxConfig => ({
    domain: params.domain,
    serverName: params.domain,
    port: params.sslEnabled ? 443 : 80,
    ...(params.sslEnabled && {
      ssl: {
        certificate: `/etc/letsencrypt/live/${params.domain}/fullchain.pem`,
        certificateKey: `/etc/letsencrypt/live/${params.domain}/privkey.pem`,
        forceRedirect: true,
        protocols: ["TLSv1.2", "TLSv1.3"]
      }
    }),
    security: {
      xFrameOptions: "DENY",
      xContentTypeOptions: true,
      xXSSProtection: true,
      referrerPolicy: "strict-origin-when-cross-origin"
    },
    gzip: true,
    upstreams: Object.fromEntries(
      params.services.map(svc => [
        svc.name,
        [{ address: `localhost:${svc.port}` }]
      ])
    ),
    locations: params.services.map(svc => ({
      path: svc.path,
      proxyPass: `http://${svc.name}`,
      ...(svc.methods && {
        extraDirectives: [`limit_except ${svc.methods.join(" ")} { deny all; }`]
      }),
      ...(svc.corsEnabled && {
        cors: {
          enabled: true,
          origins: [`https://${params.domain}`],
          methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
          headers: ["Authorization", "Content-Type"],
          credentials: true
        }
      })
    }))
  })
};