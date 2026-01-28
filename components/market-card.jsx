'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Users, Clock } from 'lucide-react';

export default function MarketCard({ market }) {
    const [selectedOption, setSelectedOption] = useState(null);

    const totalVolume = market.options.reduce((sum, opt) => sum + opt.volume, 0);

    return (
        <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <CardTitle className="text-lg mb-2">{market.title}</CardTitle>
                        <CardDescription>{market.description}</CardDescription>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>{market.endDate}</span>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-3">
                {market.options.map((option, idx) => {
                    const percentage = totalVolume > 0 ? (option.volume / totalVolume * 100).toFixed(1) : 0;
                    const isSelected = selectedOption === idx;

                    return (
                        <button
                            key={idx}
                            onClick={() => setSelectedOption(idx)}
                            className={`w-full p-4 rounded-lg border-2 transition-all ${isSelected
                                    ? 'border-primary bg-primary/10'
                                    : 'border-border hover:border-primary/50 bg-card'
                                }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    {option.trend === 'up' ? (
                                        <TrendingUp className="w-4 h-4 text-green-500" />
                                    ) : (
                                        <TrendingDown className="w-4 h-4 text-red-500" />
                                    )}
                                    <span className="font-medium">{option.name}</span>
                                </div>
                                <span className="text-lg font-bold text-primary">{percentage}%</span>
                            </div>

                            <div className="w-full bg-muted rounded-full h-2">
                                <div
                                    className="bg-primary h-2 rounded-full transition-all"
                                    style={{ width: `${percentage}%` }}
                                />
                            </div>

                            <div className="flex items-center justify-between mt-2 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                    <Users className="w-3 h-3" />
                                    <span>{option.participants} traders</span>
                                </div>
                                <span>{option.volume} SOL</span>
                            </div>
                        </button>
                    );
                })}
            </CardContent>

            <CardFooter className="flex gap-2">
                <Button
                    className="flex-1"
                    disabled={selectedOption === null}
                    variant="default"
                >
                    Place Bet
                </Button>
                <Button variant="outline" className="flex-1">
                    View Details
                </Button>
            </CardFooter>
        </Card>
    );
}
