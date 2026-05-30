import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouting, useRoutingDispatch } from '@/context/RoutingContext';
import { getGraphEdges, unblockAll } from '@/lib/api';

interface BlockedEntry {
  id: number;
  name: string;
}

export default function AdminPanel() {
  const { sandboxMode, showGraph } = useRouting();
  const dispatch = useRoutingDispatch();
  const [blocked, setBlocked] = useState<BlockedEntry[]>([]);

  const refreshBlocked = async () => {
    try {
      const data = await getGraphEdges();
      const ids = new Set((data.blocked_nodes || []).map(Number));
      dispatch({ type: 'SET_DISABLED_STATIONS', payload: ids });

      const nameMap: Record<string, string> = {};
      (data.edges || []).forEach((e) => {
        if (e.from_name) nameMap[String(e.from)] = e.from_name;
        if (e.to_name) nameMap[String(e.to)] = e.to_name;
      });

      const list = (data.blocked_nodes || []).map((id) => ({
        id,
        name: nameMap[String(id)] || `Node #${id}`,
      }));
      setBlocked(list);
    } catch (err) {
      console.error('Failed to load blocked stations:', err);
    }
  };

  useEffect(() => {
    if (sandboxMode) refreshBlocked();
    else setBlocked([]);
  }, [sandboxMode]);

  const handleUnblockAll = async () => {
    try {
      await unblockAll();
      await refreshBlocked();
    } catch (err) {
      console.error('Unblock all error:', err);
    }
  };

  const handleToggleGraph = () => {
    dispatch({ type: 'SET_SHOW_GRAPH', payload: !showGraph });
  };

  if (!sandboxMode) return null;

  return (
    <Card className="absolute top-16 right-3 w-[320px] bg-white/95 backdrop-blur-sm shadow-xl border-0 z-[1000] p-4 flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-gray-800 tracking-wide uppercase">
        Admin Controls
      </h2>

      <Button
        onClick={handleToggleGraph}
        variant={showGraph ? 'default' : 'outline'}
        className={`text-sm ${showGraph ? 'bg-kyoto-indigo hover:bg-kyoto-indigo-dark text-white' : ''}`}
      >
        {showGraph ? 'Hide Graph' : 'Show Graph'}
      </Button>

      {blocked.length > 0 && (
        <>
          <div className="text-xs font-medium text-gray-500 mt-1">
            Blocked Stations ({blocked.length})
          </div>
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
            {blocked.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between text-xs bg-red-50 border border-red-100 rounded px-2 py-1"
              >
                <span className="text-red-700 truncate mr-2">{b.name}</span>
              </div>
            ))}
          </div>
          <Button
            onClick={handleUnblockAll}
            variant="ghost"
            className="text-xs text-kyoto-red hover:text-kyoto-red-muted hover:bg-red-50"
          >
            Reset All
          </Button>
        </>
      )}
    </Card>
  );
}
