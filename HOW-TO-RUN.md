# How To Run Coal TMS Yourself

## Start On Your Laptop Only

```powershell
.\scripts\start-dev.ps1
```

Open:

- Frontend: `http://127.0.0.1:5173`
- Backend health: `http://127.0.0.1:4000/health`

## Start For Your Whole Local Network

```powershell
.\scripts\start-network.ps1
```

This prints your laptop IP address. On another phone or PC on the same Wi-Fi/LAN, open:

```text
http://YOUR-LAPTOP-IP:5173
```

Examples:

- `http://192.168.1.15:5173`
- `http://10.0.0.8:5173`

If another device cannot connect:

1. Make sure both devices are on the same network.
2. Allow ports `5173` and `4000` in Windows Firewall.
3. Keep this laptop awake while using the app.

## Start In Hosted Mode

Hosted mode gives you a single URL and is the easiest path for future deployment because the backend serves the frontend too.

```powershell
.\scripts\start-hosted.ps1
```

Open:

- `http://127.0.0.1:4000`
- `http://YOUR-LAPTOP-IP:4000`

Stop:

```powershell
.\scripts\stop-hosted.ps1
```

## Linux Or Other Unix-Like Systems

If you are running on Linux:

```bash
./scripts/start-dev.sh
./scripts/stop-dev.sh
./scripts/start-hosted.sh
./scripts/stop-hosted.sh
```

These scripts assume Node.js and PostgreSQL are already installed and configured.

## Stop Everything

```powershell
.\scripts\stop-dev.ps1
```

## Login

- Email: `admin@coal-tms.local`
- Password: `Admin@12345`

## Excel Imports

### Vehicles

1. Open `Vehicles`
2. Download template or export existing trucks
3. Fill in Excel
4. Upload with `Review Vehicle Excel`
5. Check the preview
6. Click `Confirm Import`

Blank optional cells are allowed. On updates, blank optional cells keep the current value.

### Drivers

1. Open `Drivers`
2. Download template or export existing drivers
3. Fill in Excel
4. Upload with `Review Driver Excel`
5. Check the preview
6. Click `Confirm Import`

Blank optional cells are allowed. On updates, blank optional cells keep the current value.

### Delivery Orders

1. Open `D.O.`
2. Download template or export existing delivery orders
3. Fill in Excel
4. Upload with `Review Delivery Order Excel`
5. Check the preview
6. Click `Confirm Import`

Blank optional cells are allowed. On updates, blank optional cells keep the current value.

### Bank Statements

1. Open `Banking`
2. Add the bank account first if it is not already in the system
3. Select the bank account in `Import Bank Statement`
4. Upload `.csv` or `.xlsx`
5. Review the preview
6. Click `Confirm Import`

Already imported rows are detected and skipped automatically.

## Themes

Use the theme selector in the top bar.

### Add a New Theme Yourself

Edit:

- `frontend/src/theme.js`
- `frontend/src/styles.css`

Steps:

1. Add a new theme id and label in `frontend/src/theme.js`
2. Add a matching `[data-theme="your-theme-id"]` block in `frontend/src/styles.css`
3. Set CSS variables:
   - `--bg`
   - `--bg-soft`
   - `--panel`
   - `--panel-strong`
   - `--border`
   - `--text`
   - `--muted`
   - `--input-bg`
   - `--accent`
   - `--accent-strong`
   - `--danger`
   - `--danger-soft`
4. Restart the frontend:

```powershell
.\scripts\stop-dev.ps1
.\scripts\start-dev.ps1
```

## Notes

- Driver allowance is not stored per driver. Allowance is entered per trip.
- Repair trucks cannot be used for new trips.
- Vacation/inactive drivers cannot be assigned to new trips.
- Delivery orders can be created first, then linked to trips as deliveries happen.
- In trip entry, typing a new driver name creates that driver automatically when the trip is saved.
- In payments, selecting a D.O. fills the party automatically.
- In payments, selecting a bank account creates the linked bank entry automatically.
- The Reports page supports timeframe-based export in `Standard`, `Zoho`, and `Tally` presets.
- The Compliance page tracks insurance, road tax, fitness, all India permit, pollution, and mining certificate reminders.
- Vehicles now include `chassis_last5`, which is useful for road tax work.
- The Banking page supports multiple bank accounts, statement import, manual entries, and loan schedule reminders.
- The GPS page supports WheelsEye portal mode now. Live API mode can be switched on later if WheelsEye gives enterprise API details.

## Future Hosting

When you later move this to a server or domain, use:

[DEPLOYMENT.md](C:/Users/divya/Documents/Codex/2026-04-19-i-want-you-to-act-as/tms-coal-logistics/DEPLOYMENT.md)

If you want to expose directly from your own PC to the public internet, use:

[PUBLIC-HOSTING.md](C:/Users/divya/Documents/Codex/2026-04-19-i-want-you-to-act-as/tms-coal-logistics/PUBLIC-HOSTING.md)
