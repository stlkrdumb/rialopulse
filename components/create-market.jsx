'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Calendar } from 'lucide-react';

export default function CreateMarket() {
    const [options, setOptions] = useState(['', '']);

    const addOption = () => {
        setOptions([...options, '']);
    };

    const updateOption = (index, value) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Create New Market</CardTitle>
                <CardDescription>Set up a new prediction market for the community</CardDescription>
            </CardHeader>
            <CardContent>
                <form className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="title">Market Question</Label>
                        <Input
                            id="title"
                            placeholder="e.g., Will Bitcoin reach $100k by end of 2026?"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Input
                            id="description"
                            placeholder="Provide additional context..."
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="endDate">End Date</Label>
                        <div className="relative">
                            <Input
                                id="endDate"
                                type="date"
                                className="pl-10"
                            />
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <Label>Outcome Options</Label>
                        {options.map((option, idx) => (
                            <Input
                                key={idx}
                                value={option}
                                onChange={(e) => updateOption(idx, e.target.value)}
                                placeholder={`Option ${idx + 1}`}
                            />
                        ))}
                        <Button
                            type="button"
                            variant="outline"
                            onClick={addOption}
                            className="w-full"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Option
                        </Button>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="initialLiquidity">Initial Liquidity (SOL)</Label>
                        <Input
                            id="initialLiquidity"
                            type="number"
                            placeholder="0.1"
                            step="0.01"
                        />
                    </div>

                    <Button className="w-full" size="lg">
                        Create Market
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
