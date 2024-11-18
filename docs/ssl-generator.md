# ssl-generator - Let's Encrypt SSL Certificate Generator

The `ssl-generator.ts` tool automates the process of obtaining SSL certificates from Let's Encrypt using the ACME protocol.

#### Features
- Automated certificate generation
- HTTP-01 challenge support
- Staging environment for testing
- Multiple domain support
- Automatic renewal support
- CSR generation
- Key management

#### Installation
```bash
chmod +x tools/ssl-generator.ts tools/challenge-server.ts
```

#### Usage
```bash
deno run --allow-read --allow-write --allow-net tools/ssl-generator.ts [options]

Options:
  -d, --domain <domain>    Domain name to generate certificate for
  -e, --email <email>      Email address for Let's Encrypt account
  -o, --output <dir>       Output directory for certificates
  -s, --staging            Use Let's Encrypt staging environment
  -h, --help              Show help message
```

#### Examples

1. **Generate Certificate for Single Domain**
```bash
deno run --allow-read --allow-write --allow-net tools/ssl-generator.ts \
  --domain example.com \
  --email admin@example.com \
  --output /etc/nginx/ssl
```

2. **Test with Staging Environment**
```bash
deno run --allow-read --allow-write --allow-net tools/ssl-generator.ts \
  --domain example.com \
  --email admin@example.com \
  --staging
```

3. **Generate Certificates for Multiple Domains**
```bash
./examples/generate-ssl.sh
```

#### Challenge Server

The tool includes a challenge server for HTTP-01 validation:

```bash
sudo deno run --allow-net --allow-read tools/challenge-server.ts
```

#### Integration with Nginx

1. **Configure SSL in Nginx**
```nginx
ssl_certificate /etc/nginx/ssl/example.com.crt;
ssl_certificate_key /etc/nginx/ssl/example.com.key;
ssl_protocols TLSv1.2 TLSv1.3;
```

2. **Auto-renewal Setup**
```bash
# Add to crontab
0 0 1 * * /path/to/generate-ssl.sh >> /var/log/ssl-renewal.log 2>&1
```

#### Error Handling

1. **Rate Limits**
   - Staging environment: Unlimited
   - Production: 50 certificates per domain per week

2. **Common Issues**
   - DNS not configured correctly
   - Port 80 not accessible
   - Invalid domain ownership
   - Network connectivity issues

3. **Troubleshooting**
   ```bash
   # Test with staging first
   deno run --allow-read --allow-write --allow-net tools/ssl-generator.ts \
     --domain example.com \
     --email admin@example.com \
     --staging
   
   # Check challenge server
   curl http://example.com/.well-known/acme-challenge/test
   
   # Verify DNS
   dig +short example.com
   ```