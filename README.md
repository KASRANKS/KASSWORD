# Kassword

**Your passwords on Kaspa.** AES-256 encrypted. Backed up to the Kaspa BlockDAG. No servers. No accounts. No subscriptions. You own your data.

## What is Kassword?

Kassword is a personal password and media vault that runs entirely in your browser. Your secrets - passwords, seed phrases, identity documents, secure notes, images, video, audio - are encrypted with AES-256-GCM and backed up as transaction payloads on the Kaspa BlockDAG. Recoverable from any device, any browser, forever.

No server ever sees your data. No account to hack. No subscription to cancel. Your vault lives in your browser and in the DAG - nowhere else.

## Security Model

- **AES-256-GCM** - authenticated encryption, same standard used by governments and militaries
- **PBKDF2 1,000,000 iterations** - makes brute force computationally non-viable
- **2-factor encryption** - your data is encrypted using BOTH your master password AND a random 256-bit wallet key. Neither alone is sufficient. Even a weak password is uncrackable without the 64-char wallet key
- **Random salt + random IV** - per vault and per encryption operation. Two users with the same password produce completely different ciphertext
- **Zero servers** - no accounts, no cloud, no third parties, no telemetry
- **Web Crypto API** - browser-native, hardware-accelerated cryptography
- **Kaspa WASM SDK bundled locally** - no CDN, no supply chain risk
- **Anti-clickjacking** - cannot be embedded in iframes
- **Auto-lock** - vault locks after 5 minutes of inactivity, clearing all secrets from memory
- **Tab close protection** - secrets wiped immediately on browser tab close
- **Derived chunk-worker keys** - media uploads sign from ephemeral SHA-256-derived keys, not the main wallet key. Re-derivable, never stored

## What You Can Store

- **Passwords** - username, password, website URL
- **Secure notes** - freeform encrypted text
- **Recovery records** - crypto wallet recovery phrases, security keys
- **Identity documents** - passport numbers, driver licenses, etc.
- **Media files** - images (PNG, JPG, GIF, WebP), video (MP4, WebM), audio (MP3, WAV, OGG). Max 3 MB per file, 15 MB total. Encrypted with the same AES-256-GCM scheme and chunked into the DAG.

## How It Works

1. **Set a master password** - 8+ characters. There is no recovery. Choose carefully.
2. **Save your vault key** - the 64-character hex key shown under "Show vault key". You need BOTH this key AND your password to recover. Store it somewhere safe - offline, printed, separate from your password.
3. **Add entries** - passwords, recovery records, IDs, secure notes, or media files.
4. **Fund your wallet** - send at least 5 KAS (10 KAS if you have media files) to your vault address.
5. **Backup to DAG** - your encrypted vault is stored as a transaction payload. Permanent. Indestructible. Unreadable without both your keys.
6. **Recover anywhere** - new device? Click "Recover from DAG backup", enter your vault key + password. Your secrets come back from the DAG, including media files.

## Media Vault - On-DAG Encrypted Backup

Media files are encrypted with AES-256-GCM (the same 2-factor scheme as text entries) and chunked into Kaspa transaction payloads. The encrypted bytes hit the DAG already-encrypted - only your password + wallet key can decrypt.

| Limit | Value |
|---|---|
| Max per file | 3 MB |
| Max total media | 15 MB |
| Images | PNG, JPG, GIF, WebP |
| Video | MP4, WebM |
| Audio | MP3, WAV, OGG |
| Chunk size | 10 KB raw payload per TX |

A 1.8 MB video splits into ~190 chunks. Up to 6 ephemeral worker keys (derived via SHA-256 from your wallet key) upload chunks in parallel, then sweep their remainder back to your main wallet. Total backup time for a typical 1.8 MB file: ~5 seconds.

Each media entry is referenced in the manifest by an INDEX TX (kw-2 v2 protocol) - a single transaction whose payload lists every chunk txid for that file. Recovery fetches the manifest, the index TXs, then chunks via the bulk-search endpoint.

### Recovery & Refresh Tools

The wallet bar exposes three on-demand tools for healing local state without re-uploading:

- **Recover worker funds** - re-derive the chunk-worker keys (indices 0–5) and sweep any leftover funds back to your main wallet
- **Re-link DAG videos** - walk every prior manifest in your wallet's TX history and restore any missing media references (fixes "no media data available" without spending KAS)
- **↻ Refresh media** - re-fetch chunks for any media not yet in the local cache

If a single video gets stuck loading, every video viewer also has a built-in **↻ Retry** button that re-runs the fetch without closing the modal.

## Backup Fees

| Backup type | Maker (KasRanks) | Miners | Total |
|---|---|---|---|
| Text-only vault (kw-1) | 2 KAS | 3 KAS | **5 KAS** |
| Media vault (kw-2)     | 4 KAS | 6 KAS | **10 KAS** |

Plus negligible per-chunk transaction fees (~50,000 sompi each, ~0.1 KAS for a 1.8 MB file).

## Running Locally

**Windows:** Double-click `start.bat`

**Mac/Linux:**
```bash
cd kassword
python3 -m http.server 7777
# Open http://localhost:7777
```

Kassword is designed to run locally. Running at `localhost:7777` eliminates network-based injection risks. Do not use on shared or untrusted computers.

## What Kassword Guarantees

- Data at rest is AES-256-GCM encrypted at all times
- Encryption key requires both password AND wallet key - neither alone works
- DAG backups are permanently unreadable without both factors
- Media files encrypted with the same scheme as text entries - including before they ever touch the DAG
- No server, no account, no cloud, no third party ever touches your data
- Tampered ciphertext is rejected (authenticated encryption)
- Auto-lock wipes sensitive data from memory after inactivity
- Tab close wipes all secrets immediately
- Decrypted media blob URLs revoked on lock and tab close
- Manifest TXs without the protocol fee are filtered from recovery - protocol enforcement
- Open source - no hidden backdoors, verify it yourself

## What Kassword Does NOT Guarantee

- Protection against malicious browser extensions - extensions can read browser storage. **Use a clean browser profile with no third-party extensions.**
- Protection against a compromised OS - keyloggers and malware operate below the browser layer. No password manager can defend against this.
- Password recovery - by design. No backdoor exists. If you lose both your master password and your vault key, your data is gone.
- Wallet key recovery - your wallet private key is stored in localStorage as the second encryption factor. If you lose both your browser localStorage and your saved vault key copy, recovery is impossible.

## Security Best Practices

- Use a dedicated browser profile with no extensions when accessing your vault
- Never use on a shared or public computer
- Store your vault key offline (written down, printed) - separate from your password
- Back up to the DAG before clearing browser data or switching browsers
- Fund your vault wallet with only what you need for backups (~10 KAS for media-tier backups)
- Use a strong master password - 12+ characters, mixed types

## Tech Stack

- Vanilla HTML/CSS/JS - single file, no build step, no dependencies, no framework
- Kaspa WASM SDK - bundled locally, no CDN, no external requests
- Web Crypto API - native browser cryptography, hardware-accelerated
- IndexedDB - browser-native binary storage for encrypted media files
- Kaspa REST bulk-search endpoint - single POST per 100 chunks, rate-limit friendly
- Google Fonts (Syne, Outfit, JetBrains Mono)

## Built by KasRanks

Part of the [KasRanks](https://x.com/Kas_Ranks) ecosystem - tools and culture for Kaspa.

---

*Your passwords. Your media. Your keys. Your DAG.*
