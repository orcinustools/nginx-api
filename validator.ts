import { NginxConfig } from "./types.ts";

interface ValidationError {
    field: string;
    message: string;
}

export function validateConfig(config: NginxConfig): ValidationError[] {
    const errors: ValidationError[] = [];

    // Required fields
    if (!config.domain) {
        errors.push({ field: "domain", message: "Domain is required" });
    } else if (!/^[a-zA-Z0-9][a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}$/.test(config.domain)) {
        errors.push({ field: "domain", message: "Invalid domain format" });
    }

    if (!config.serverName) {
        errors.push({ field: "serverName", message: "Server name is required" });
    }

    if (typeof config.port !== "number" || config.port < 1 || config.port > 65535) {
        errors.push({ field: "port", message: "Port must be a number between 1 and 65535" });
    }

    // SSL Configuration
    if (config.ssl) {
        if (!config.ssl.certificate) {
            errors.push({ field: "ssl.certificate", message: "SSL certificate path is required" });
        }
        if (!config.ssl.certificateKey) {
            errors.push({ field: "ssl.certificateKey", message: "SSL certificate key path is required" });
        }
        if (config.ssl.protocols && !config.ssl.protocols.every(p => ["SSLv2", "SSLv3", "TLSv1", "TLSv1.1", "TLSv1.2", "TLSv1.3"].includes(p))) {
            errors.push({ field: "ssl.protocols", message: "Invalid SSL protocol specified" });
        }
        if (config.ssl.hsts?.maxAge && (typeof config.ssl.hsts.maxAge !== "number" || config.ssl.hsts.maxAge < 0)) {
            errors.push({ field: "ssl.hsts.maxAge", message: "HSTS max age must be a positive number" });
        }
    }

    // Security Headers
    if (config.security?.xFrameOptions && !["DENY", "SAMEORIGIN", "ALLOW-FROM"].includes(config.security.xFrameOptions)) {
        errors.push({ field: "security.xFrameOptions", message: "Invalid X-Frame-Options value" });
    }

    // Locations
    if (!config.locations || config.locations.length === 0) {
        errors.push({ field: "locations", message: "At least one location block is required" });
    } else {
        config.locations.forEach((loc, index) => {
            if (!loc.path) {
                errors.push({ field: `locations[${index}].path`, message: "Location path is required" });
            }

            if (loc.proxyPass && !isValidUrl(loc.proxyPass)) {
                errors.push({ field: `locations[${index}].proxyPass`, message: "Invalid proxy_pass URL" });
            }

            if (loc.rateLimit) {
                if (!isValidRateLimit(loc.rateLimit.rate)) {
                    errors.push({ field: `locations[${index}].rateLimit.rate`, message: "Invalid rate limit format (e.g., '10r/s')" });
                }
                if (loc.rateLimit.burstSize && (typeof loc.rateLimit.burstSize !== "number" || loc.rateLimit.burstSize < 0)) {
                    errors.push({ field: `locations[${index}].rateLimit.burstSize`, message: "Burst size must be a positive number" });
                }
            }

            if (loc.cache?.enabled) {
                if (loc.cache.minUses && (typeof loc.cache.minUses !== "number" || loc.cache.minUses < 0)) {
                    errors.push({ field: `locations[${index}].cache.minUses`, message: "Cache min uses must be a positive number" });
                }
            }

            if (loc.websocket?.enabled) {
                if (loc.websocket.timeout && (typeof loc.websocket.timeout !== "number" || loc.websocket.timeout < 0)) {
                    errors.push({ field: `locations[${index}].websocket.timeout`, message: "WebSocket timeout must be a positive number" });
                }
            }
        });
    }

    // Upstreams
    if (config.upstreams) {
        Object.entries(config.upstreams).forEach(([name, servers]) => {
            if (!servers || servers.length === 0) {
                errors.push({ field: `upstreams.${name}`, message: "Upstream must have at least one server" });
            } else {
                servers.forEach((server, index) => {
                    if (!server.address) {
                        errors.push({ field: `upstreams.${name}[${index}].address`, message: "Server address is required" });
                    }
                    if (server.weight && (typeof server.weight !== "number" || server.weight < 0)) {
                        errors.push({ field: `upstreams.${name}[${index}].weight`, message: "Weight must be a positive number" });
                    }
                    if (server.maxFails && (typeof server.maxFails !== "number" || server.maxFails < 0)) {
                        errors.push({ field: `upstreams.${name}[${index}].maxFails`, message: "Max fails must be a positive number" });
                    }
                });
            }
        });
    }

    return errors;
}

function isValidUrl(str: string): boolean {
    try {
        if (str.startsWith("unix:")) {
            return true;
        }
        new URL(str);
        return true;
    } catch {
        return false;
    }
}

function isValidRateLimit(rate: string): boolean {
    return /^\d+r\/[smhd]$/.test(rate);
}