# Kassword

A post-quantum password vault and an on-chain covenant wallet for Kaspa, with the application logic concentrated in one HTML file (plus locally vendored crypto and PWA support files). No backend, no accounts, no telemetry. Everything is encrypted in your browser and stays there, unless you choose to write an encrypted backup to the Kaspa BlockDAG.

## What it is

One sealed page, two things:

**A vault.** Passwords, logins, notes, cards, IDs, wallet backups, small files. Encrypted at rest with Argon2id key stretching, XChaCha20-Poly1305, and a post-quantum ML-KEM-1024 + ML-DSA-87 envelope. There is no server to store any of it, because there is no server.

**Kaspa Locker.** Lock KAS in an on-chain vault whose spending rules are enforced by Kaspa consensus, not by us. You arm any mix of six unlock branches:

- **Schnorr** open with this wallet (optional master-password 2-factor)
- **HLMT** cold-sign one-time keys, hash-committed (final signature is Kaspa Schnorr; the sig-less quantum-resistant branch is PQ-cold below)
- **HTLC** digital escrow / cash drop: the committed recipient claims by revealing a secret you hand them out-of-band plus their own wallet signature; the payout is pinned to their address
- **DMS** dead-man switch / inheritance: an heir can claim after a fixed deploy-time deadline passes (staying active does not postpone it; refresh by respending before the deadline)
- **Recovery** M-of-N trustee signatures after a fixed absolute deadline, paying only the recovery address committed at deploy
- **PQ-cold** sig-less, with the payout fixed by consensus

For every keyless branch the payout address and amount are pinned inside the redeem script, so the network itself guarantees the funds can only go where you set them. There is no Kassword server. By default the app reaches Kaspa through public nodes and the public REST API (api.kaspa.org, *.kaspa.stream); you can point it at your own local node instead. Your keys and secrets never leave the browser unencrypted either way; encrypted vault backups and recovery envelopes leave only when you choose to write them to the BlockDAG.

## Crypto

- Argon2id master-password stretch, custom browser profile: 64 MiB, 3 iterations, 1 lane (RFC 9106's recommended 64 MiB profile uses 4 lanes; this is not that profile)
- XChaCha20-Poly1305 vault encryption
- ML-KEM-1024 (FIPS-203, NIST Level 5) key encapsulation
- ML-DSA-87 (FIPS-204, NIST Level 5) signatures
- BLAKE2b Merkle trees for the cold-key covenants
- CSP with the inline module pinned by SHA-256; the Kaspa WASM signer pinned by SHA-384 and re-verified on every load, hard-halt on mismatch

## Running it

It is a PWA, so serve it over http. A service worker and ES modules do not run from a `file://` path.

- Windows: double-click `start.bat` (needs Python 3).
- Any OS: `python serve_nocache.py 7852`, then open `http://127.0.0.1:7852/index.html`.
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

Then the covenant branches were exercised against real vaults deployed on mainnet, and representative hostile attempts were refused: a wrong-destination cold spend was rejected by the node and never mined, and the app-level checks refused malformed or misdirected inputs before broadcast. Only the legitimate spends succeeded

This build was also exercised at scale: an archived local test run recorded 1,500 vault deploys and 1,500 unlocks on mainnet across the four harnessed styles (Schnorr, PQ-cold, HTLC, DMS). Each deploy carries the same encrypted on-chain recovery envelope the app writes, and each unlock reveals its covenant redeem script.

## Notes before you trust it with anything

- The master password is a real access gate, not just local encryption. Without it the vault and the UI-gated wallet features stay closed.
- Back up your vault key. An imported wallet is recoverable only from its key plus the password.
- Writing an encrypted backup to the BlockDAG is an on-chain transaction: it carries a protocol fee (a few KAS) on top of the normal network fee, and the exact total is shown before you sign. Opening the app, using the vault, locking and unlocking, and sending KAS cost only the normal network fee.
- The application logic is one static HTML file, alongside the pinned Kaspa WASM SDK, the pinned post-quantum bundle, and the PWA support files. Read it. Host it yourself if you prefer.

## Contents

- `index.html` the whole app
- `sw.js`, `manifest.json` PWA shell
- `kw-pq.js` post-quantum module
- `kaspa/` the Kaspa WASM SDK, from kaspanet/rusty-kaspa (ISC), vendored so the app runs fully offline
- `icons/`, `serve_nocache.py`, `start.bat` icons and a local no-cache server

## License

MIT - see [`LICENSE`](./LICENSE). Free to read, use, modify, and self-host; keep the copyright notice. Provided as-is, with no warranty. The bundled Kaspa WASM SDK under `kaspa/` is ISC-licensed by the Kaspa developers; that notice is included at the end of `LICENSE`. You are responsible for your own keys, passwords, and funds. This is not financial advice.
