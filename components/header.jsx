'use client';

import { UnifiedWalletButton } from '@jup-ag/wallet-adapter';
import ThemeToggle from './theme-toggle';
import Image from 'next/image';
import PriceTicker from './PriceTicker';

export default function Header() {
    return (
        <>
            <PriceTicker />
            <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
                <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Image src="/logo.svg" alt="Rialo Pulse" className="w-28 h-10" width={128} height={28} />
                    </div>

                    <div className="flex items-center gap-3">
                        <ThemeToggle />
                        <UnifiedWalletButton />
                    </div>
                </div>
            </header>
        </>
    );
}
