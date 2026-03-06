"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Car, Clock, ShieldCheck } from "lucide-react";

const RideStatusCard = ({ status = "IDLE" }) => {
    // Current UI-only implementation with static state
    const renderStatus = () => {
        switch (status) {
            case "SEARCHING":
                return <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100">Searching for drivers...</Badge>;
            case "ACCEPTED":
                return <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-100">Driver en route</Badge>;
            case "STARTED":
                return <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">Ride started</Badge>;
            case "COMPLETED":
                return <Badge variant="secondary" className="bg-zinc-100 text-zinc-700 hover:bg-zinc-100">Ride completed</Badge>;
            default:
                return <Badge variant="outline" className="text-muted-foreground">No active ride</Badge>;
        }
    };

    return (
        <Card className="w-full shadow-md">
            <CardHeader className="pb-3 border-b bg-muted/30">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        Current Status
                    </CardTitle>
                    {renderStatus()}
                </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
                {status === "IDLE" ? (
                    <div className="py-2 text-center text-sm text-muted-foreground">
                        Your active ride details will appear here.
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 text-sm">
                            <Clock className="h-4 w-4 text-primary" />
                            <span>Estimated arrival: <span className="font-semibold">5 mins</span></span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                            <Car className="h-4 w-4 text-primary" />
                            <span>Driver: <span className="font-semibold">John Doe (MH-12-AB-1234)</span></span>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                            <ShieldCheck className="h-4 w-4 text-primary" />
                            <span>Safety Pin: <span className="font-semibold text-lg tracking-widest text-primary ml-1">4829</span></span>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default RideStatusCard;
