import React, { useState, useEffect, useRef } from "react";
import { Send, Smile, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getAvatarColor, getAvatarFallbackText } from "@/lib/helper";
import { useAuthContext } from "@/context/auth-provider";
import { useSocket } from "@/context/socket-provider";
import useWorkspaceId from "@/hooks/use-workspace-id";
import EmojiPickerComponent from "@/components/emoji-picker";
import { toast } from "@/hooks/use-toast";
import { ToastOptions } from "@/types/toast.type";

import { 
  MessageType, 
  getMessages, 
  sendMessage, 
  joinWorkspaceChat, 
  leaveWorkspaceChat,
  SOCKET_EVENTS
} from "@/services/chat.service";

const Chat = () => {
  const { user } = useAuthContext();
  const { socket, isConnected } = useSocket();
  const workspaceId = useWorkspaceId();
  
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load messages and join chat room on component mount
  useEffect(() => {
    if (!workspaceId) return;

    const loadMessages = async () => {
      setIsLoading(true);
      try {
        // Get messages via socket or API
        const chatMessages = await getMessages(socket, workspaceId);
        setMessages(chatMessages);
      } catch (error) {
        console.error("Error loading messages:", error);
        toast({
          title: "Error",
          description: "Failed to load messages",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    // Load initial messages
    loadMessages();

    // Join the workspace chat room
    joinWorkspaceChat(socket, workspaceId);

    // Clean up when component unmounts
    return () => {
      leaveWorkspaceChat(socket, workspaceId);
    };
  }, [workspaceId, socket]);
  // Listen for new messages from socket
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (newMessage: MessageType) => {
      // Convert string timestamp to Date if necessary
      const messageWithDateTimestamp = {
        ...newMessage,
        timestamp: new Date(newMessage.timestamp)
      };
      
      // Add message to state if it's for our workspace and we don't already have it
      // This prevents duplicate messages when receiving our own messages back from the server
      if (messageWithDateTimestamp.workspaceId === workspaceId) {
        setMessages((prevMessages) => {      // Check if we already have this message in our state (by id)
          const messageExists = prevMessages.some(msg => msg.id === messageWithDateTimestamp.id);
          if (messageExists) {
            console.log(`Ignoring duplicate message with id: ${messageWithDateTimestamp.id}`);
            return prevMessages; // Don't add duplicates
          }
          console.log(`Adding new message from socket: ${messageWithDateTimestamp.id}`);
          return [...prevMessages, messageWithDateTimestamp];
        });
      }
    };

    // Register event listener
    socket.on(SOCKET_EVENTS.RECEIVE_MESSAGE, handleNewMessage);

    // Clean up listener
    return () => {
      socket.off(SOCKET_EVENTS.RECEIVE_MESSAGE, handleNewMessage);
    };
  }, [socket, workspaceId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim() || !workspaceId || !user) return;

    try {      // Send the message using our service
      const newMessage = await sendMessage(
        {
          text: message,
          sender: {
            id: user._id || "",
            name: user.name || "",
            profilePicture: user.profilePicture ?? undefined,
          },
          workspaceId,
        },
        socket
      );        // Only add message locally if socket is unavailable
      // Otherwise, we'll receive it via the socket broadcast
      if (!socket || !socket.connected) {
        console.log(`Socket unavailable, adding message locally: ${newMessage.id}`);
        setMessages((prevMessages) => [...prevMessages, newMessage]);
      } else {
        console.log(`Message sent via socket, waiting for broadcast: ${newMessage.id}`);
      }
      
      setMessage("");
    } catch (error) {
      console.error(error);
      const toastOptions: ToastOptions = {
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      };
      toast(toastOptions);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessage((prev) => prev + emoji);
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat("en", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
      }).format(date);
    }
  };

  // Group messages by date
  const groupedMessages: { [date: string]: MessageType[] } = messages.reduce(
    (groups: { [date: string]: MessageType[] }, message: MessageType) => {
      const date = formatDate(message.timestamp);
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
      return groups;
    },
    {} as { [date: string]: MessageType[] }
  );
  return (
    <div className="flex flex-col h-[calc(100vh-50px)]">
      <div className="p-4 border-b">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-semibold">Team Chat</h1>
            <p className="text-sm text-muted-foreground">
              Chat with your workspace members
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {isConnected ? 'Connected' : 'Offline'}
            </span>
            <span className={`inline-block w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
          </div>
        </div>
      </div>

      {/* Connection Status Alert */}
      {!isConnected && (
        <div className="px-4 pt-2">
          <div className="flex p-2 mb-2 text-amber-800 border border-amber-200 bg-amber-50 rounded">
            <AlertCircle className="h-5 w-5 mr-2 text-amber-500" />
            <div>
              <p className="text-sm font-medium">You're currently offline</p>
              <p className="text-xs text-muted-foreground">Your messages will be sent when you reconnect.</p>
            </div>
          </div>
        </div>
      )}

      {/* Chat messages */}
      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <span className="animate-pulse">Loading messages...</span>
          </div>
        ) : Object.entries(groupedMessages).length > 0 ? (
          Object.entries(groupedMessages).map(([date, msgs]) => (
          <div key={date} className="mb-6">
            <div className="flex items-center justify-center mb-4">
              <div className="h-px flex-grow bg-border"></div>
              <span className="px-4 text-xs font-medium text-muted-foreground">
                {date}
              </span>
              <div className="h-px flex-grow bg-border"></div>
            </div>
            
            {msgs.map((msg) => {
              const isCurrentUser = msg.sender.id === user?._id;
              const initials = getAvatarFallbackText(msg.sender.name);
              const avatarColor = getAvatarColor(msg.sender.name);
              
              return (
                <div
                  key={msg.id}
                  className={`flex mb-4 ${
                    isCurrentUser ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`flex max-w-[80%] ${
                      isCurrentUser ? "flex-row-reverse" : ""
                    }`}
                  >
                    <Avatar className={`h-8 w-8 ${isCurrentUser ? "ml-2" : "mr-2"}`}>
                      <AvatarImage src={msg.sender.profilePicture || ""} />
                      <AvatarFallback className={avatarColor}>
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div>
                      <div className="flex items-center mb-1">
                        {!isCurrentUser && (
                          <span className="text-sm font-medium mr-2">
                            {msg.sender.name}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatTime(msg.timestamp)}
                        </span>
                      </div>
                      
                      <div
                        className={`p-3 rounded-lg ${
                          isCurrentUser
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p className="text-sm">{msg.text}</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))) : (
          <div className="flex justify-center items-center h-full text-muted-foreground">
            No messages yet.
          </div>
        )}
        <div ref={messagesEndRef} />
      </ScrollArea>

      {/* Message input */}
      <form
        onSubmit={handleSendMessage}
        className="border-t p-4 flex items-center gap-2"
      >
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="rounded-full"
            >
              <Smile className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[300px] p-0"
            side="top"
            align="start"
            alignOffset={-40}
          >            <EmojiPickerComponent onSelectEmoji={handleEmojiSelect} />
          </PopoverContent>
        </Popover>
        
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1"
        />
        
        <Button type="submit" size="icon" disabled={!message.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
};

export default Chat;

