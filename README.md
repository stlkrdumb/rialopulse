# Rialopulse - Solana Prediction Markets

Rialopulse is a decentralized prediction market platform built on the Solana blockchain. Users can predict the price movement of assets (like BTC/USD) within a specified timeframe and win rewards for correct predictions.

Built with **Anchor** framework for the smart contracts and **Next.js** for the frontend interface.

## Features

- **Binary Options**: Simple "Up" or "Down" betting mechanism.
- **Oracle Integration**: Uses Pyth Network price feeds for accurate asset pricing (supports simulated/mock feeds for local development).
- **Automated Resolution**: Markets are resolved based on the final price relative to the strike price.
- **Non-Custodial**: Funds are held in a secure program vault until resolution.
- **Inverted Markets**: Supports "Below" target betting logic.

## Prerequisites

Ensure you have the following installed on your machine:

- [Rust](https://www.rust-lang.org/tools/install)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools)
- [Anchor](https://www.anchor-lang.com/docs/installation)
- [Node.js](https://nodejs.org/en/download/) (v18+ recommended)
- [Yarn](https://yarnpkg.com/getting-started/install)

## Getting Started

Follow these steps to set up the project locally.

### 1. Clone the Repository

```bash
git clone <repository-url>
cd rialopulse
```

### 2. Smart Contract Setup (Backend)

1.  **Start Local Validator**:
    Open a new terminal and run:

    ```bash
    solana-test-validator
    ```

    _Keep this terminal running._

2.  **Build and Deploy**:
    Open a second terminal in the project root:

    ```bash
    anchor build

    # Get your program ID
    solana address -k target/deploy/solana_prediction_market.json
    ```

    _Note: Update `lib.rs` and `Anchor.toml` if your generated Program ID differs from the one in the code (`a1fq...` or `D8dL...`)._

    ```bash
    anchor deploy
    ```

### 3. Frontend Setup

1.  **Install Dependencies**:

    ```bash
    npm install
    # or
    yarn install
    ```

2.  **Run Development Server**:

    ```bash
    npm run dev
    # or
    yarn dev
    ```

3.  **Access the App**:
    Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage Guide

### 1. Connect Wallet

- Click **Connect Wallet** in the top right.
- Use a wallet like **Phantom** or **Solflare**.
- Ensure your wallet is connected to **Localnet** (or Devnet if deployed there).
- **Airdrop Funds**:
  ```bash
  solana airdrop 10 <YOUR_WALLET_ADDRESS> --url localhost
  ```

### 2. Create a Market (Admin)

- Navigate to the **Create Market** tab.
- **Init Mock Feed**: Click this to initialize a mock price feed (required for local testing without live Pyth feeds).
- **Details**: Enter the Asset (e.g., BTC), Duration (seconds), and current price.
- **Create**: Confirm the transaction to initialize the market on-chain.

### 3. Place a Bet

- Go to **Browse Markets**.
- Select a market and choose **Up** (Long) or **Down** (Short).
- Enter the amount of SOL to wager.
- Confirm the transaction.

### 4. Resolve Market

- Once the duration expires, the market needs to be resolved.
- In a production environment, this would be automated by a keeper.
- For testing, click **Resolve (Dev Check)** on the market card to manually trigger resolution using the mock oracle price.

## Project Structure

- `programs/`: Solana smart contracts (Rust/Anchor).
- `app/`: Frontend application (Next.js, React, Tailwind).
- `tests/`: Integration tests for the smart contracts.
- `migrations/`: Deploy scripts.

## Testing

Run the integration tests to verify smart contract logic:

```bash
anchor test
```
