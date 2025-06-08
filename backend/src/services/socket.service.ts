import { Server } from 'socket.io';
import { Server as HTTPServer } from 'http';
import mongoose from 'mongoose';

// Socket event names
export const SOCKET_EVENTS = {
  JOIN_WORKSPACE: "join_workspace",
  LEAVE_WORKSPACE: "leave_workspace",
  SEND_MESSAGE: "send_message",
  RECEIVE_MESSAGE: "receive_message",
  GET_MESSAGES: "get_messages",
  LOAD_MESSAGES: "load_messages"
};

// Interface for message payload sent from client
interface MessagePayload {
  id: string;
  text: string;
  sender: {
    id: string;
    name: string;
    profilePicture?: string;
  };
  workspaceId: string;
  timestamp?: Date;
}

// Interface for workspace join/leave payload
interface WorkspaceEventPayload {
  workspaceId: string;
}

// Message model definition
interface MessageDocument extends mongoose.Document {
  text: string;
  sender: {
    id: string;
    name: string;
    profilePicture?: string;
  };
  workspaceId: mongoose.Types.ObjectId;
  timestamp: Date;
  expireAt: Date;
}

// Create Message model schema
const messageSchema = new mongoose.Schema<MessageDocument>(
  {
    _id: { type: String, required: true }, // Allow string IDs from client
    text: { type: String, required: true },
    sender: {
      id: { type: String, required: true },
      name: { type: String, required: true },
      profilePicture: { type: String },
    },
    workspaceId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Workspace',
      required: true 
    },
    timestamp: { type: Date, default: Date.now },
    // Adding expireAt field to enable TTL
    expireAt: { 
      type: Date,
      default: () => {
        const date = new Date();
        date.setDate(date.getDate() + 2); // Set expiration to 2 days from now
        return date;
      }
    }
  },
  {
    timestamps: true,
    _id: false // Disable auto _id since we're providing it
  }
);

// Add TTL index for automatic deletion after 2 days
messageSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

// Create and export the Message model
export const MessageModel = mongoose.model<MessageDocument>('Message', messageSchema);

// Configure and initialize Socket.IO
export const initializeSocketIO = (server: HTTPServer) => {
    const io = new Server(server, {
        cors: {
            origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
            methods: ['GET', 'POST'],
            credentials: true,
        },
    });

    // Skip authentication for now to simplify the connection
    // We'll use query parameters instead of token for user identification

    // Handle socket connections
    io.on('connection', (socket) => {
        console.log(`Socket connected: ${socket.id}`);
        
        // Get user info from query params
        const userId = socket.handshake.query.userId as string;
        const workspaceId = socket.handshake.query.workspaceId as string;
        
        console.log(`User ${userId} connected to workspace ${workspaceId}`);
        
        // Automatically join the workspace chat room on connection
        if (workspaceId) {
            socket.join(`workspace:${workspaceId}`);
            console.log(`User ${userId} automatically joined workspace chat: ${workspaceId}`);
            
            // Fetch message history for the workspace when user connects
            (async () => {
                try {
                    // Fetch messages from database for this workspace
                    const messagesFromDb = await MessageModel.find({ workspaceId })
                        .sort({ timestamp: 1 })
                        .limit(100);
                    
                    // Convert MongoDB documents to plain objects and add id field
                    const messages = messagesFromDb.map(msg => {
                        const msgObj = msg.toObject();
                        msgObj.id = (msgObj._id as mongoose.ObjectId).toString();
                        return msgObj;
                    });

                    // Send messages to client
                    socket.emit(SOCKET_EVENTS.LOAD_MESSAGES, { messages });
                    
                    console.log(`Auto-loaded ${messages.length} messages for user ${userId} in workspace ${workspaceId}`);
                } catch (error) {
                    console.error('Error auto-loading messages:', error);
                    socket.emit(SOCKET_EVENTS.LOAD_MESSAGES, { messages: [] });
                }
            })();
        }

        // Join a workspace chat room
        socket.on(SOCKET_EVENTS.JOIN_WORKSPACE, ({ workspaceId }: WorkspaceEventPayload) => {
            if (!workspaceId) return;
            
            socket.join(`workspace:${workspaceId}`);
            console.log(`User joined workspace chat: ${workspaceId}`);
        });

        // Leave a workspace chat room
        socket.on(SOCKET_EVENTS.LEAVE_WORKSPACE, ({ workspaceId }: WorkspaceEventPayload) => {
            if (!workspaceId) return;
            
            socket.leave(`workspace:${workspaceId}`);
            console.log(`User left workspace chat: ${workspaceId}`);
        });        // Handle new messages
        socket.on(SOCKET_EVENTS.SEND_MESSAGE, async (message: MessagePayload) => {
            try {
                const { text, sender, workspaceId, id } = message;
                
                // Validate message
                if (!text || !sender || !workspaceId) {
                    console.error('Invalid message format:', message);
                    return;
                }

                // Calculate expiration date (2 days from now)
                const expireAt = new Date();
                expireAt.setDate(expireAt.getDate() + 2);

                // Create new message document with the client-generated ID
                const newMessage = new MessageModel({
                    _id: id, // Use client-generated ID 
                    text,
                    sender,
                    workspaceId,
                    timestamp: new Date(),
                    expireAt: expireAt
                });

                // Save message to database
                await newMessage.save();

                // Convert the document to a plain object
                const messageToSend = newMessage.toObject();
                
                // Ensure the ID is included in the response
                messageToSend.id = (messageToSend._id as mongoose.Types.ObjectId).toString();
                  // Broadcast message to all clients in the workspace
                // Using io.to() sends to all sockets in the room, including the sender
                io.to(`workspace:${workspaceId}`).emit(SOCKET_EVENTS.RECEIVE_MESSAGE, messageToSend);
                
                console.log(`Message ${messageToSend.id} broadcast to all clients in workspace ${workspaceId}`);
            } catch (error) {
                console.error('Error handling message:', error);
            }
        });        // Handle message history requests
        socket.on(SOCKET_EVENTS.GET_MESSAGES, async ({ workspaceId }: WorkspaceEventPayload) => {
            try {
                if (!workspaceId) {
                    socket.emit(SOCKET_EVENTS.LOAD_MESSAGES, { messages: [] });
                    return;
                }

                // Fetch messages from database
                const messagesFromDb = await MessageModel.find({ workspaceId })
                    .sort({ timestamp: 1 })
                    .limit(100);
                
                // Convert MongoDB documents to plain objects and add id field
                const messages = messagesFromDb.map(msg => {
                    const msgObj = msg.toObject();
                    msgObj.id = (msgObj._id as mongoose.ObjectId).toString();
                    return msgObj;
                });

                // Send messages to client
                socket.emit(SOCKET_EVENTS.LOAD_MESSAGES, { messages });
                
                console.log(`Sent ${messages.length} messages to user for workspace ${workspaceId}`);
            } catch (error) {
                console.error('Error fetching messages:', error);
                socket.emit(SOCKET_EVENTS.LOAD_MESSAGES, { messages: [] });
            }
        });

        // Handle disconnections
        socket.on('disconnect', () => {
            console.log(`Socket disconnected: ${socket.id}`);
        });
    });

    return io;
};
