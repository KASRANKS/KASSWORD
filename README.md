# Kassword

**Your passwords on Kaspa.** AES-256 encrypted. Backed up to the Kaspa BlockDAG. No servers. No accounts. No subscriptions. You own your data.

## What is Kassword?

Kassword is a personal password vault that runs entirely in your browser. Your secrets are encrypted with AES-256-GCM and backed up as transaction payloads on the Kaspa BlockDAG — recoverable from any device, any browser, forever.

No server ever sees your data. No account to hack. No subscription to cancel. Your vault lives in your browser and on the chain — nowhere else.

## Security Model

- **AES-256-GCM** — authenticated encryption, same standard used by governments and militaries
- **PBKDF2 1,000,000 iterations** — makes brute force computationally non-viable
- **2-factor encryption** — your data is encrypted using BOTH your master password AND a random 256-bit wallet key. Neither alone is sufficient. Even a weak password is uncrackable without the 64-char wallet key
- **Random salt + random IV** — per vault and per encryption. Two users with the same password produce completely different ciphertext
- **Zero servers** — no accounts, no cloud, no third parties, no telemetry
- **Web Crypto API** — browser-native, hardware-accelerated cryptography
- **Kaspa WASM SDK bundled locally** — no CDN, no supply chain risk
- **Anti-clickjacking** — cannot be embedded in iframes

## How It Works

1. **Set a master password** — 8+ characters. There is no recovery. Choose carefully.
2. **Save your vault key** — the 64-character hex key shown under "Show vault key". You need BOTH this key AND your password to recover. Store it somewhere safe — offline, printed, separate from your password.
3. **Add entries** — passwords, seed phrases, secure notes, identity documents.
4. **Fund your wallet** — send at least 5 KAS to your vault address.
5. **Backup to DAG** — your encrypted vault is stored as a Kaspa transaction payload. Permanent. Indestructible. Unreadable without both your keys.
6. **Recover anywhere** — new device? Click "Recover from DAG backup", enter your vault key + password. Your secrets come back from the chain.

## Backup Fee

Each DAG backup costs **5 KAS**:
- 2 KAS → KasRanks (protocol fee)
- 3 KAS → miners (network priority fee)

## Running Locally

**Windows:** Double-click `start.bat`

**Mac/Linux:**
```bash
cd kassword
python3 -m http.server 7777
# Open http://localhost:7777
```

Kassword is designed to run locally. Running at `localhost:7777` eliminates network-based injection risks. Do not use on shared or untrusted computers.

## Entry Types

- **Passwords** — username, password, website URL
- **Secure notes** — freeform encrypted text
- **Seed phrases** — crypto wallet recovery phrases
- **Identity documents** — passport numbers, driver licenses, etc.

## What Kassword Guarantees

- Data at rest is AES-256-GCM encrypted at all times
- Encryption key requires both password AND wallet key — neither alone works
- On-chain backups are permanently unreadable without both factors
- No server, no account, no cloud, no third party ever touches your data
- Tampered ciphertext is rejected (authenticated encryption)
- Auto-lock wipes sensitive data from memory after inactivity
- Open source — no hidden backdoors, verify it yourself

## What Kassword Does NOT Guarantee

- Protection against malicious browser extensions — extensions can read browser storage. **Use a clean browser profile with no third-party extensions for maximum security.**
- Protection against a compromised OS — keyloggers and malware operate below the browser layer. No password manager on earth can defend against this.
- Password recovery — by design. No backdoor exists. If you lose both your master password and your vault key, your data is gone.
- Wallet key recovery — if you lose both your browser localStorage and your saved vault key copy, recovery is impossible.

## Security Best Practices

- Use a dedicated browser profile with no extensions when accessing your vault
- Never use on a shared or public computer
- Store your vault key offline (written down, printed) — separate from your password
- Back up to the DAG before clearing browser data or switching browsers
- Fund your vault wallet with only what you need for backups (~10 KAS)
- Use a strong master password — 12+ characters, mixed types

## Tech Stack

- Vanilla HTML/CSS/JS — single file, no build step, no dependencies, no framework
- Kaspa WASM SDK — bundled locally, no CDN, no external requests
- Web Crypto API — native browser cryptography, hardware-accelerated
- Google Fonts (Syne, Outfit, JetBrains Mono)

## Built by KasRanks

Part of the [KasRanks](https://x.com/Kas_Ranks) ecosystem — tools and culture for Kaspa.

---

*Your passwords. Your keys. Your chain.*
