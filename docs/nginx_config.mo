# docs/nginx-config.md
# Nginx Reverse Proxy Configuration

Complete Nginx configuration for SSL termination and reverse proxy setup.

## Basic Configuration

### Main Site Configuration

```nginx
# /etc/nginx/sites-available/claude-todoist-api
server {
    listen 80;
    server_name your-domain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL Configuration
    ssl_certificate /path/to/your/fullchain.pem;
    ssl_certificate_key /path/to/your/privkey.pem;
    
    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-CHACHA20-POLY1305;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Rate limiting zones
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=health:10m rate=1r/s;
    
    # Main API routes
    location /api/ {
        # Remove /api prefix when forwarding
        proxy_pass http://127.0.0.1:3000/;
        
        # Proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Port $server_port;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # Rate limiting
        limit_req zone=api burst=20 nodelay;
        
        # CORS headers (if needed)
        add_header Access-Control-Allow-Origin "https://your-domain.com" always;
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization" always;
        
        # Handle preflight requests
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "https://your-domain.com";
            add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
            add_header Access-Control-Allow-Headers "Content-Type, Authorization";
            add_header Access-Control-Max-Age 3600;
            add_header Content-Type text/plain;
            add_header Content-Length 0;
            return 204;
        }
    }
    
    # Health check endpoint (internal monitoring)
    location /health {
        proxy_pass http://127.0.0.1:3000/health;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        
        # Rate limit health checks
        limit_req zone=health burst=5 nodelay;
        
        # Don't log health checks
        access_log off;
    }
    
    # Info endpoint
    location /info {
        proxy_pass http://127.0.0.1:3000/info;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        
        # Rate limit info requests
        limit_req zone=health burst=5 nodelay;
    }
    
    # Block access to sensitive paths
    location ~ /\. {
        deny all;
    }
    
    # Custom error pages
    error_page 404 /404.html;
    error_page 500 502 503 504 /50x.html;
    
    location = /404.html {
        return 404 '{"error": "Endpoint not found", "status": 404}';
        add_header Content-Type application/json;
    }
    
    location = /50x.html {
        return 500 '{"error": "Internal server error", "status": 500}';
        add_header Content-Type application/json;
    }
}
```

## Advanced Configuration

### Load Balancing (Multiple Instances)

```nginx
upstream claude_todoist_backend {
    least_conn;
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3001 max_fails=3 fail_timeout=30s backup;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL configuration same as above...
    
    location /api/ {
        proxy_pass http://claude_todoist_backend/;
        # Other proxy settings same as above...
    }
}
```

### Caching Configuration

```nginx
# Add to http block in /etc/nginx/nginx.conf
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=100m inactive=60m use_temp_path=off;

# In server block
location /api/info {
    proxy_cache api_cache;
    proxy_cache_valid 200 5m;
    proxy_cache_key "$scheme$request_method$host$request_uri";
    add_header X-Cache-Status $upstream_cache_status;
    
    proxy_pass http://127.0.0.1:3000/info;
    # Other proxy settings...
}
```

## SSL Certificate Setup

### Using Let's Encrypt (Certbot)

```bash
# Install certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

### Using Custom SSL Certificate

```bash
# Create directory for certificates
sudo mkdir -p /etc/nginx/ssl

# Copy your certificates
sudo cp your-certificate.crt /etc/nginx/ssl/
sudo cp your-private-key.key /etc/nginx/ssl/

# Set proper permissions
sudo chmod 600 /etc/nginx/ssl/your-private-key.key
sudo chmod 644 /etc/nginx/ssl/your-certificate.crt
```

## Security Hardening

### Additional Security Headers

```nginx
# Add to server block
add_header Content-Security-Policy "default-src 'self'; script-src 'none'; style-src 'none';" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
add_header Cross-Origin-Embedder-Policy "require-corp" always;
add_header Cross-Origin-Opener-Policy "same-origin" always;
```

### Rate Limiting Configuration

```nginx
# Add to http block
geo $limit {
    default 1;
    10.0.0.0/8 0;      # Internal network
    192.168.0.0/16 0;  # Local network
    172.16.0.0/12 0;   # Docker networks
}

map $limit $limit_key {
    0 "";
    1 $binary_remote_addr;
}

limit_req_zone $limit_key zone=api:10m rate=10r/s;
limit_req_zone $limit_key zone=export:10m rate=2r/s;
limit_req_zone $limit_key zone=health:10m rate=1r/s;

# In server block
location /api/export {
    limit_req zone=export burst=5 nodelay;
    # Other settings...
}

location /api/quick-export {
    limit_req zone=export burst=5 nodelay;
    # Other settings...
}
```

## Monitoring and Logging

### Log Configuration

```nginx
# Custom log format
log_format api_logs '$remote_addr - $remote_user [$time_local] '
                    '"$request" $status $body_bytes_sent '
                    '"$http_referer" "$http_user_agent" '
                    '$request_time $upstream_response_time';

# In server block
access_log /var/log/nginx/claude-todoist-api.access.log api_logs;
error_log /var/log/nginx/claude-todoist-api.error.log warn;
```

### Status Page

```nginx
# Add to main nginx.conf or separate config
server {
    listen 127.0.0.1:8080;
    server_name localhost;
    
    location /nginx_status {
        stub_status on;
        access_log off;
        allow 127.0.0.1;
        deny all;
    }
}
```

## Testing Configuration

### Test Nginx Configuration

```bash
# Test configuration syntax
sudo nginx -t

# Reload configuration
sudo nginx -s reload

# Check status
sudo systemctl status nginx

# View logs
sudo tail -f /var/log/nginx/claude-todoist-api.access.log
sudo tail -f /var/log/nginx/claude-todoist-api.error.log
```

### Test SSL Configuration

```bash
# Test SSL configuration
openssl s_client -connect your-domain.com:443 -servername your-domain.com

# Test with curl
curl -I https://your-domain.com/api/health

# Test SSL rating
# Visit: https://www.ssllabs.com/ssltest/
```

### Performance Testing

```bash
# Test API performance
ab -n 1000 -c 10 https://your-domain.com/api/health

# Test rate limiting
for i in {1..20}; do curl -w "%{http_code}\n" -o /dev/null -s https://your-domain.com/api/health; done
```

## Troubleshooting

### Common Issues

1. **502 Bad Gateway**
   ```bash
   # Check if API is running
   curl http://localhost:3000/health
   
   # Check Docker container
   docker ps | grep claude-todoist-api
   ```

2. **SSL Certificate Issues**
   ```bash
   # Check certificate validity
   openssl x509 -in /path/to/cert -text -noout
   
   # Check certificate chain
   openssl verify -CApath /etc/ssl/certs /path/to/cert
   ```

3. **Rate Limiting Too Aggressive**
   ```nginx
   # Temporarily disable for testing
   # Comment out limit_req lines
   ```

### Log Analysis

```bash
# Check for errors
sudo grep "error" /var/log/nginx/claude-todoist-api.error.log

# Monitor real-time access
sudo tail -f /var/log/nginx/claude-todoist-api.access.log

# Check rate limiting hits
sudo grep "limiting requests" /var/log/nginx/claude-todoist-api.error.log
```

---