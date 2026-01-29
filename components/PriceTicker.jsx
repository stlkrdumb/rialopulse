import { useEffect, useState } from 'react';
import { PYTH_FEED_IDS, getCurrentPrice, formatPrice } from '@/utils/pyth';

const ASSETS = Object.keys(PYTH_FEED_IDS);

// Asset metadata for styling
const ASSET_META = {
    BTC: { symbol: '₿', color: 'text-orange-400' },
    ETH: { symbol: 'Ξ', color: 'text-blue-400' },
    SOL: { symbol: '◎', color: 'text-purple-400' },
    BNB: { symbol: 'BNB', color: 'text-yellow-500' },
    XRP: { symbol: 'XRP', color: 'text-blue-300' },
    ADA: { symbol: '₳', color: 'text-blue-500' },
    DOGE: { symbol: 'Ð', color: 'text-yellow-300' },
    AVAX: { symbol: '🔺', color: 'text-red-500' },
    LINK: { symbol: 'LINK', color: 'text-blue-600' },
    DOT: { symbol: 'DOT', color: 'text-pink-500' },
};

export default function PriceTicker() {
    // Initialize state with all assets from metadata
    const [prices, setPrices] = useState(
        ASSETS.reduce((acc, asset) => ({
            ...acc,
            [asset]: { price: null, loading: true, error: null }
        }), {})
    );

    const fetchPrice = async (asset) => {
        try {
            const feedId = PYTH_FEED_IDS[asset];
            if (!feedId) return;

            const priceData = await getCurrentPrice(feedId);

            setPrices(prev => ({
                ...prev,
                [asset]: {
                    price: priceData,
                    loading: false,
                    error: null,
                }
            }));
        } catch (error) {
            console.error(`Error fetching ${asset} price:`, error);
            setPrices(prev => ({
                ...prev,
                [asset]: {
                    price: null,
                    loading: false,
                    error: error.message,
                }
            }));
        }
    };

    useEffect(() => {
        // Fetch all initial prices
        ASSETS.forEach(asset => fetchPrice(asset));

        // Update every 10 seconds
        const interval = setInterval(() => {
            ASSETS.forEach(asset => fetchPrice(asset));
        }, 10000);

        return () => clearInterval(interval);
    }, []);

    const renderPrice = (asset, data) => {
        if (!data) return null;

        if (data.loading) {
            return <span className="text-gray-500 text-xs">...</span>;
        }

        if (data.error) {
            return <span className="text-red-500/50 text-xs">err</span>;
        }

        if (!data.price) {
            return <span className="text-gray-500 text-xs">--</span>;
        }

        const formattedPrice = formatPrice(data.price.price, data.price.expo);

        return (
            <span className="font-mono font-semibold text-white/90">
                ${formattedPrice}
            </span>
        );
    };

    return (
        <div className="bg-black/40 border-b border-primary overflow-hidden backdrop-blur-sm relative z-50">
            {/* Gradient masks for smooth fade edges */}
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

            <div className="py-2 flex whitespace-nowrap animate-marquee hover:[animation-play-state:paused] w-max">
                {/* Render the list twice to create seamless loop effect */}
                {[...ASSETS, ...ASSETS].map((asset, index) => {
                    const uniqueKey = `${asset}-${index}`;
                    const meta = ASSET_META[asset] || { symbol: asset, color: 'text-gray-400' };
                    const priceData = prices[asset];

                    return (
                        <div key={uniqueKey} className="flex items-center gap-2 mx-6 text-sm">
                            <span className={`font-bold ${meta.color} flex items-center gap-1`}>
                                {meta.symbol !== asset && <span>{meta.symbol}</span>} {asset}/USD:
                            </span>
                            {renderPrice(asset, priceData)}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
