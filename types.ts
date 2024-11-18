export interface UpstreamServer {
    address: string;
    weight?: number;
    maxFails?: number;
    failTimeout?: string;
}

export interface CacheConfig {
    enabled: boolean;
    validTime?: string;
    keys?: string[];
    useStale?: string[];
    minUses?: number;
    bypass?: string[];
    noCache?: string[];
    noStore?: string[];
    methods?: string[];
}

export interface RateLimit {
    rate: string;
    burstSize?: number;
    nodelay?: boolean;
}

export interface SecurityHeaders {
    xFrameOptions?: string;
    xContentTypeOptions?: boolean;
    xXSSProtection?: boolean;
    strictTransport?: boolean;
    referrerPolicy?: string;
    contentSecurityPolicy?: string[];
}

export interface SSLConfig {
    certificate: string;
    certificateKey: string;
    protocols?: string[];
    forceRedirect?: boolean;
    ciphers?: string[];
    preferServerCiphers?: boolean;
    dhParam?: string;
    ocspStapling?: boolean;
    sessionTimeout?: string;
    sessionTickets?: boolean;
    hsts?: {
        enabled: boolean;
        maxAge?: number;
        includeSubdomains?: boolean;
        preload?: boolean;
    };
}

export interface WebSocketConfig {
    enabled: boolean;
    timeout?: number;
    keepaliveTimeout?: number;
}

export interface MicroserviceRoute {
    path: string;
    upstream: string;
    rewrite?: string;
    stripPath?: boolean;
    methods?: string[];
    cors?: {
        enabled: boolean;
        origins?: string[];
        methods?: string[];
        headers?: string[];
        credentials?: boolean;
    };
}

export interface NginxConfig {
    domain: string;
    serverName: string;
    port: number;
    ssl?: SSLConfig;
    security?: SecurityHeaders;
    clientMaxBodySize?: string;
    upstreams?: {
        [name: string]: UpstreamServer[];
    };
    gzip?: boolean;
    gzipTypes?: string[];
    microservices?: MicroserviceRoute[];
    locations: {
        path: string;
        proxyPass?: string;
        root?: string;
        index?: string;
        try_files?: string;
        extraDirectives?: string[];
        php?: {
            enabled: boolean;
            socketPath?: string;
            extraParams?: { [key: string]: string };
        };
        websocket?: WebSocketConfig;
        cache?: CacheConfig;
        rateLimit?: RateLimit;
        cors?: {
            enabled: boolean;
            origins?: string[];
            methods?: string[];
            headers?: string[];
            credentials?: boolean;
        };
    }[];
}