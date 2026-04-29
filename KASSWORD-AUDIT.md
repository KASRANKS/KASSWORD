# Kassword - Security Audit
**Version:** v3 (kw-2 protocol with on-DAG media vault)
**Date:** April 2026
**Audited by:** KasRanks + multi-session cross-AI audit

---

## 1. Cryptographic Engine

### Key Derivation
- **Algorithm:** PBKDF2-SHA256
- **Iterations:** 1,000,000
- **Salt:** 32 bytes, cryptographically random, unique per vault
- **Input:** `password + '::' + walletPrivateKey (256-bit random hex)`
- **Output:** 256-bit AES-GCM key
- **extractable:** `false` on both `importKey` and `deriveKey`

### 2-Factor Design
Neither factor alone can decrypt. Brute force space: `password_space × 2^256`.

### Text Encryption (`encrypt` / `decrypt`)
- AES-256-GCM, 12-byte random IV per call, hex output

### Binary Encryption (`encryptBytes` / `decryptBytes`)
- AES-256-GCM, 12-byte random IV per call, ArrayBuffer I/O
- Same `deriveKey()`, same 2-factor input, same PBKDF2-1M
- Used for media files before they're chunked into the DAG

### Verdict: STRONG ✅

---

## 2. On-Chain Payload

### kw-1 (text-only vault)
```json
{"t":"kw-1","v":2,"d":"<ciphertext>","s":"<salt-64-hex>"}
```

### kw-2 (text + media vault)
```json
{"t":"kw-2","v":2,"d":"<ciphertext>","s":"<salt-64-hex>","media":[{"id":"<entry-id>","idx":"<index-tx-id>"}]}
```

### kw-2i (per-file index transaction)
```json
{"t":"kw-2i","id":"<entry-id>","txs":["<chunk-txid>",...]}
```

- Salt validated as 64-char hex on recovery before storing
- Invalid payloads rejected entirely
- **Manifest TXs without the protocol's maker-fee output are rejected** during scan/recovery - same defence pattern as a marketplace fake-listing filter, prevents free-rider abuse

### Verdict: SAFE ✅

---

## 3. Browser Storage

| Location | Content | Sensitivity |
|---|---|---|
| localStorage `kassword_pk` | Wallet private key (hex) | HIGH |
| localStorage `kassword_data` | Encrypted vault (hex) | Medium |
| localStorage `kassword_salt` | Salt (hex) | Low |
| IndexedDB `kassword_media/files` | AES-256-GCM ciphertext (binary) | Low - encrypted |

Decrypted bytes never persist - memory only → blob URL → revoked on lock or modal close.

### Verdict: ACCEPTABLE ⚠️ (private key + Web Crypto in browser is the standard threat model)

---

## 4. DOM Security

- `esc()` HTML-escaping on every user-controlled value rendered to DOM
- UUID regex validation on entry IDs before any operation
- `createElement` + `textContent` in log functions - no `innerHTML` paths from user input
- Recovery debug log writes to DOM only, never to `console.log`
- Centralized `[KW]` logger; no debug dumps in production paths
- Anti-clickjacking: top-frame redirect on iframe embed
- `Permissions-Policy` and `X-Content-Type-Options` headers set

### Verdict: GOOD ✅

---

## 5. Session Security

- Auto-lock: 5 minutes inactivity
- On lock: `masterPass=null`, `vault=[]`, `privateKey=null`, `address=null`, `cpData={}`, all blob URLs revoked, all modals closed
- `beforeunload`: same cleanup on tab close
- Brute force: 5 attempts → 30s cooldown
- Password strength meter with weak-pattern detection (all-same-char, sequential digits, common prefixes)
- Recovery snapshot: prior `kassword_pk` / `kassword_salt` saved before recovery overwrites; restored if decrypt fails

### Verdict: STRONG ✅

---

## 6. Backup Integrity

- Pre-flight deep-scan: walks every prior kw-2 manifest before backup, restores any missing dagIdx into local vault, guarantees the new manifest references **every** media entry that's ever been backed up
- Hard-abort on unrecoverable entries: if any media has no DAG ref AND no IDB bytes, the backup refuses to proceed and lists the offending entries
- All TX submissions use `allowOrphan: false`
- Single-output pre-split avoids KIP-9 storage-mass dust trap (10^12/output_amount mass cap)
- Backup duplicate-click guard: button disables while in flight to prevent mempool TX collisions
- Manifest TX uses depth-1 reserved UTXO (auto-change from pre-split) - never competes with the deep chunk-chain

### Verdict: STRONG ✅

---

## 7. Media Vault & Chunked DAG Backup

### Encryption (unchanged from text path)
- Same AES-256-GCM + PBKDF2-1M + 2-factor as text entries
- Fresh 12-byte IV per `encryptBytes()` call
- 3 MB per file, 15 MB total enforced before encryption
- MIME whitelist: PNG, JPG, GIF, WebP, MP4, WebM, MP3, WAV, OGG

### Chunking & Upload
- 10 KB raw payload per chunk transaction
- Up to 6 ephemeral worker keys (derived via `SHA-256(walletKey + ':kw-chunk-worker:' + index)`)
- Parallel chunk upload across workers, contiguous slices preserve chunk order in the index TX
- Per-file index TX created from main wallet, listing every chunk txid in order
- Workers sweep remainder back to main on completion
- KIP-9 mass safety: each worker output ≥ 1 KAS keeps storage mass < 10K per output

