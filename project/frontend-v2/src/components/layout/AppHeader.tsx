import { Switch } from '@/components/ui/switch';
import { Train } from 'lucide-react';
import { useRouting, useRoutingDispatch } from '@/context/RoutingContext';

export default function AppHeader() {
  const { sandboxMode } = useRouting();
  const dispatch = useRoutingDispatch();

  return (
    <header className="fixed top-0 left-0 right-0 z-[1100] h-12 bg-kyoto-indigo flex items-center justify-between px-4 shadow-lg">
      <div className="flex items-center gap-2">
        <Train className="w-5 h-5 text-white" />
        <span className="text-white font-semibold text-sm tracking-wide">Kyoto Rail AI</span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-white/70 text-xs font-medium">Sandbox</span>
        <Switch
          checked={sandboxMode}
          onCheckedChange={() => dispatch({ type: 'TOGGLE_SANDBOX' })}
        />
      </div>
    </header>
  );
}
