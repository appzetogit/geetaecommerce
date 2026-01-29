# Production WebSocket/Socket.io Troubleshooting Guide

## Problem: Delivery Boy Alerts Not Working in Production

This document explains the root causes and solutions for delivery boy alerts not working in production while working fine on localhost.

## Root Causes

### 1. **CORS/Origin Mismatch** (Most Common)
**Issue**: Socket.io server rejects connections if the frontend origin doesn't match the allowed origins in production.

**Symptoms**:
- Socket connects on localhost but fails in production
- Console shows connection errors or CORS warnings
- No `new-order` events received

**Solution**:
1. Set `FRONTEND_URL` environment variable in backend `.env`:
   ```
   FRONTEND_URL=https://your-production-domain.com,https://www.your-production-domain.com
   ```
2. Ensure the URL matches exactly (including protocol, no trailing slash)
3. Restart backend server after updating

### 2. **Missing Environment Variables**
**Issue**: Frontend doesn't know the backend API URL in production.

**Symptoms**:
- Socket tries to connect to `http://localhost:5000` in production
- Connection timeout errors

**Solution**:
1. Set `VITE_API_URL` in your frontend build environment:
   ```bash
   # For Vercel/Netlify
   VITE_API_URL=https://your-backend-api.com

   # For Docker
   ENV VITE_API_URL=https://your-backend-api.com
   ```
2. Rebuild frontend after setting the variable
3. Verify in browser console that it's using the correct URL

### 3. **WebSocket Blocked by Reverse Proxy/Load Balancer**
**Issue**: Nginx or load balancer doesn't support WebSocket upgrades.

**Symptoms**:
- Connection establishes but immediately disconnects
- 502 Bad Gateway errors
- WebSocket upgrade fails

**Solution - Nginx Configuration**:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket specific settings
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

### 4. **Socket.io Configuration Issues**
**Issue**: Missing production-specific Socket.io settings.

**Solution**: Already implemented in `socketService.ts`:
- `allowEIO3: true` - Supports older clients
- `pingTimeout: 60000` - Longer timeout for production
- `transports: ['websocket', 'polling']` - Fallback to polling

### 5. **Authentication Token Issues**
**Issue**: JWT token invalid or expired.

**Symptoms**:
- Socket connects but authentication fails
- No user data attached to socket

**Solution**:
1. Check token expiration in localStorage
2. Ensure token is being sent correctly:
   ```javascript
   const token = localStorage.getItem('token');
   socket = io(apiUrl, {
       auth: { token }
   });
   ```
3. Verify `JWT_SECRET` matches between token generation and verification

## Debugging Steps

### 1. Check Backend Logs
Look for these log messages:
- `✅ Socket connected:` - Connection successful
- `🔔 Delivery boy {id} joined notifications room` - Room join successful
- `⚠️ Socket.io connection rejected from origin:` - CORS issue

### 2. Check Frontend Console
Look for:
- `🔌 Delivery notification socket connected` - Connection successful
- `✅ Successfully joined notifications room` - Room join successful
- `❌ Socket connection error:` - Connection failed

### 3. Test Socket Connection
Add this to your frontend temporarily:
```javascript
socket.on('connect', () => {
    console.log('Connected!', socket.id);
});

socket.on('disconnect', (reason) => {
    console.log('Disconnected:', reason);
});

socket.on('error', (error) => {
    console.error('Error:', error);
});
```

### 4. Verify Environment Variables
**Backend**:
```bash
echo $FRONTEND_URL
echo $NODE_ENV
echo $JWT_SECRET
```

**Frontend** (in browser console):
```javascript
console.log('API URL:', import.meta.env.VITE_API_URL);
```

## Quick Checklist

- [ ] `FRONTEND_URL` set correctly in backend `.env`
- [ ] `VITE_API_URL` set correctly in frontend build
- [ ] Nginx/load balancer configured for WebSocket
- [ ] Backend server restarted after env changes
- [ ] Frontend rebuilt after env changes
- [ ] JWT token valid and not expired
- [ ] Browser console shows successful connection
- [ ] Backend logs show socket connections

## Common Production URLs

Make sure to set these correctly:

**Backend `.env`**:
```
FRONTEND_URL=https://Geeta Stores.com,https://www.Geeta Stores.com
NODE_ENV=production
```

**Frontend Build**:
```
VITE_API_URL=https://api.Geeta Stores.com
```

## Still Not Working?

1. Check browser Network tab for WebSocket connection
2. Verify firewall rules allow WebSocket connections
3. Check if SSL/TLS certificate is valid
4. Test with `wscat` or similar WebSocket client tool
5. Review server logs for detailed error messages

