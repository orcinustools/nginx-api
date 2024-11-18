#!/usr/bin/env -S deno run --allow-read --allow-write

import { parse as parseFlags } from "https://deno.land/std/flags/mod.ts";
import { NginxConfig } from "../types.ts";

interface ParsedBlock {
  [key: string]: string | string[] | ParsedBlock | ParsedBlock[];
  _directives?: string | string[];
}

class NginxParser {
  private currentPos = 0;

  parseBlock(text: string, start: number): [ParsedBlock, number] {
    const result: ParsedBlock = {};
    let current = start;
    const buffer: string[] = [];
    let key: string | null = null;

    while (current < text.length) {
      const char = text[current];

      if (char === '{') {
        if (key === null && buffer.length) {
          key = buffer.join('').trim();
          buffer.length = 0;
        }
        const [nestedResult, newPos] = this.parseBlock(text, current + 1);
        if (key in result) {
          if (!Array.isArray(result[key])) {
            result[key] = [result[key] as ParsedBlock];
          }
          (result[key] as ParsedBlock[]).push(nestedResult);
        } else {
          result[key!] = nestedResult;
        }
        current = newPos;
        key = null;
        continue;
      }

      else if (char === '}') {
        if (buffer.length) {
          const value = buffer.join('').trim();
          if (value) {
            if (key === null) {
              key = '_directives';
            }
            if (key in result) {
              if (!Array.isArray(result[key])) {
                result[key] = [result[key] as string];
              }
              (result[key] as string[]).push(value);
            } else {
              result[key] = value;
            }
          }
        }
        return [result, current + 1];
      }

      else if (char === ';') {
        const value = buffer.join('').trim();
        if (value) {
          if (key === null) {
            key = '_directives';
          }
          if (key in result) {
            if (!Array.isArray(result[key])) {
              result[key] = [result[key] as string];
            }
            (result[key] as string[]).push(value);
          } else {
            result[key] = value;
          }
        }
        buffer.length = 0;
        key = null;
      }

      else {
        buffer.push(char);
      }

      current++;
    }

    return [result, current];
  }

  parse(configText: string): ParsedBlock {
    // Remove comments
    configText = configText.replace(/#.*$/gm, '');
    // Normalize whitespace
    configText = configText.replace(/\s+/g, ' ');
    const [result] = this.parseBlock(configText, 0);
    return result;
  }
}

class NginxToJSON {
  private parser = new NginxParser();

  private extractDomainFromServerName(serverName: string): string {
    return serverName.split(' ')[0];
  }

  private parseSSLConfig(directives: string[]): Record<string, unknown> {
    const sslConfig: Record<string, unknown> = {};
    for (const directive of directives) {
      if (directive.startsWith('ssl_certificate ')) {
        sslConfig.certificate = directive.split(' ', 2)[1];
      } else if (directive.startsWith('ssl_certificate_key ')) {
        sslConfig.certificateKey = directive.split(' ', 2)[1];
      } else if (directive.startsWith('ssl_protocols ')) {
        sslConfig.protocols = directive.split(' ').slice(1);
      } else if (directive.startsWith('ssl_ciphers ')) {
        sslConfig.ciphers = directive.split(' ', 2)[1].split(':');
      } else if (directive === 'ssl_prefer_server_ciphers on') {
        sslConfig.preferServerCiphers = true;
      } else if (directive.startsWith('ssl_dhparam ')) {
        sslConfig.dhParam = directive.split(' ', 2)[1];
      } else if (directive === 'ssl_stapling on') {
        sslConfig.ocspStapling = true;
      } else if (directive.startsWith('ssl_session_timeout ')) {
        sslConfig.sessionTimeout = directive.split(' ', 2)[1];
      }
    }
    return sslConfig;
  }

