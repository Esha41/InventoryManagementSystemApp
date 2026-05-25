# Topaz Signature Pad Setup

Guide for IT and supply-desk staff setting up Topaz signature capture with Ettad.

## Overview

Ettad can capture an optional receiver signature from a Topaz USB pad during supply submission. This requires **SigWeb** (Topaz middleware) on the **same Windows PC** as the browser—not on the server.

| Component | Where | Required for |
|-----------|--------|----------------|
| Ettad web app | Browser | All users |
| Ettad API | Server | All users (no Topaz install) |
| **Topaz SigWeb** | Each signature workstation | Supply desk only |
| **Topaz USB pad** | Same PC as SigWeb | Supply desk only |

Signature is **optional**. PDF/DOCX attachments remain required.

## Air-gapped / red network (no internet)

Ettad is built for internal-only deployment:

| Component | Internet required? |
|-----------|-------------------|
| Ettad app + API (internal servers) | No |
| `SigWebTablet.js` | **No** — bundled at `src/assets/SigWebTablet.js`, served as `/assets/SigWebTablet.js` |
| Topaz CDN (`sigplusweb.com`) | No — used only as online fallback |
| **SigWeb on supply-desk PC** | No — local service on `localhost:47289` |
| **USB pad** | No |

Each **supply-desk PC** still needs **SigWeb installed** and the pad plugged in. No outbound internet on the desk or on the Ettad servers.

The Topaz script talks to **`tablet.sigwebtablet.com:47289`**, which SigWeb maps to **localhost** on that PC (usually via the SigWeb installer / hosts file). If capture fails offline, verify:

```
http://localhost:47289/SigWeb/TabletState?noCache=1
```

returns a response on the desk PC.

---

1. **Ammunition / Explosives** — Workflow Approval → **Submit Supply - Receiver Information**
2. **Weapons** — **Weapon Supply Review** → Receiver Information section

Prerequisites for the UI section to show:
- Correct page and permissions (current approver for ammo/explosives submit supply)
- Supply ready to submit (draft exists, not already submitted)
- SigWeb detected, or the app shows *"No Topaz signature pad detected"* (signature block is always visible on the form)

---

## Part A — Install SigWeb (one-time per PC)

### Requirements

- Windows 10/11
- Microsoft .NET Framework **4.7.1 or later**
- Administrator rights for install
- Topaz USB pad (model on back of device)
- Chrome or Edge (latest)

### Official resources

- [SigWeb download](https://www.topazsystems.com/sigweb.html)
- [Install PDF](https://www.topazsystems.com/software/sigweb_install.pdf)
- [Online demo](https://www.sigplusweb.com/sigwebtablet_demo.html)
- [Local Network Access guide](https://www.topazsystems.com/software/SigWeb_Local_Network_Access_Guide.pdf) (Chrome 142+ / Edge 143+)

### Steps

1. **Close all browsers** before installing.

2. **Download SigWeb** from [topazsystems.com/sigweb.html](https://www.topazsystems.com/sigweb.html) for your pad model.

3. **Run as Administrator** → accept license → select pad model → install to default path:
   `C:\Program Files (x86)\Topaz Systems, Inc\SigWeb\`

4. **Do not plug in the pad** until install completes (unless installer prompts).

5. **Plug in the USB pad** and confirm Windows recognizes it (Device Manager).

6. **Verify SigWeb service** — open in browser:
   ```
   http://localhost:47289/SigWeb/TabletState?noCache=1
   ```
   **Expected:** a response (not connection refused). HTTP 200 is good.

   > **Note:** `http://localhost:47289/` and `http://localhost:47289/SigWeb/SigWebTablet.js` often return **404** on modern SigWeb — that is normal. Ettad loads `SigWebTablet.js` from Topaz’s CDN; the **local service** only needs the API on port 47289.

   Optional: confirm CDN script loads:
   ```
   https://www.sigplusweb.com/SigWebTablet.js
   ```

7. **Test with Topaz demo** — [sigwebtablet_demo.html](https://www.sigplusweb.com/sigwebtablet_demo.html) → **Sign** on pad → signature appears on screen.

---

## Part B — Browser permissions

Chrome 142+ and Edge 143+ need **Local Network Access** for Ettad to reach `localhost:47289`.

1. When prompted in Ettad, click **Allow** (*connect to devices on your local network*).

2. If missed, add your Ettad URL manually:
   - Chrome: `chrome://settings/content/localNetworkAccess`
   - Edge: `edge://settings/privacy/sitePermissions/allPermissions/localNetworkAccess`

   Add URLs such as:
   - Dev: `http://localhost:4200`
   - Production: your exact Ettad URL (e.g. `https://ettad.example.com`)

3. IT can use Topaz GPO PowerShell scripts for bulk deployment (see Topaz LNA guide).

---

## Part C — Use in Ettad

### Ammunition / Explosives

1. Open **Requests Management** → ammo/explosives order → **Workflow Approval**.
2. Ensure supply exists and is not submitted; you are the current approver.
3. In **Submit Supply - Receiver Information**:
   - Select receiver (required)
   - Attach PDF/DOCX (required)
   - Optional: **Capture Signature** on Topaz pad → **Done**
4. **Submit Supply** — signature uploads as `receiver-signature.png` (first file if captured).

### Weapons

1. From workflow approval, open **Review Weapon Supply**.
2. In **Receiver Information**:
   - Complete receiver, files, and optional signature as above.
3. **Submit Supply**.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "No Topaz signature pad detected" in Ettad | Install/start SigWeb; verify `SigWebTablet.js` loads |
| `localhost:47289` connection refused | Reinstall SigWeb; restart PC; check Windows Services for SigWeb |
| `SigWebTablet.js` on localhost → 404 | Normal on modern SigWeb; verify `TabletState` URL instead |
| `IsAlive` → "Endpoint not found" | Ignore; use `TabletState?noCache=1` test |
| Topaz demo works, Ettad does not | Allow Local Network Access for Ettad URL (Part B) |
| Submit Supply section missing (ammo) | Not weapon order; need approver role; supply must exist |
| "No signature detected" on Done | Sign on pad before clicking Done |
| Pad not in Device Manager | Reinstall SigPlus driver for your model |

### Verify port 47289 (PowerShell)

```powershell
netstat -ano | findstr 47289
```

Confirm the process is Topaz/SigWeb.

---

## Uninstall / reinstall

1. Control Panel → uninstall **SigWeb**
2. Close all browsers
3. Repeat Part A

---

## Developer reference

| File | Purpose |
|------|---------|
| `src/app/core/services/topaz.service.ts` | Loads `SigWebTablet.js` from Topaz CDN, API via localhost:47289 |
| `src/app/shared/ui/topaz-signature/` | Signature UI component |
| `workflow-supply-submission/` | Ammo/explosives integration |
| `weapon-supply-review/` | Weapons integration |

i18n keys: `workflowApprovalDetail.topazSignature.*` in `requests-workflowApproval.json`.
