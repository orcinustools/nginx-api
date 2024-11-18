import { serve } from "https://deno.land/std/http/server.ts";

const challenges = new Map<string, string>();

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (!url.pathname.startsWith("/.well-known/acme-challenge/")) {
    return new Response("Not Found", { status: 404 });
  }

  const token = url.pathname.split("/").pop();
  if (!token || !challenges.has(token)) {
    return new Response("Challenge not found", { status: 404 });
  }

  return new Response(challenges.get(token), {
    headers: { "Content-Type": "text/plain" },
  });
}

export function addChallenge(token: string, response: string): void {
  challenges.set(token, response);
}

export function removeChallenge(token: string): void {
  challenges.delete(token);
}

if (import.meta.main) {
  const port = 80;
  console.log(`Challenge server running on port ${port}`);
  await serve(handler, { port });
}