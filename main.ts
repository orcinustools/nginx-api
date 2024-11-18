import { serve } from "https://deno.land/std@0.140.0/http/server.ts";
import { NginxConfig } from "./types.ts";
import { validateConfig } from "./validator.ts";
import { templates } from "./templates.ts";
import { generateNginxConfig } from "./generator.ts";

interface ConfigRequest {
    template?: string;
    templateParams?: Record<string, any>;
    config?: NginxConfig;
}

async function handler(req: Request): Promise<Response> {
    if (req.method === "POST") {
        try {
            const data: ConfigRequest = await req.json();
            let config: NginxConfig;

            if (data.template && data.templateParams) {
                if (!templates[data.template]) {
                    return new Response(JSON.stringify({
                        error: `Template '${data.template}' not found`,
                        availableTemplates: Object.keys(templates)
                    }), {
                        status: 400,
                        headers: { "Content-Type": "application/json" }
                    });
                }
                config = templates[data.template](data.templateParams);
            } else if (data.config) {
                config = data.config;
            } else {
                return new Response(JSON.stringify({
                    error: "Either template and templateParams or config must be provided",
                    availableTemplates: Object.keys(templates)
                }), {
                    status: 400,
                    headers: { "Content-Type": "application/json" }
                });
            }

            // Validate configuration
            const errors = validateConfig(config);
            if (errors.length > 0) {
                return new Response(JSON.stringify({
                    error: "Configuration validation failed",
                    validationErrors: errors
                }), {
                    status: 400,
                    headers: { "Content-Type": "application/json" }
                });
            }

            // Generate and save configuration
            const nginxConfig = generateNginxConfig(config);
            const fileName = `${config.domain}.conf`;
            await Deno.writeTextFile(fileName, nginxConfig);

            return new Response(JSON.stringify({
                success: true,
                config: nginxConfig,
                fileName,
                template: data.template
            }), {
                headers: { "Content-Type": "application/json" }
            });
        } catch (error) {
            return new Response(JSON.stringify({
                error: error.message
            }), {
                status: 500,
                headers: { "Content-Type": "application/json" }
            });
        }
    } else if (req.method === "GET") {
        return new Response(JSON.stringify({
            availableTemplates: Object.keys(templates),
            documentation: {
                templates: {
                    static: {
                        description: "Basic static website configuration",
                        params: {
                            domain: "Domain name (required)",
                            rootPath: "Root path for static files (required)",
                            sslEnabled: "Enable SSL configuration (optional, default: false)"
                        }
                    },
                    spa: {
                        description: "Single Page Application configuration",
                        params: {
                            domain: "Domain name (required)",
                            rootPath: "Root path for SPA files (required)",
                            apiUrl: "Backend API URL (optional)",
                            sslEnabled: "Enable SSL configuration (optional, default: false)"
                        }
                    },
                    wordpress: {
                        description: "WordPress configuration",
                        params: {
                            domain: "Domain name (required)",
                            rootPath: "Root path for WordPress files (required)",
                            phpVersion: "PHP version (optional, default: 8.1)",
                            sslEnabled: "Enable SSL configuration (optional, default: false)"
                        }
                    },
                    microservices: {
                        description: "Microservices configuration",
                        params: {
                            domain: "Domain name (required)",
                            services: "Array of service configurations (required)",
                            sslEnabled: "Enable SSL configuration (optional, default: false)"
                        }
                    }
                }
            }
        }), {
            headers: { "Content-Type": "application/json" }
        });
    }

    return new Response(JSON.stringify({
        error: "Method not allowed"
    }), {
        status: 405,
        headers: { "Content-Type": "application/json" }
    });
}

console.log(`Server running on http://localhost:${Deno.env.get("PORT") || 3005}`);
await serve(handler, { port: Deno.env.get("PORT") || 3005 });