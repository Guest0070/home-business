# Public Hosting From Your Own PC

You can expose this app to the whole world from your own PC, but there are a few real-world requirements:

1. Your PC must stay on
2. Your internet connection must allow inbound traffic or a tunnel
3. PostgreSQL and the app must stay running
4. You should use HTTPS in front of it

## Best Practical Options

### Option 1: Reverse Tunnel

Use a tunnel service such as Cloudflare Tunnel.

Why this is good:
- no router port-forwarding required
- easier HTTPS
- safer than exposing raw ports directly

Your app side is already ready for this:

```powershell
.\scripts\start-hosted.ps1
```

Then point the tunnel to:

```text
http://127.0.0.1:4000
```

### Option 2: Router Port Forwarding

If you want to expose directly from home/office internet:

1. Start hosted mode
2. Forward your router public port to your PC port `4000`
3. Use a domain or dynamic DNS
4. Put HTTPS in front of it if possible

This works, but it is more exposed and needs more care.

## Important Truth

If you host from your own PC for public use:
- your PC becomes the server
- sleep mode, restarts, power cuts, and local internet issues will affect the app
- backups matter more

For office use with a small number of users, this can still be okay.
