'use client';

import { useMemo } from 'react';
import { UnifiedWalletProvider } from '@jup-ag/wallet-adapter';
import { createSolanaRpc } from '@solana/kit';

import { ConnectionProvider } from '@solana/wallet-adapter-react';

export default function SolanaProvider({ children }) {
    // Use devnet for development
    const endpoint = `https://devnet.helius-rpc.com/?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`;

    // Create RPC client using @solana/kit
    const rpc = useMemo(() => createSolanaRpc(endpoint), [endpoint]);

    // Configure Jupiter Unified Wallet
    const walletConfig = {
        autoConnect: true,
        env: 'devnet',
        metadata: {
            name: 'Rialopulse',
            description: 'Decentralized prediction market platform on Solana',
            url: 'https://rialopulse.app',
            iconUrls: [],
        },
        notificationCallback: {
            onConnect: () => console.log('Wallet connected'),
            onConnecting: () => console.log('Connecting wallet...'),
            onDisconnect: () => console.log('Wallet disconnected'),
            onNotInstalled: () => console.log('Wallet not installed'),
        },
        walletlistExplanation: {
            href: 'https://station.jup.ag/docs/additional-topics/wallet-list',
        },
        theme: 'dark',
        lang: 'en',
    };

    return (
        <ConnectionProvider endpoint={endpoint}>
            <UnifiedWalletProvider
                wallets={[]}
                config={walletConfig}
            >
                {children}
            </UnifiedWalletProvider>
        </ConnectionProvider>
    );
}
