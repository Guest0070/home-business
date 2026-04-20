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

