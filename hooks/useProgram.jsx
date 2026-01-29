import { useMemo } from 'react';
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from "@solana/web3.js";
import IDL from "../idl/solana_prediction_market.json";

export const PROGRAM_ID = new PublicKey(IDL.address);

export function useProgram() {
    const { connection } = useConnection();
    const wallet = useWallet();

    const program = useMemo(() => {
        if (!connection) return null;

        // AnchorProvider requires a wallet, but for read-only we can use a dummy
        // However, useWallet() always returns an object, even if not connected (publicKey is null)
        const provider = new AnchorProvider(connection, wallet, {
            commitment: "confirmed",
        });

        return new Program(IDL, provider);
    }, [connection, wallet]);

    return { program, PROGRAM_ID };
}
