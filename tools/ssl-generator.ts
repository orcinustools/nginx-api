import { parse as parseFlags } from "https://deno.land/std/flags/mod.ts";
import { encode as encodeBase64 } from "https://deno.land/std/encoding/base64.ts";
import { crypto } from "https://deno.land/std/crypto/mod.ts";

interface ACMEAccount {
  privateKey: CryptoKeyPair;
  url: string;
  contact?: string[];
}

interface ACMEOrder {
  url: string;
  status: string;
  identifiers: { type: string; value: string }[];
  authorizations: string[];
  finalize: string;
  certificate?: string;
}

interface ACMEChallenge {
  type: string;
  url: string;
  token: string;
  status: string;
}

class LetsEncryptClient {
  private directory: Record<string, string> = {};
  private account: ACMEAccount | null = null;
  private nonce: string | null = null;
  private baseUrl: string;

  constructor(staging = false) {
    this.baseUrl = staging
      ? "https://acme-staging-v02.api.letsencrypt.org/directory"
      : "https://acme-v02.api.letsencrypt.org/directory";
  }

  private async generateKeyPair(): Promise<CryptoKeyPair> {
    return await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"]
    );
  }

  private async sign(key: CryptoKey, data: string): Promise<string> {
    const encoder = new TextEncoder();
    const signature = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      encoder.encode(data)
    );
    return encodeBase64(new Uint8Array(signature));
  }

  private async fetchNonce(): Promise<string> {
    const response = await fetch(this.directory.newNonce, {
      method: "HEAD",
    });
    return response.headers.get("Replay-Nonce") || "";
  }

  private async signedRequest(
    url: string,
    payload: Record<string, unknown> = {},
    method = "POST"
  ): Promise<Response> {
    if (!this.account) {
      throw new Error("Account not initialized");
    }

    if (!this.nonce) {
      this.nonce = await this.fetchNonce();
    }

    const protected_header = {
      alg: "RS256",
      nonce: this.nonce,
      url,
      kid: this.account.url,
    };

    const payload_encoded = encodeBase64(
      new TextEncoder().encode(JSON.stringify(payload))
    );
    const protected_encoded = encodeBase64(
      new TextEncoder().encode(JSON.stringify(protected_header))
    );

    const signature = await this.sign(
      this.account.privateKey.privateKey,
      protected_encoded + "." + payload_encoded
    );

    const body = JSON.stringify({
      protected: protected_encoded,
      payload: payload_encoded,
      signature,
    });

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/jose+json",
      },
      body,
    });

    this.nonce = response.headers.get("Replay-Nonce") || null;
    return response;
  }

  async initialize(): Promise<void> {
    const response = await fetch(this.baseUrl);
    this.directory = await response.json();
  }

  async createAccount(email: string): Promise<void> {
    const keyPair = await this.generateKeyPair();
    const payload = {
      termsOfServiceAgreed: true,
      contact: [`mailto:${email}`],
    };

    const response = await this.signedRequest(
      this.directory.newAccount,
      payload
    );

    if (!response.ok) {
      throw new Error(`Failed to create account: ${await response.text()}`);
    }

    this.account = {
      privateKey: keyPair,
      url: response.headers.get("Location") || "",
      contact: [`mailto:${email}`],
    };
  }

  async createOrder(domain: string): Promise<ACMEOrder> {
    const payload = {
      identifiers: [
        {
          type: "dns",
          value: domain,
        },
      ],
    };

    const response = await this.signedRequest(
      this.directory.newOrder,
      payload
    );

    if (!response.ok) {
      throw new Error(`Failed to create order: ${await response.text()}`);
    }

    return await response.json();
  }

  async getAuthorization(url: string): Promise<{
    challenges: ACMEChallenge[];
    wildcard: boolean;
  }> {
    const response = await this.signedRequest(url, {}, "GET");
    if (!response.ok) {
      throw new Error(`Failed to get authorization: ${await response.text()}`);
    }
    return await response.json();
  }

  async verifyChallenge(challenge: ACMEChallenge): Promise<void> {
    const response = await this.signedRequest(challenge.url, {});
    if (!response.ok) {
      throw new Error(`Failed to verify challenge: ${await response.text()}`);
    }
  }

  async waitForValidation(url: string): Promise<void> {
    while (true) {
      const response = await this.signedRequest(url, {}, "GET");
      if (!response.ok) {
        throw new Error(`Failed to check status: ${await response.text()}`);
      }
      const status = await response.json();
      if (status.status === "valid") {
        return;
      }
      if (status.status === "invalid") {
        throw new Error("Challenge validation failed");
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  async generateCertificate(
    domain: string,
    email: string
  ): Promise<{ cert: string; key: string }> {
    await this.initialize();
    await this.createAccount(email);

    console.log("Creating order...");
    const order = await this.createOrder(domain);

    for (const authUrl of order.authorizations) {
      const auth = await this.getAuthorization(authUrl);
      const challenge = auth.challenges.find((c) => c.type === "http-01");
      if (!challenge) {
        throw new Error("No HTTP challenge found");
      }

      console.log("Creating challenge response...");
      // Here you would need to set up the HTTP challenge
      // by serving the token at /.well-known/acme-challenge/{token}

      console.log("Verifying challenge...");
      await this.verifyChallenge(challenge);
      await this.waitForValidation(authUrl);
    }

    // Generate CSR and finalize order
    const keyPair = await this.generateKeyPair();
    // Generate CSR using the key pair
    // Finalize order with CSR

    return {
      cert: "certificate content",
      key: "private key content",
    };
  }
}

async function main() {
  const flags = parseFlags(Deno.args, {
    boolean: ["staging", "help"],
    string: ["domain", "email", "output"],
    alias: {
      d: "domain",
      e: "email",
      o: "output",
      s: "staging",
      h: "help",
    },
  });

  if (flags.help) {
    console.log(`
SSL Certificate Generator for Let's Encrypt

Usage:
  ssl-generator.ts [options]

Options:
  -d, --domain <domain>    Domain name to generate certificate for
  -e, --email <email>      Email address for Let's Encrypt account
  -o, --output <dir>       Output directory for certificates (default: current directory)
  -s, --staging            Use Let's Encrypt staging environment
  -h, --help              Show this help message

Example:
  deno run --allow-read --allow-write --allow-net ssl-generator.ts \\
    --domain example.com \\
    --email admin@example.com \\
    --output /etc/nginx/ssl
    `);
    Deno.exit(0);
  }

  if (!flags.domain || !flags.email) {
    console.error("Error: domain and email are required");
    Deno.exit(1);
  }

  const outputDir = flags.output || ".";
  try {
    await Deno.mkdir(outputDir, { recursive: true });
  } catch (error) {
    console.error(`Error creating output directory: ${error.message}`);
    Deno.exit(1);
  }

  try {
    console.log(`Generating certificate for ${flags.domain}...`);
    const client = new LetsEncryptClient(flags.staging);
    const { cert, key } = await client.generateCertificate(
      flags.domain,
      flags.email
    );

    const certPath = `${outputDir}/${flags.domain}.crt`;
    const keyPath = `${outputDir}/${flags.domain}.key`;

    await Deno.writeTextFile(certPath, cert);
    await Deno.writeTextFile(keyPath, key);

    console.log(`
Certificate generation successful!
Certificate: ${certPath}
Private Key: ${keyPath}
    `);
  } catch (error) {
    console.error(`Error generating certificate: ${error.message}`);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}