"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";

const RideBookingCard = () => {
    return (
        <Card className="w-full shadow-lg border-primary/20">
            <CardHeader className="pb-3">
                <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    Book a Ride
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="pickup">Pickup Location</Label>
                    <div className="relative">
                        <Input
                            id="pickup"
                            placeholder="Where are you?"
                            className="pl-9"
                        />
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="dropoff">Dropoff Location</Label>
                    <div className="relative">
                        <Input
                            id="dropoff"
                            placeholder="Where to?"
                            className="pl-9"
                        />
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    </div>
                </div>

                <Button className="w-full text-lg h-12 mt-2" size="lg">
                    Request Ride
                </Button>
            </CardContent>
        </Card>
    );
};

export default RideBookingCard;