  private parseLocation(locationData: ParsedBlock): Record<string, unknown> {
    const location: Record<string, unknown> = {};
    const path = (locationData.location as string).split(' ', 2)[0];
    location.path = path;

    if (!locationData._directives) {
      return location;
    }

    const directives = Array.isArray(locationData._directives) 
      ? locationData._directives 
      : [locationData._directives];

    for (const directive of directives) {
      const parts = directive.split(' ');
      if (directive.startsWith('root ')) {
        location.root = parts[1];
      } else if (directive.startsWith('index ')) {
        location.index = parts.slice(1).join(' ');
      } else if (directive.startsWith('try_files ')) {
        location.try_files = parts.slice(1).join(' ');
      } else if (directive.startsWith('proxy_pass ')) {
        location.proxyPass = parts[1];
      } else if (directive.startsWith('fastcgi_pass ')) {
        if (!location.php) {
          location.php = { enabled: true };
        }
        (location.php as Record<string, unknown>).socketPath = parts[1];
      } else if (directive.startsWith('proxy_cache_valid ')) {
        if (!location.cache) {
          location.cache = { enabled: true };
        }
        (location.cache as Record<string, unknown>).validTime = parts[1];
      } else if (directive.startsWith('proxy_cache_key ')) {
        if (!location.cache) {
          location.cache = { enabled: true };
        }
        (location.cache as Record<string, unknown>).keys = parts.slice(1);
      } else if (directive.startsWith('proxy_cache_use_stale ')) {
        if (!location.cache) {
          location.cache = { enabled: true };
        }
        (location.cache as Record<string, unknown>).useStale = parts.slice(1);
      } else if (directive.startsWith('limit_req ')) {
        if (!location.rateLimit) {
          location.rateLimit = {};
        }
        for (const part of parts.slice(1)) {
          if (part.startsWith('rate=')) {
            (location.rateLimit as Record<string, unknown>).rate = part.slice(5);
          } else if (part.startsWith('burst=')) {
            (location.rateLimit as Record<string, unknown>).burstSize = parseInt(part.slice(6));
          } else if (part === 'nodelay') {
            (location.rateLimit as Record<string, unknown>).nodelay = true;
          }
        }
      } else if (directive.startsWith('add_header Access-Control-')) {
        if (!location.cors) {
          location.cors = { enabled: true };
        }
        const corsConfig = location.cors as Record<string, unknown>;
        if (directive.includes('Allow-Origin')) {
          corsConfig.origins = [parts[parts.length - 1].replace(/['"]/g, '')];
        } else if (directive.includes('Allow-Methods')) {
          corsConfig.methods = parts[parts.length - 1].replace(/['"]/g, '').split(',').map(m => m.trim());
        } else if (directive.includes('Allow-Headers')) {
          corsConfig.headers = parts[parts.length - 1].replace(/['"]/g, '').split(',').map(h => h.trim());
        } else if (directive.includes('Allow-Credentials')) {
          corsConfig.credentials = parts[parts.length - 1].replace(/['"]/g, '') === 'true';
        }
      } else if (/^(expires|add_header|access_log)/.test(directive)) {
        if (!location.extraDirectives) {
          location.extraDirectives = [];
        }
        (location.extraDirectives as string[]).push(directive);
      }
    }

    return location;
  }

  private parseServer(serverData: ParsedBlock): Record<string, unknown> {
    const config: Record<string, unknown> = {};

    if (!serverData._directives) {
      return config;
    }

    const directives = Array.isArray(serverData._directives)
      ? serverData._directives
      : [serverData._directives];

    // Process server directives
    for (const directive of directives) {
      const parts = directive.split(' ');
      if (directive.startsWith('server_name ')) {
        config.serverName = parts.slice(1).join(' ');
        config.domain = this.extractDomainFromServerName(config.serverName as string);
      } else if (directive.startsWith('listen ')) {
        config.port = parseInt(parts[1].match(/\d+/)![0]);
        if (parts.includes('ssl')) {
          if (!config.ssl) {
            config.ssl = {};
          }
        }
      } else if (directive.startsWith('client_max_body_size ')) {
        config.clientMaxBodySize = parts[1];
      } else if (directive === 'gzip on') {
        config.gzip = true;
      } else if (directive.startsWith('gzip_types ')) {
        config.gzipTypes = parts.slice(1);
      }
    }

    // Process SSL configuration
    const sslDirectives = directives.filter(d => d.startsWith('ssl_'));
    if (sslDirectives.length) {
      config.ssl = this.parseSSLConfig(sslDirectives);
    }

    // Process security headers
    const securityHeaders: Record<string, unknown> = {};
    for (const directive of directives) {
      if (directive.startsWith('add_header ')) {
        const parts = directive.split(' ');
        const header = parts[1];
        const value = parts.slice(2).join(' ').replace(/;$/, '').replace(/^["']|["']$/g, '');

        if (header === 'X-Frame-Options') {
          securityHeaders.xFrameOptions = value;
        } else if (header === 'X-Content-Type-Options') {
          securityHeaders.xContentTypeOptions = true;
        } else if (header === 'X-XSS-Protection') {
          securityHeaders.xXSSProtection = true;
        } else if (header === 'Referrer-Policy') {
          securityHeaders.referrerPolicy = value;
        } else if (header === 'Content-Security-Policy') {
          securityHeaders.contentSecurityPolicy = value.split(';').map(p => p.trim());
        }
      }
    }

    if (Object.keys(securityHeaders).length) {
      config.security = securityHeaders;
    }

    // Process locations
    if ('location' in serverData) {
      const locations = Array.isArray(serverData.location)
        ? serverData.location as ParsedBlock[]
        : [serverData.location as ParsedBlock];

      config.locations = locations.map(loc => this.parseLocation(loc));
    }

    return config;
  }

  convert(nginxConfig: string): Record<string, unknown> | Record<string, unknown>[] {
    const parsed = this.parser.parse(nginxConfig);

    // Handle http context
    if ('http' in parsed) {
      parsed.http = parsed.http as ParsedBlock;
    }

    // Find server blocks
    if (!('server' in parsed)) {
      return {};
    }

    const servers = Array.isArray(parsed.server)
      ? parsed.server as ParsedBlock[]
      : [parsed.server as ParsedBlock];

    // Convert each server block
    const configs = servers.map(server => this.parseServer(server));
    return configs.length === 1 ? configs[0] : configs;
  }
}

async function main() {
  const flags = parseFlags(Deno.args, {
    boolean: ['pretty', 'validate'],
    string: ['output'],
    alias: { o: 'output' },
  });

  if (flags._.length !== 1) {
    console.error('Usage: nginx2json.ts <input-file> [options]');
    console.error('Options:');
    console.error('  -o, --output <file>  Output file (default: stdout)');
    console.error('  --pretty             Pretty print JSON output');
    console.error('  --validate           Validate output against API schema');
    Deno.exit(1);
  }

  try {
    const inputFile = flags._[0].toString();
    const nginxConfig = await Deno.readTextFile(inputFile);

    const converter = new NginxToJSON();
    const result = converter.convert(nginxConfig);

    if (flags.validate) {
      try {
        const { validateConfig } = await import('../validator.ts');
        const errors = validateConfig(result as NginxConfig);
        if (errors.length > 0) {
          console.error('Validation errors:');
          for (const error of errors) {
            console.error(`- ${error.field}: ${error.message}`);
          }
          Deno.exit(1);
        }
      } catch (error) {
        console.error('Warning: Validation module not found');
      }
    }

    const jsonOutput = JSON.stringify(result, null, flags.pretty ? 2 : undefined);

    if (flags.output) {
      await Deno.writeTextFile(flags.output, jsonOutput);
    } else {
      console.log(jsonOutput);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}