'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Train, X, PanelLeftOpen, Route, Settings2 } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useApp } from '@/context/AppContext';
import RouteSearch from '@/components/route/RouteSearch';
import StationManager from '@/components/station/StationManager';

export default function Sidebar() {
  const { mode, setMode } = useApp();
  const [isOpen, setIsOpen] = useState(true);

  const handleClose = () => setIsOpen(false);
  const handleOpen = () => setIsOpen(true);

  return (
    <>
      {/* ── Open panel button (visible when panel is closed) ── */}
      <AnimatePresence mode="wait">
        {!isOpen && (
          <motion.div
            key="open-button"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed left-3 top-4 z-[1100]"
          >
            <Button
              variant="outline"
              size="icon"
              onClick={handleOpen}
              aria-label="Open panel"
              className="pointer-events-auto bg-white/95 backdrop-blur-sm shadow-lg border-0 rounded-xl w-10 h-10 hover:bg-white"
            >
              <PanelLeftOpen className="w-5 h-5 text-indigo-600" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Floating panel ── */}
      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.aside
  key="floating-panel"
  initial={{ opacity: 0, x: -40 }}
  animate={{ opacity: 1, x: 0 }}
  exit={{ opacity: 0, x: -40 }}
  transition={{ duration: 0.25, ease: 'easeOut' }}
  className="fixed left-6 top-4 z-[1000] flex flex-col max-h-[calc(100vh-2rem)] w-[360px] max-w-[420px] overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/5"
>
  {/* 2. Thêm 'flex-1' vào Card để nó giãn lấp đầy aside */}
  <Card
    size="sm"
    className="floating-panel flex flex-col flex-1 w-full min-w-0 min-h-0 border-0 overflow-hidden !rounded-none !ring-0 !py-0"
  >
              {/* ── Blue header ── */}
              <CardHeader className="floating-panel-header shrink-0 !rounded-t-2xl px-4 py-3 border-0">
  <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                      <Train className="w-4.5 h-4.5 text-white" />
                    </div>
                    <div>
                      <div className="app-title">Kyoto Transit</div>
                      <div className="app-subtitle">京都交通</div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleClose}
                    aria-label="Close panel"
                    className="relative z-[1050] pointer-events-auto text-white/80 hover:text-white hover:bg-white/15 rounded-lg flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardHeader>

              {/* ── Mode Switcher ── */}
              <div className="mode-switcher shrink-0">
                <button
                  className={`mode-btn ${mode === 'route-search' ? 'active' : ''}`}
                  onClick={() => setMode('route-search')}
                >
                  <Route className="w-3.5 h-3.5 flex-shrink-0" />
                  Find Shortest Path
                </button>
                <button
                  className={`mode-btn ${mode === 'station-management' ? 'active' : ''}`}
                  onClick={() => setMode('station-management')}
                >
                  <Settings2 className="w-3.5 h-3.5 flex-shrink-0" />
                  Disable / Enable Station
                </button>
              </div>

              {/* ── Scrollable content ── */}
              <CardContent className="floating-panel-content flex flex-col flex-1 min-h-0 overflow-hidden p-0">
      {mode === 'route-search' ? <RouteSearch /> : <StationManager />}
    </CardContent>
  </Card>
</motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
