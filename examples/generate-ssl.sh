#!/bin/bash

# Example script to generate SSL certificates for multiple domains

# Start the challenge server (requires root for port 80)
sudo luwak ../tools/challenge-server.ts &
CHALLENGE_PID=$!

# Function to clean up challenge server
cleanup() {
  echo "Stopping challenge server..."
  sudo kill $CHALLENGE_PID
  exit
}

# Set up trap for cleanup
trap cleanup EXIT INT TERM

# Generate certificates for domains
DOMAINS=(
  "example.com"
  "api.example.com"
  "blog.example.com"
)

EMAIL="admin@example.com"
OUTPUT_DIR="/etc/nginx/ssl"

for domain in "${DOMAINS[@]}"; do
  echo "Generating certificate for $domain..."
  
  # Use staging environment first to test
  deno run --allow-read --allow-write --allow-net ../tools/ssl-generator.ts \
    --domain "$domain" \
    --email "$EMAIL" \
    --output "$OUTPUT_DIR" \
    --staging

  # If successful, generate real certificate
  if [ $? -eq 0 ]; then
    echo "Staging successful, generating production certificate..."
    deno run --allow-read --allow-write --allow-net ../tools/ssl-generator.ts \
      --domain "$domain" \
      --email "$EMAIL" \
      --output "$OUTPUT_DIR"
  fi
done

# Clean up will happen automatically due to trap