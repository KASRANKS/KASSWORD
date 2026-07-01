# Kassword

A post-quantum password vault and an on-chain covenant wallet for Kaspa, in one HTML file. No backend, no accounts, no telemetry. Everything is encrypted in your browser and stays there, unless you choose to write an encrypted backup to the Kaspa BlockDAG.

## What it is

One sealed page, two things:

**A vault.** Passwords, logins, notes, cards, IDs, wallet backups, small files. Encrypted at rest with Argon2id key stretching, XChaCha20-Poly1305, and a post-quantum ML-KEM-1024 + ML-DSA-87 envelope. There is no server to store any of it, because there is no server.

**Kaspa Locker.** Lock KAS in an on-chain vault whose spending rules are enforced by Kaspa consensus, not by us. You arm any mix of six unlock branches:

- **Schnorr** open with this wallet (optional master-password 2-factor)
- **HLMT / PQ** quantum-resistant cold key
- **HTLC** digital escrow / cash drop: the recipient claims by revealing a secret you hand them out-of-band
- **DMS** dead-man switch / inheritance: an heir can claim after you go silent past a time-lock
- **Recovery** an M-of-N trustee quorum, after a time-lock
- **PQ-cold** sig-less, with the payout fixed by consensus

For every keyless branch the payout address and amount are pinned inside the redeem script, so the network itself guarantees the funds can only go where you set them. There is no Kassword server. By default the app reaches Kaspa through public nodes and the public REST API (api.kaspa.org, *.kaspa.stream); you can point it at your own local node instead. Your keys and vault never leave the browser either way.

## Crypto

- Argon2id (RFC 9106) master-password stretch, 64 MiB, 3 iterations
- XChaCha20-Poly1305 vault encryption
- ML-KEM-1024 (FIPS-203, NIST Level 5) key encapsulation
- ML-DSA-87 (FIPS-204, NIST Level 5) signatures
- BLAKE2b Merkle trees for the cold-key covenants
- CSP with the inline module pinned by SHA-256; the Kaspa WASM signer pinned by SHA-384 and re-verified on every load, hard-halt on mismatch

## Running it

It is a PWA, so serve it over http. A service worker and ES modules do not run from a `file://` path.

- Windows: double-click `start.bat` (needs Python 3).
- Any OS: `python serve_nocache.py`, then open the localhost URL it prints.
- Or drop the folder behind any static host.

Install it from the browser to keep an offline copy. A cold device can then reopen it in airplane mode.

`mainnet/` targets Kaspa mainnet. `testnet/` is the same app built for testnet-10, for trying things out. They share the same covenant and crypto code and differ in the network they connect to, the addresses they use, and the endpoints they allow.

## Tested on mainnet

This build was run on Kaspa mainnet, not only locally:

- Send, send-all, and every vault style deployed and unlocked on mainnet.
- Escrow claimed by a separate recipient wallet with the REST API switched off (node RPC only), to prove the vault needs no third-party service.
- Inheritance claimed by a separate heir wallet after the time-lock, with no key of the owner's.
- A full two-device cold/hot air-gap cycle: the offline device signs, the online device broadcasts, the signing key never goes online.
- An encrypted vault written to the BlockDAG and recovered on a fresh device.

Then the covenants were attacked. Against real vaults deployed on mainnet, 18 hostile spends were fired across the escrow, inheritance, M-of-N and cold-pin branches: wrong preimage, wrong signer, preimage replay, payout redirect, extra-output siphon, fee-burn, short quorum, duplicate signer, out-of-order signatures, forged leaf signatures. Kaspa consensus rejected all 18. Only the legitimate spends were accepted, and every principal came back. The redeem-script logic was reviewed line by line on top of that.

## Notes before you trust it with anything

- The master password is a real access gate, not just local encryption. Without it the vault and the UI-gated wallet features stay closed.
- Back up your vault key. An imported wallet is recoverable only from its key plus the password.
- Writing an encrypted backup to the BlockDAG is an on-chain transaction: it carries a protocol fee (a few KAS) on top of the normal network fee, and the exact total is shown before you sign. Opening the app, using the vault, locking and unlocking, and sending KAS cost only the normal network fee.
- It is one static file plus the pinned Kaspa WASM SDK. Read it. Host it yourself if you prefer.

## Contents

- `index.html` the whole app
- `sw.js`, `manifest.json` PWA shell
- `kw-pq.js` post-quantum module
- `kaspa/` the Kaspa WASM SDK, from kaspanet/rusty-kaspa (ISC), vendored so the app runs fully offline
- `icons/`, `serve_nocache.py`, `start.bat` icons and a local no-cache server

## License

TBD by the author. Provided as-is. You are responsible for your own keys, passwords, and funds. This is not financial advice.
