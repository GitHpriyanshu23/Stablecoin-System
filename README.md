# Stablecoin System

A collateral-backed Midnight stablecoin pegged to fiat (USD), with private vault ownership proofs and public supply/collateral accounting.

## Contract Address

**This section is mandatory.** Replace the placeholder after you deploy the Compact contract.

| Network | Contract Address |
|---------|------------------|
| Preprod | `<YOUR_DEPLOYED_CONTRACT_ADDRESS>` |

```env
CONTRACT_ADDRESS=<YOUR_DEPLOYED_CONTRACT_ADDRESS>
VITE_CONTRACT_ADDRESS=<YOUR_DEPLOYED_CONTRACT_ADDRESS>
```

Do **not** remove the placeholder until you have a real deployed address.

## Features

- Open a collateralized vault and mint stablecoins (150% minimum collateralization)
- Add collateral to an existing vault
- Mint additional stablecoins against excess collateral
- Close a vault by fully repaying debt and withdrawing collateral
- Lace wallet integration in the browser UI
- CLI for deploy/join and vault operations on Preprod / Preview / standalone
- Zero-knowledge ownership proofs via Compact witnesses and `disclose()`

## What This Project Does

Users lock collateral and mint a fiat-pegged stablecoin. The ledger tracks aggregate supply and collateral publicly, while each user's secret key stays private. Opening, minting, and closing require proving vault ownership in zero knowledge without revealing that secret key.

## Privacy Model

### Public information

- Vault open/closed status
- Total stablecoin supply and total collateral locked
- Active vault collateral and debt amounts (disclosed for ledger updates)
- Minimum collateral ratio (15000 bps = 150%)
- Owner commitment (hash of secret key + sequence nonce)

### Private information

- User secret key (`localSecretKey` witness)
- Pending operation amounts held in local private state before disclosure
  (`privateCollateralUnits`, `privateStableUnits`)

### What users prove without revealing

- That they know the secret key corresponding to the vault owner commitment
- That mint/redeem operations preserve the 150% collateralization rule
- Without publishing the secret key itself

## Tech Stack

- Midnight Compact (`stablecoin.compact`)
- Midnight.js contract / proof / indexer providers
- TypeScript + npm workspaces
- React + Vite + MUI (browser UI)
- Lace wallet connector
- Docker proof server
- Node.js CLI

## Folder Structure

```
stablecoin-system/
├── contract/               # Compact contract + witnesses + tests
│   └── src/stablecoin.compact
├── api/                    # Contract interaction layer shared by CLI/UI
├── bboard-cli/             # Command-line interface (scaffold folder name)
├── bboard-ui/              # Web UI (scaffold folder name)
├── .env.example            # Environment variable template
└── README.md
```

## Prerequisites

1. **Node.js v22+** (`node --version`)
2. **Docker** installed and running (proof server)
3. **Compact toolchain** (`compact --version`)
4. **Lace wallet** (UI only), network set to Preprod, local proof server `http://localhost:6300`
5. Preprod faucet funds + tDUST for fees

### Midnight documentation MCP

Connect Midnight docs before development:

```bash
claude mcp add --transport http midnight-docs https://midnight.mcp.kapa.ai
```

Or in Cursor: Settings → MCP → Add Server:

```
npx -y @midnight-ntwrk/mcp-server
```

This repo also includes `.cursor/mcp.json` with Midnight MCP entries.

## Installation

```bash
# Proof server (if not already running)
docker pull midnightnetwork/proof-server
docker run -p 6300:6300 midnightnetwork/proof-server

# Root workspace install
npm install

# Package installs (also covered by workspaces, but explicit per challenge checklist)
cd api && npm install && cd ..
cd contract && npm install && cd ..
cd bboard-cli && npm install && cd ..
cd bboard-ui && npm install && cd ..
```

## Compile

```bash
npm run compact
```

Or:

```bash
cd contract
npm run compact
cd ..
```

## Build

```bash
npm run build
```

CLI-only:

```bash
cd bboard-cli
npm install
npm run build
cd ..
```

UI-only:

```bash
cd bboard-ui
npm run build
cd ..
```

## Manual Deployment

Deployment is **intentionally skipped** in this repository state.

When you are ready, deploy manually with:

```bash
NODE_OPTIONS="--max-old-space-size=12288" npm run deploy -- --network preprod
```

Equivalent CLI entrypoint:

```bash
cd bboard-cli
NODE_OPTIONS="--max-old-space-size=12288" npm run preprod-remote
```

Choose the deploy option in the CLI menu and copy the printed contract address.

## After Deployment

The only remaining manual steps are:

1. Deploy the Compact contract (command above).
2. Copy the deployed contract address.
3. Replace every occurrence of:

```text
<YOUR_DEPLOYED_CONTRACT_ADDRESS>
```

Typical files to update:

- `README.md`
- `.env.example`
- `bboard-ui/.env.preprod`
- `bboard-ui/.env.preview`
- `api/src/common-types.ts` (`CONTRACT_ADDRESS`)

No additional coding should be required after that replacement.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `CONTRACT_ADDRESS` | Deployed Compact contract address placeholder |
| `VITE_CONTRACT_ADDRESS` | Browser UI configured join address |
| `VITE_NETWORK_ID` | Midnight network id (`preprod`, `preview`, …) |
| `VITE_LOGGING_LEVEL` | Pino log level for the UI |

## Screenshots

<!-- Add screenshots after running the UI locally -->

- `[screenshot-home]`
- `[screenshot-open-vault]`
- `[screenshot-vault-open]`

## Initial Idea

<!-- Fill in your Rise In initial idea write-up -->

Stablecoin System: A collateral-backed or algorithmic stablecoin pegged to a fiat currency.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Compact compile fails | Ensure `compact --version` works, then rerun `npm run compact` from repo root or `contract/` |
| Proof / tx errors | Confirm Docker proof server is running on port `6300` |
| Wallet not found | Install Lace, enable Midnight, set network to Preprod, allow the DApp |
| Insufficient funds | Use the Preprod faucet and generate tDUST in Lace |
| Join configured address fails | Replace `<YOUR_DEPLOYED_CONTRACT_ADDRESS>` with a real address first |
| Node engine warnings | Use Node.js v22+ (repo engines allow `>=22`) |
| UI build missing keys/zkir | Compile the contract first so `contract/src/managed/stablecoin` exists |

## License

Apache-2.0 / MIT as inherited from the Midnight scaffold packages.