### Worker Key Security
- Derived deterministically from main wallet key + index
- Exists only during backup execution
- Never persisted, never logged, never sent over network
- Re-derivable at any time for orphan-fund recovery (Recover worker funds button)

### Read Path
- Bulk fetch via `POST /transactions/search` (up to 100 txids per request) - single round-trip per 100 chunks instead of 100 individual GETs
- Per-chunk fallback for any chunk the bulk endpoint missed (4-attempt retry, 15s timeout, 429/503-aware)
- Foreground viewer pauses background prefetch to claim full bandwidth
- Decrypted bytes: in-memory ArrayBuffer → Blob → tracked blob URL → revoked on lock or modal close

### Verdict: STRONG ✅

---

## 8. Cross-Browser Recovery

- Walks wallet TX history (paginated, 50/page, max 5,000 TXs)
- Decodes payloads, validates salt, decrypts vault with provided key + password
- Restores vault entries, then resolves dagIdx for each media entry by:
  1. Reading inline `mf.txs` (kw-2 v1 legacy) OR
  2. Bulk-fetching index TXs by `mf.idx` (kw-2 v2)
- Deep-scan fallback: any media still missing dagIdx after the latest manifest → walks older manifests in TX history (early-exit when all targets resolved)
- Manifests without the protocol's maker fee are rejected - same enforcement as backup time

### Verdict: STRONG ✅

---

## 9. Supply Chain

- WASM SDK bundled locally, no CDN
- No npm, no build pipeline, no transpiler
- Single HTML file, ~120 KB
- Web Crypto, IndexedDB, fetch - all browser-native

### Verdict: STRONG ✅

---

## 10. Resolved Findings

| ID | Severity | Finding | Status |
|---|---|---|---|
| V-08 | CRITICAL | Silent backup failure - user pays, vault not saved | FIXED - Path B removed |
| C-2 | CRITICAL | `console.log` dumps recovery debug data | FIXED - removed |
| C-3 | CRITICAL | `saveEntry` rebuilt entry from form fields, silently dropped `dagChunks` / `dagIdx` on edit | FIXED - spreads existing entry first, form fields overlay |
| C-4 | CRITICAL | Backup silently dropped media with missing local bytes from chunkManifest, leaving partial manifests | FIXED - hard-abort with clear error listing affected entries |
| H-1 | HIGH | No `beforeunload` - secrets survive tab close | FIXED - handler added |
| H-2 | HIGH | Recovery accepts unvalidated payloads | FIXED - salt validated, fee verified |
| H-3 | HIGH | Password field not cleared on abandon | FIXED - cleared on lock |
| H-4 | HIGH | Pre-split with two explicit outputs left a dust change → KIP-9 mass overflow | FIXED - single explicit output, change auto-flows to main |
| H-5 | HIGH | Manifest TX could fail at depth 192+ in the chunk virtual-UTXO chain | FIXED - manifest uses depth-1 reserved UTXO from pre-split |
| H-6 | HIGH | `chunkManifest` overwrite bug in fresh-upload path silently dropped media references | FIXED - push() instead of index assignment |
| M-1 | MEDIUM | `isMedia` detection only checked IDB cache → text-tier backup after cache clear | FIXED - also checks dagIdx / dagChunks |
| M-2 | MEDIUM | Free-rider risk: anyone could craft a kw-2 payload TX without paying maker fee and have it surface in recovery | FIXED - manifest fee verification on every kw scan candidate |
| M-3 | MEDIUM | Sequential chunk fetcher → api.kaspa.org rate-limit storms | FIXED - bulk endpoint primary, per-chunk fallback only |
| M-4 | MEDIUM | Backup duplicate-click could trigger mempool TX collision | FIXED - in-flight guard disables button |

---

## 11. Remaining Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Malicious browser extension reads localStorage | HIGH | Clean browser profile, never run on shared machines |
| OS-level keylogger | HIGH | Out of scope for browser apps |
| Compromised host file injection | MEDIUM | Run locally, integrity-check the HTML before launch |
| Weak password if localStorage stolen | MEDIUM | 2-factor + strength enforcement |
| Physical access to unlocked machine | MEDIUM | Auto-lock 5 min |
| api.kaspa.org indexer downtime | LOW | Bulk + per-chunk fallback; user can retry, run a local archival node, or use mirror endpoints |
| Future quantum attacks on secp256k1 wallet signing | LOW | AES-256 already quantum-safe (symmetric); migrate when KIP-22 P2MR ships post-Toccata |

---

## 12. Final Verdict

| Category | Score |
|---|---|
| Cryptographic design | 10/10 |
| On-chain payload security | 10/10 |
| Session security | 10/10 |
| Backup integrity | 10/10 |
| Media vault security | 10/10 |
| Cross-browser recovery | 10/10 |
| Input sanitization | 9/10 |
| Supply chain | 9/10 |
| Browser storage model | 6/10 |
| **Overall** | **9/10 - Production-ready** |

The `9/10` ceiling reflects browser storage as the second factor (private key in localStorage). This is the same trade-off every browser-side wallet makes; mitigated by the 2-factor design where the password is also required, and by user-side practices (clean profile, offline backup of vault key).

---

*Audit reflects kw-2 v2 codebase with on-DAG media vault, parallel chunk pipeline, fee verification, and multi-manifest recovery. April 2026.*
