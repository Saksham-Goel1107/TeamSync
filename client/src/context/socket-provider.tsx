import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthContext } from './auth-provider';
import useWorkspaceId from '@/hooks/use-workspace-id';
import { config } from '@/config';

// Socket context type
interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

// Create the context
const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuthContext();
  const workspaceId = useWorkspaceId();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!user?._id || !workspaceId) return;

    // Create socket connection
    const socketInstance = io(config.API_URL, {
      query: {
        userId: user._id,
        workspaceId,
      },
    });

    // Set up event listeners
    socketInstance.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
    });

    socketInstance.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    socketInstance.on('error', (error) => {
      console.error('Socket error:', error);
    });

    // Set the socket in state
    setSocket(socketInstance);

    // Clean up function
    return () => {
      console.log('Disconnecting socket');
      socketInstance.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [user?._id, workspaceId]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

// Hook to use the socket context
export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
