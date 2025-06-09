import { v4 as uuidv4 } from "uuid";
import { Socket } from "socket.io-client";
import { config } from "@/config";

// Message type definition
export interface MessageType {
  id: string;
  text: string;
  sender: {
    id: string;
    name: string;
    profilePicture?: string;
  };
  workspaceId: string;
  timestamp: Date;
}

// Event names for socket communication
export const SOCKET_EVENTS = {
  JOIN_WORKSPACE: "join_workspace",
  LEAVE_WORKSPACE: "leave_workspace",
  SEND_MESSAGE: "send_message",
  RECEIVE_MESSAGE: "receive_message",
  GET_MESSAGES: "get_messages",
  LOAD_MESSAGES: "load_messages"
};

// For initial loading or when socket is not available
export const getMessagesFromAPI = async (workspaceId: string): Promise<MessageType[]> => {
  try {
    const response = await fetch(`${config.API_URL}/api/workspace/${workspaceId}/chat`);
    if (!response.ok) {
      throw new Error("Failed to fetch messages");
    }    const data = await response.json();
    return data.messages.map((msg: { timestamp: string | number | Date } & Omit<MessageType, 'timestamp'>) => ({
      ...msg,
      timestamp: new Date(msg.timestamp)
    }));
  } catch (error) {
    console.error("Error fetching messages:", error);
    return getDemoMessages(workspaceId);
  }
};

// Get messages via socket
export const getMessages = (socket: Socket | null, workspaceId: string): Promise<MessageType[]> => {
  return new Promise((resolve) => {
    if (!socket || !socket.connected) {
      // Fallback to API or demo data if socket is unavailable
      resolve(getMessagesFromAPI(workspaceId));
      return;
    }

    // Request messages through socket
    socket.emit(SOCKET_EVENTS.GET_MESSAGES, { workspaceId });
    
    // Set up a one-time listener for the response
    socket.once(SOCKET_EVENTS.LOAD_MESSAGES, (data: { messages: MessageType[] }) => {
      // Convert string timestamps to Date objects
      const messages = data.messages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
      resolve(messages);
    });

    // Set a timeout in case the socket doesn't respond
    setTimeout(() => {
      resolve(getMessagesFromAPI(workspaceId));
    }, 5000);
  });
};

// Send a message via socket
export const sendMessage = async (
  message: Omit<MessageType, "id" | "timestamp">, 
  socket: Socket | null
): Promise<MessageType> => {
  // Create the message with client-side ID and timestamp
  const newMessage: MessageType = {
    ...message,
    id: uuidv4(),
    timestamp: new Date()
  };
  
  if (!socket || !socket.connected) {
    // If socket is unavailable, we'd normally throw an error
    // but for demo purposes, we'll just return the message as if it succeeded
    console.warn("Socket unavailable, message will only be visible locally");
    return newMessage;
  }

  // Send the message through socket
  socket.emit(SOCKET_EVENTS.SEND_MESSAGE, newMessage);
  
  return newMessage;
};

// Join a workspace chat room
export const joinWorkspaceChat = (socket: Socket | null, workspaceId: string) => {
  if (socket && socket.connected) {
    socket.emit(SOCKET_EVENTS.JOIN_WORKSPACE, { workspaceId });
  }
};

// Leave a workspace chat room
export const leaveWorkspaceChat = (socket: Socket | null, workspaceId: string) => {
  if (socket && socket.connected) {
    socket.emit(SOCKET_EVENTS.LEAVE_WORKSPACE, { workspaceId });
  }
};

// Get demo messages for initial display or when API is unavailable
export const getDemoMessages = (workspaceId: string): MessageType[] => {
  const now = Date.now();
  
  return [
    {
      id: "1",
      text: "Welcome to the team chat! Make sure to be polite and respect each other (if you refresh this page and can not see the previous messages go to another page and come back it might fix the issue :D otherwise remember messages are only stored for 48hours)",
      sender: {
        id: "system",
        name: "System",
      },
      workspaceId,
      timestamp: new Date(now - 3600000),
    },
    {
      id: "2",
      text: "Hi everyone! How's the project coming along?",
      sender: {
        id: "user1",
        name: "John Doe",
      },
      workspaceId,
      timestamp: new Date(now - 1800000),
    },
    {
      id: "3",
      text: "We're making good progress. Just finished the design mockups.",
      sender: {
        id: "user2",
        name: "Jane Smith",
      },
      workspaceId,
      timestamp: new Date(now - 900000),
    },
  ];
};

// For backward compatibility
export const initializeDemoMessages = getDemoMessages;
