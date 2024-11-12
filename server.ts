import { Server, res, req, logger, setCORS } from "https://deno.land/x/kilat/mod.ts";
import { Parser } from "./libs/nginx-config-parser.ts";

const server = new Server();
const parser = new Parser();

// Middleware untuk error handling
const errorHandler = async (ctx: any, next: any) => {
  try {
    await next();
  } catch (error) {
    ctx.res.status = 500;
    ctx.res.body = {
      status: "error",
      message: error.message
    };
  }
};

// Middleware untuk logging
server.use(logger());

// Endpoint untuk membaca konfigurasi NGINX
server.get("/api/nginx/config", 
  res("json"),
  errorHandler,
  async (ctx: any, next: any) => {
    try {
      const config = await parser.readConfigFile("/etc/nginx/nginx.conf");
      const jsonConfig = await parser.toJSON(config);
      
      ctx.res.body = {
        status: "success",
        data: jsonConfig
      };
    } catch (error) {
      throw new Error(`Failed to read NGINX config: ${error.message}`);
    }
    
    await next();
  }
);

// Endpoint untuk menulis konfigurasi NGINX
server.post("/api/nginx/config",
  res("json"),
  req("json"),
  errorHandler,
  async (ctx: any, next: any) => {
    try {
      const configObject = ctx.body;
      const nginxConfig = parser.toConf(configObject);
      await parser.writeConfigFile("/etc/nginx/nginx.conf", nginxConfig);
      
      ctx.res.body = {
        status: "success",
        message: "Configuration updated successfully"
      };
    } catch (error) {
      throw new Error(`Failed to write NGINX config: ${error.message}`);
    }
    
    await next();
  }
);

// Endpoint untuk mendapatkan specific block configuration
server.get("/api/nginx/config/:block",
  res("json"),
  errorHandler,
  async (ctx: any, next: any) => {
    try {
      const blockName = ctx.params.block;
      const config = await parser.readConfigFile("/etc/nginx/nginx.conf");
      const jsonConfig = await parser.toJSON(config);
      
      if (!jsonConfig[blockName]) {
        ctx.res.status = 404;
        ctx.res.body = {
          status: "error",
          message: `Block '${blockName}' not found`
        };
        return;
      }
      
      ctx.res.body = {
        status: "success",
        data: {
          [blockName]: jsonConfig[blockName]
        }
      };
    } catch (error) {
      throw new Error(`Failed to read block config: ${error.message}`);
    }
    
    await next();
  }
);

// Endpoint untuk memperbarui specific block configuration
server.put("/api/nginx/config/:block",
  res("json"),
  req("json"),
  errorHandler,
  async (ctx: any, next: any) => {
    try {
      const blockName = ctx.params.block;
      const newBlockConfig = ctx.body;
      
      const config = await parser.readConfigFile("/etc/nginx/nginx.conf");
      const jsonConfig = await parser.toJSON(config);
      
      if (!jsonConfig[blockName]) {
        ctx.res.status = 404;
        ctx.res.body = {
          status: "error",
          message: `Block '${blockName}' not found`
        };
        return;
      }
      
      jsonConfig[blockName] = newBlockConfig;
      const nginxConfig = parser.toConf(jsonConfig);
      await parser.writeConfigFile("/etc/nginx/nginx.conf", nginxConfig);
      
      ctx.res.body = {
        status: "success",
        message: `Block '${blockName}' updated successfully`
      };
    } catch (error) {
      throw new Error(`Failed to update block config: ${error.message}`);
    }
    
    await next();
  }
);

// Endpoint untuk validasi konfigurasi
server.post("/api/nginx/validate",
  res("json"),
  req("json"),
  errorHandler,
  async (ctx: any, next: any) => {
    try {
      const configObject = ctx.body;
      const nginxConfig = parser.toConf(configObject);
      
      // Simpan ke file temporary
      const tempFile = "/tmp/nginx_test.conf";
      await parser.writeConfigFile(tempFile, nginxConfig);
      
      // Test konfigurasi menggunakan command nginx
      const process = Deno.run({
        cmd: ["nginx", "-t", "-c", tempFile],
        stderr: "piped",
        stdout: "piped"
      });
      
      const { code } = await process.status();
      const stderr = new TextDecoder().decode(await process.stderrOutput());
      const stdout = new TextDecoder().decode(await process.stdoutOutput());
      
      // Hapus file temporary
      await Deno.remove(tempFile);
      
      if (code === 0) {
        ctx.res.body = {
          status: "success",
          message: "Configuration is valid",
          details: stdout
        };
      } else {
        ctx.res.status = 400;
        ctx.res.body = {
          status: "error",
          message: "Configuration is invalid",
          details: stderr
        };
      }
    } catch (error) {
      throw new Error(`Validation failed: ${error.message}`);
    }
    
    await next();
  }
);

// Endpoint untuk reload NGINX
server.post("/api/nginx/reload",
  res("json"),
  errorHandler,
  async (ctx: any, next: any) => {
    try {
      const process = Deno.run({
        cmd: ["nginx", "-s", "reload"],
        stderr: "piped",
        stdout: "piped"
      });
      
      const { code } = await process.status();
      const stderr = new TextDecoder().decode(await process.stderrOutput());
      
      if (code === 0) {
        ctx.res.body = {
          status: "success",
          message: "NGINX reloaded successfully"
        };
      } else {
        throw new Error(`Failed to reload NGINX: ${stderr}`);
      }
    } catch (error) {
      throw new Error(`Reload failed: ${error.message}`);
    }
    
    await next();
  }
);

// CORS middleware untuk API
server.use(setCORS());

// Start server
const port = 3000;
console.log(`Server running on http://localhost:${port}`);
await server.listen({ port });
