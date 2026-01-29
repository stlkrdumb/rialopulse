# Rialopulse - Solana Prediction Markets

A decentralized prediction market platform built on Solana using Anchor and Next.js.

## Prerequisites

- [Rust & Cargo](https://doc.rust-lang.org/cargo/getting-started/installation.html)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools)
- [Anchor](https://www.anchor-lang.com/docs/installation)
- [Node.js & Yarn](https://yarnpkg.com/getting-started/install)

## Getting Started

### 1. Start the Local Solana Validator

Open a terminal and run the local validator. This simulates the blockchain on your machine.

```bash
solana-test-validator
```

*Keep this terminal running.*

### 2. Deploy the Smart Contract (Backend)

Open a new terminal to build and deploy the Anchor program.

```bash
cd solana-prediction-market
anchor build
anchor deploy
```

**Note:** Ensure your `solana-test-validator` is running. `anchor deploy` will output the Program ID. It should match the one in `lib/idl/solana_prediction_market.json` (`D8dL...`).

### 3. Run the Frontend

In the project root (where `package.json` is):

```bash
# Install dependencies if you haven't
npm install

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Usage

1.  **Connect Wallet**: Use Phantom or Solflare (set to **Localnet** or **Devnet** depending on where you are running).
    - If running locally, ensure your wallet is connected to `http://127.0.0.1:8899`.
    - You may need to airdrop funds to your wallet: `solana airdrop 10 <YOUR_WALLET_ADDRESS>`

2.  **Create Market**:
    - Go to the **Create Market** tab.
    - Click **Init Mock Feed** (this initializes a mock price oracle).
    - Enter Asset (e.g., BTC) and Duration (e.g., 60 seconds).
    - Click **Create Market**.

3.  **Bet & Resolve**:
    - Go to **Browse Markets**.
    - Click **Up** or **Down** to place a bet.
    - Wait for the duration to expire.
    - Click **Resolve (Dev Check)** to finalize the market using the mock oracle price.
