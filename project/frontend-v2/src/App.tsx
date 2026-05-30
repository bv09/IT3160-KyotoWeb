import { Toaster } from '@/components/ui/sonner';
import { RoutingProvider } from '@/context/RoutingContext';
import AppHeader from '@/components/layout/AppHeader';
import RoutingPanel from '@/components/route/RoutingPanel';
import JourneyDetails from '@/components/route/JourneyDetails';
import AdminPanel from '@/components/route/AdminPanel';
import MobileSheet from '@/components/layout/MobileSheet';
import MapCanvas from '@/components/map/MapCanvas';

export default function App() {
  return (
    <RoutingProvider>
      <div className="relative w-screen h-screen overflow-hidden bg-gray-900">
        <AppHeader />
        <MapCanvas />
        <RoutingPanel />
        <JourneyDetails />
        <AdminPanel />
        <MobileSheet />
        <Toaster position="bottom-right" richColors />
      </div>
    </RoutingProvider>
  );
}
