import './App.css';
import { Toaster } from '@/components/ui/sonner';
import { AppProvider } from '@/context/AppContext';
import Sidebar from '@/components/layout/Sidebar';
import MobileSheet from '@/components/layout/MobileSheet';
import MapCanvas from '@/components/map/MapCanvas';

export default function App() {
  return (
    <AppProvider>
      <div className="app-layout">
        {/* Left sidebar — desktop only */}
        <Sidebar />

        {/* Map area — fills remaining space */}
        <MapCanvas />

        {/* Mobile bottom sheet */}
        <MobileSheet />

        {/* Toast notifications */}
        <Toaster position="bottom-right" richColors />
      </div>
    </AppProvider>
  );
}
