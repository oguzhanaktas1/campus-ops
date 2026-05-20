'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { getSocket, disconnectSocket } from '@/lib/socket';
import { getToken } from '@/lib/auth';

interface RealtimeContextValue {
  socket: Socket | null;
  connected: boolean;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  socket: null,
  connected: false,
});

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const sock = getSocket(token);
    setSocket(sock);

    sock.on('connect', () => setConnected(true));
    sock.on('disconnect', () => setConnected(false));
    sock.on('connect_error', () => setConnected(false));

    return () => {
      disconnectSocket();
      setSocket(null);
      setConnected(false);
    };
  }, []);

  return (
    <RealtimeContext.Provider value={{ socket, connected }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
