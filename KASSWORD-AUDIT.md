# Kassword — Security Audit
**Version:** v1 (kw-1 protocol)
**Date:** April 2026
**Audited by:** KasRanks

---

## 1. Cryptographic Engine

### Key Derivation
- **Algorithm:** PBKDF2-SHA256
- **Iterations:** 1,000,000
- **Salt:** 32 bytes, cryptographically random, unique per vault, stored in localStorage and embedded in DAG payload
- **Input:** `password + '::' + walletPrivateKey (256-bit random hex)`
- **Output:** 256-bit AES-GCM key

### 2-Factor Design
The encryption key is derived from two independent secrets:
1. The user's master password (human-chosen)
2. A 256-bit random wallet private key (machine-generated)

Neither factor alone can decrypt the vault. An attacker who obtains the encrypted payload from the blockchain still faces a brute force space of `password_space × 2^256` — computationally impossible regardless of password strength.

### Encryption
- **Algorithm:** AES-256-GCM
- **IV:** 12 bytes, cryptographically random, unique per encryption operation
- **Authentication:** GCM provides authenticated encryption — tampered ciphertext is rejected before decryption
- **Implementation:** Web Crypto API (browser-native, hardware-accelerated, not a JS reimplementation)

### Verdict: STRONG ✅
The cryptographic design is sound. The 2-factor key derivation is the primary security innovation and it works correctly.

---

## 2. On-Chain Payload

### Structure
```json
{
  "t": "kw-1",
  "v": 2,
  "d": "<AES-256-GCM ciphertext, hex>",
  "s": "<32-byte salt, hex>"
}
```

### What an attacker sees on the explorer
- Ciphertext blob (unreadable without both keys)
- Salt (needed for key derivation — not a secret, standard practice)
- Protocol identifier `kw-1`
- Version `2`

### What an attacker cannot derive
- Master password
- Wallet private key
- Any plaintext content

### Verdict: SAFE ✅
The on-chain data leaks no sensitive information. The salt being public is by design and does not weaken security when PBKDF2 iterations are high and a 256-bit second factor is required.

---

## 3. Browser Storage

### What is stored in localStorage
| Key | Content | Sensitivity |
|---|---|---|
| `kassword_pk` | 256-bit wallet private key (hex) | **HIGH** — second encryption factor |
| `kassword_data` | AES-256-GCM ciphertext | Medium — unreadable without both keys |
| `kassword_salt` | 32-byte salt (hex) | Low — public in DAG payload anyway |

### Risk
localStorage is readable by:
- Malicious browser extensions
- XSS attacks (if hosted on a server with injected scripts)
- Anyone with physical access to an unlocked machine

### Mitigation
- `kassword_data` alone is useless without the master password
- `kassword_pk` alone is useless without the master password
- Both together still require brute-forcing the password — but with only the wallet key factor active, a weak password becomes the bottleneck
- **Recommendation to users:** use a clean browser profile with no third-party extensions

### Verdict: ACCEPTABLE for a browser-based vault ⚠️
This is the same threat model as every browser-based password manager (Bitwarden web, 1Password web, etc.). The 2-factor design mitigates but does not eliminate the risk of localStorage exposure.

---

## 4. Input Handling & DOM Security

### Implemented
- All password and sensitive inputs: `autocomplete="off"`, `autocapitalize="none"`, `autocorrect="off"`, `spellcheck="false"` — browser/keyboard will not cache or suggest sensitive data
- `log()` and `dlog()` functions use `createElement` + `textContent` — no innerHTML with user data in debug output
- Entry IDs validated with UUID regex before DOM use
- Entry card onclick uses `esc()` sanitization on IDs

### Not implemented
- CSP (Content Security Policy) — intentionally excluded. The Kaspa WASM SDK requires JavaScript execution capabilities that CSP's `default-src` blocks, causing `createTransactions()` to silently fail. Adding CSP without deep SDK modification is not viable.

### Verdict: GOOD ✅
The remaining innerHTML usage (`renderVault`, `viewEntry`) operates on vault data that has already been decrypted and parsed — not on raw user input or network responses. XSS via these paths requires first decrypting the vault, which requires both keys.

---

## 5. Network & Headers

### Implemented
- `Referrer-Policy: no-referrer` — no URL leakage to third parties
- `Permissions-Policy` — disables camera, microphone, geolocation, USB, display capture, and other sensitive browser APIs
- `X-Content-Type-Options: nosniff` — prevents MIME type sniffing
- Anti-iframe script — `window.top !== window.self` check prevents clickjacking
- Fonts loaded with `crossorigin` attribute for proper CORS isolation

