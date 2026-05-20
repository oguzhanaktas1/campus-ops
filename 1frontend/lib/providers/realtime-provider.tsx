'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
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
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const sock = getSocket(token);
    socketRef.current = sock;

    sock.on('connected', () => setConnected(true));
    sock.on('disconnect', () => setConnected(false));
    sock.on('connect_error', () => setConnected(false));

    return () => {
      disconnectSocket();
      setConnected(false);
    };
  }, []);

  return (
    <RealtimeContext.Provider value={{ socket: socketRef.current, connected }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
