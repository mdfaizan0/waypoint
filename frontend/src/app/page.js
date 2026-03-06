"use client";

import { useAuthUser } from "@/hooks/useAuthUser";
import { Skeleton } from "@/components/ui/skeleton";
import MapContainer from "@/features/map/MapContainer";
import { createMarker } from "@/utils/map.utils";
import { MAP_CONFIG } from "@/features/map/map.constants";
import Container from "@/components/layout/Container";
import AuthGuard from "@/components/auth/AuthGuard";
import RiderDashboard from "@/features/rider/RiderDashboard";

export default function Home() {
  const { user, role, isLoading } = useAuthUser();

  const renderContent = () => {
    if (isLoading) return null;

    if (role === "RIDER") {
      return <RiderDashboard />;
    }

    if (role === "DRIVER") {
      return (
        <div className="py-20 text-center space-y-4">
          <h2 className="text-3xl font-bold tracking-tight text-primary">Driver Dashboard</h2>
          <p className="text-xl text-muted-foreground max-w-lg mx-auto">
            Welcome, captain! Your dashboard is currently being prepared for the next haul.
            Stay tuned for real-time ride requests and earnings overview.
          </p>
        </div>
      );
    }

    // Fallback for missing/unknown role
    return (
      <div className="py-20 text-center space-y-4">
        <h2 className="text-3xl font-bold italic text-muted-foreground">Initializing Persona...</h2>
        <p className="text-muted-foreground">Please wait while we set up your dashboard.</p>
      </div>
    );
  };

  return (
    <AuthGuard>
      <Container className="py-8">
        <main className="w-full mx-auto">
          {renderContent()}
        </main>
      </Container>
    </AuthGuard>
  );
}