### External requests made by the app
| Destination | Purpose | Risk |
|---|---|---|
| `fonts.googleapis.com` | UI fonts | Low — no sensitive data sent |
| `fonts.gstatic.com` | Font files | Low — no sensitive data sent |
| `api.kaspa.org` | DAG recovery (REST) | Low — only queries public blockchain data |
| Kaspa resolver / `ws://127.0.0.1:16110` | RPC connection for TX | Low — standard Kaspa network |

### Verdict: GOOD ✅

---

## 6. Session Security

### Auto-lock
- Triggers after **5 minutes** of inactivity (no mouse, keyboard, or click events)
- On lock: `masterPass = null`, vault array cleared, all cached decrypted data wiped from memory
- Password input fields cleared on lock

### Brute Force Protection
- **5 failed attempts** → 30-second cooldown
- Pattern detection: all-same-character passwords (`00000000`, `aaaaaaaa`) are rejected
- Minimum password length: 8 characters (12+ recommended)
- Password strength meter with real-time feedback

### Verdict: STRONG ✅

---

## 7. Supply Chain

### Dependencies
- **Kaspa WASM SDK** (`kaspa.js` + `kaspa_bg.wasm`) — bundled locally in the repository. No CDN. No remote fetch at load time. The exact files are locked to the repo.
- **Google Fonts** — loaded from Google's CDN. Fonts are presentation-only; compromise of this CDN cannot affect cryptographic operations or vault data.
- **No npm, no webpack, no build pipeline** — single HTML file, zero external JS dependencies beyond the bundled WASM SDK.

### Verdict: STRONG ✅
The only meaningful supply chain risk is if the repository itself is compromised and the WASM SDK files are swapped. Users can verify the SDK files against the official Kaspa releases.

---

## 8. What Cannot Be Attacked From the Chain

| Attack | Possible? | Reason |
|---|---|---|
| Decrypt vault from payload alone | ❌ No | Requires master password + wallet key |
| Brute force password from payload | ❌ No | 2^256 wallet key factor makes it impossible |
| Reverse-engineer vault structure | ❌ No | AES-GCM ciphertext is indistinguishable from random |
| Identify protocol from payload | ✅ Yes | `"t":"kw-1"` is visible — by design, not a risk |
| Rainbow table attack | ❌ No | Random 32-byte salt + 1M PBKDF2 iterations eliminates this |
| Replay attack | ❌ No | Recovery requires decryption, not just payload presence |

---

## 9. Remaining Risks (Honest Assessment)

| Risk | Severity | Mitigation |
|---|---|---|
| Malicious browser extension reads localStorage | HIGH | User education — clean profile, no extensions |
| Keylogger on OS captures master password | HIGH | OS-level — no browser app can prevent this |
| XSS if hosted on compromised server | MEDIUM | Use locally; if hosted, serve over HTTPS only |
| Weak master password if localStorage stolen | MEDIUM | Password strength enforced + 2-factor design |
| Physical access to unlocked machine | MEDIUM | Auto-lock after 5 minutes |
| Google Fonts CDN compromise | LOW | Fonts only — no access to crypto or vault data |

---

## 10. Final Verdict

| Category | Score | Notes |
|---|---|---|
| Cryptographic design | 10/10 | AES-256-GCM + PBKDF2-1M + 2-factor is excellent |
| On-chain payload security | 10/10 | Zero sensitive data exposed |
| Input sanitization | 8/10 | autocomplete/spellcheck hardened; no CSP (WASM limitation) |
| Session security | 9/10 | Auto-lock, brute force protection, memory clearing |
| Supply chain | 9/10 | Fully bundled, no CDN for critical assets |
| Browser storage model | 6/10 | localStorage is the inherent weakness of all web vaults |
| **Overall** | **8.5/10** | **Production-ready for public launch** |

### Summary

Kassword's cryptographic foundation is strong. The 2-factor key derivation design means the on-chain payload is permanently unreadable without both independent secrets. The remaining risks are inherent to the browser environment and are shared by every web-based password manager in existence. Users who follow the security best practices (clean browser profile, no extensions, strong password, save vault key offline) have a security posture that is genuinely difficult to attack.

**Ready for public launch. ✅**

---

*Audit reflects the current codebase as of the kw-1 protocol release.*
