import React, { useState, useRef, useEffect, useContext } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  StatusBar, 
  Image, 
  TextInput,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Animated,
  SafeAreaView,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChatService, API_URL, isServerReachable } from '../../services/api';
import { AuthContext } from '../../components/context/AuthContext';

const { width, height } = Dimensions.get('window');

const ChatScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const authContext = useContext(AuthContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentChat, setCurrentChat] = useState(null);
  const [inputMessage, setInputMessage] = useState('');
  const scrollViewRef = useRef();
  const slideAnim = useRef(new Animated.Value(width)).current;
    // Import authentication data directly from context using destructuring for clarity
  const { token, user, isLoading: authLoading, error: authError } = authContext || {};
  
  // Create a consistent reference for auth that won't change between renders
  const auth = React.useMemo(() => ({ 
    token, 
    user, 
    isLoading: authLoading, 
    error: authError 
  }), [token, user, authLoading, authError]);
  
  // State for dynamic data
  const [chats, setChats] = useState([]);  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);  
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'groups', 'contacts'
  // Log auth state on load or changes
  useEffect(() => {
    console.log('Current authentication state:', { token, user });
      
    if (!token) {
      console.warn('No authentication token available. User may not be logged in.');
      setError('Authentication required. Please log in.');
    } else if (!user) {
      console.warn('Authentication token exists but user info is missing.');
      console.log('Attempting to use token:', token);
    } else {
      console.log('User authenticated:', user);
      // User is authenticated, fetch chats
      fetchChats();
    }
  }, [token, user]);
  
  // Initial load on mount
  useEffect(() => {
    console.log('Component mounted');
  }, []);
  // Check server connection
  const checkServerConnection = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const serverReachable = await isServerReachable();
      if (serverReachable) {
        alert('Server connection successful! The backend is reachable.');
      } else {
        setError('Cannot connect to the chat server. The server might be down or your network connection may have issues.');
      }
    } catch (error) {
      setError('Error checking server connection: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  // Fetch chats from the backend
  const fetchChats = async () => {
    // Get the most current token from context
    const currentToken = authContext.token;
    
    if (!currentToken) {
      console.error('No auth token available');
      setError('Authentication required');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {      // Check if the server is reachable before making the call
      const serverReachable = await isServerReachable();
      console.log('Server reachability check result:', serverReachable);
      if (!serverReachable) {
        setError('Backend server is not reachable. Please check your network connection or try again later.');
        console.error('Server not reachable, aborting API call');
        setLoading(false);
        return;
      }
      console.log('Server is reachable, proceeding with API call');
      
      console.log('Fetching chats with token:', currentToken);
      const response = await ChatService.getConversations(currentToken, false); // Set useFallback to false
      console.log('Chats API response:', response);
      
      if (response && response.success) {
        // Backend might return data in different formats, let's handle them all
        let conversations;
        
        if (response.data && Array.isArray(response.data)) {
          conversations = response.data;
        } else if (response.conversations && Array.isArray(response.conversations)) {
          conversations = response.conversations;
        } else if (Array.isArray(response)) {
          conversations = response;
        } else if (response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
          // This might be a case where data is an object with conversations property
          conversations = response.data.conversations || [];
        } else {
          conversations = [];
        }
          console.log('Processed conversations:', conversations);
        
        // Normalize conversation objects to ensure consistent format
        const normalizedConversations = conversations.map(chat => {
          // Make sure lastMessage is always a string, never an object
          let lastMessageText = chat.lastMessage;
          if (typeof chat.lastMessage === 'object' && chat.lastMessage !== null) {
            lastMessageText = chat.lastMessage.text || chat.lastMessage.content || 'New message';
          }
          
          return {
            ...chat,
            lastMessage: lastMessageText
          };
        });
        
        setChats(normalizedConversations);
      } else {
        setError(response?.error || 'Failed to load conversations');
        console.error('Error fetching chats:', response?.error || 'Unknown error');
      }
    } catch (error) {
      setError('Network or server error');
      console.error('Error in fetchChats:', error);    } finally {
      setLoading(false);
    }
  };  // Fetch messages when a chat is selected
  const fetchMessages = async (conversationId, showLoadingIndicator = true) => {
    // Get the most current token from context
    const currentToken = authContext.token;
    
    if (!currentToken) {
      console.error('No auth token available');
      setError('Authentication required');
      return;
    }
    
    if (!conversationId) {
      console.error('Invalid conversation ID');
      setError('Unable to load messages: Invalid chat ID');
      return;
    }
    
    console.log(`⚠️ BEGINNING MESSAGE FETCH for conversation ${conversationId}`);
    // Only show loading indicator when explicitly requested
    if (showLoadingIndicator) {
      setLoading(true);
    }
    setError(null);
    
    try {
      // Check if the server is reachable before making the call
      const serverReachable = await isServerReachable();
      if (!serverReachable) {
        setError('Unable to connect to chat server. Please check your network connection.');
        console.error('Server not reachable, aborting API call');
        setLoading(false);
        return;
      }
      
      console.log(`Fetching messages for conversation: ${conversationId}`);
      const response = await ChatService.getMessages(currentToken, conversationId);
      console.log('Messages API response:', response);
        if (response && response.success) {
        // Check all possible response formats
        let messagesData;
        
        if (response.data && Array.isArray(response.data)) {
          messagesData = response.data;
        } else if (response.messages && Array.isArray(response.messages)) {
          messagesData = response.messages;
        } else if (Array.isArray(response)) {
          messagesData = response;
        } else if (response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
          messagesData = response.data.messages || [];
        } else {
          messagesData = [];
        }
          console.log('Processed messages data:', messagesData);
        
        if (Array.isArray(messagesData)) {
          // Map backend message format to our frontend format
          const formattedMessages = messagesData.map(msg => {
            console.log('Formatting message:', msg);
            return {
              id: msg.id || msg.message_id,
              content: msg.content || msg.message_text || msg.text,
              text: msg.content || msg.message_text || msg.text, // Ensure both fields are set
              is_mine: (msg.sender_id === auth?.user?.id) || (msg.sender?.id === auth?.user?.id) || (msg.sender === 'me'),
              sender: {
                id: msg.sender_id || msg.sender?.id,
                name: msg.sender_name || msg.sender?.name || (msg.senderInfo ? msg.senderInfo.name : 'Unknown'),
                avatar: msg.sender_avatar || msg.sender?.profilePicture || (msg.senderInfo ? msg.senderInfo.avatar : null)
              },
              formatted_time: msg.formatted_time || msg.time || formatMessageTime(msg.sentAt || msg.sent_at)
            };
          });
            // Backend now returns messages in ASC order, so no need to reverse
          setMessages(formattedMessages);
          console.log(`🧩 FRONTEND: Received ${formattedMessages.length} messages, set to state`);
          console.log('Messages set and reversed, count:', formattedMessages.length);
        } else {
          setError('Invalid message data format');
          console.error('Invalid message format:', messagesData);
        }
      } else {
        setError(response?.error || 'Failed to load messages');
        console.error('Error fetching messages:', response?.error || 'Unknown error');
      }
    } catch (error) {
      setError('Network or server error');
      console.error('Error in fetchMessages:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Helper function to format message time
  const formatMessageTime = (timestamp) => {
    if (!timestamp) return 'now';
    
    try {
      const date = new Date(timestamp);
      const now = new Date();
      
      // Today, show only time
      if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      
      // This week, show day name
      const diff = Math.floor((now - date) / (1000 * 60 * 60 * 24));
      if (diff < 7) {
        return date.toLocaleDateString([], { weekday: 'short' }) + ' ' + 
               date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      
      // Older, show date
      return date.toLocaleDateString();    } catch (e) {
      console.error('Error formatting timestamp:', e);
      return 'unknown';
    }
  }  // Send a message
  const sendMessage = async () => {
    // Get the most current token from context
    const currentToken = authContext.token;
    
    if (!currentChat || !inputMessage.trim() || !currentToken) return;
    
    setSending(true);
    const message = inputMessage.trim();
    setInputMessage(''); // Clear input immediately for a better UX
    
    try {
      console.log(`Sending message to conversation: ${currentChat.id}`);
      console.log('Message content:', message);
      
      let response;
      let realConversationId = currentChat.id;
      
      // If this is a new conversation (temporary ID), we need special handling
      if (currentChat.id.toString().startsWith('new_')) {
        console.log('This is a temporary chat, creating real conversation first');
        
        // Extract the friend data
        const friendData = currentChat.friend || 
                          (currentChat.participants && currentChat.participants.find(
                            p => p.userId !== user?.userId && p.user_id !== user?.user_id
                          ));
                          
        if (!friendData) {
          console.error('Cannot find friend data for temporary chat');
          throw new Error('Missing friend data for chat creation');
        }
        
        // Create a real conversation first
        const createResult = await ChatService.startDirectChat(currentToken, friendData);
        
        if (!createResult.success || !createResult.conversation) {
          console.error('Failed to create real conversation:', createResult.error);
          throw new Error(createResult.error || 'Failed to create conversation');
        }
        
        // Update the current chat with the real conversation ID
        realConversationId = createResult.conversation.id;
        
        // Update our current chat reference
        const realConversation = createResult.conversation;
        setCurrentChat(realConversation);
        
        // Update the chat in the list
        setChats(prevChats => {
          // Remove the temporary chat
          const filtered = prevChats.filter(c => c.id !== currentChat.id);
          // Add the new real chat
          return [realConversation, ...filtered];
        });
        
        console.log(`Created real conversation with ID: ${realConversationId}`);
      }
      
      // Now send the message to the real conversation ID
      response = await ChatService.sendMessage(
        currentToken, 
        realConversationId, 
        message
      );
      
      console.log('Send message API response:', response);
        if (response.success && response.data) {        // Format the message to match our expected structure
        const newMessage = {
          id: response.data.id || Date.now(), // Ensure we have a unique ID
          content: response.data.text || response.data.content || message, // Ensure we have content
          text: response.data.text || response.data.content || message, // Ensure we have text too
          is_mine: true, // Since we sent it
          sender: {
            id: response.data.sender?.id || auth?.user?.id,
            name: response.data.sender?.name || auth?.user?.name,
            avatar: response.data.sender?.profilePicture
          },
          formatted_time: response.data.sentAt ? formatMessageTime(response.data.sentAt) : 'now'
        };
        
        // Log the message for debugging
        console.log('NEW MESSAGE TO ADD:', newMessage);
        
        console.log('Adding new message to state:', newMessage);
          // Add the new message to the messages state
        setMessages(prevMessages => [...prevMessages, newMessage]);
        
        // Scroll to the bottom to show the new message
        setTimeout(() => {
          if (scrollViewRef.current) {
            scrollViewRef.current.scrollToEnd({ animated: true });
          }
        }, 100);
        
        // Update the last message in the chat list
        setChats(prevChats => 
          prevChats.map(chat => 
            chat.id === currentChat.id 
              ? {                  ...chat, 
                  lastMessage: typeof message === 'string' ? message : (message?.text || message?.content || 'New message'),
                  lastMessageTime: 'now',
                  isLastMessageMine: true
                }
              : chat
          )
        );
        
        // Scroll to bottom
        if (scrollViewRef.current) {
          setTimeout(() => {
            scrollViewRef.current.scrollToEnd({ animated: true });
          }, 100);
        }
      } else {
        console.error('Failed to send message:', response.error);
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };  // Handle chat selection
  const openChat = async (chat) => {
    if (!chat) {
      console.error('Attempted to open a null or undefined chat');
      return;
    }
    
    console.log('Opening chat:', chat);
    
    // Check if this is the same chat we already have open
    const chatId = chat.id || chat.conversation_id;
    const currentChatId = currentChat?.id || currentChat?.conversation_id;
    
    if (currentChatId === chatId) {
      console.log('Chat already open, not reopening');
      return;
    }
    
    setCurrentChat(chat);
    
    // Animate slide-in first for better UX
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
    
    // Handle inconsistent chat.id vs chat.conversation_id
    if (!chatId) {
      console.error('Chat missing ID, cannot fetch messages');
      return;
    }
    
    // For temporary chats (new_*), we won't try to fetch messages since they don't exist yet
    if (chatId.toString().startsWith('new_')) {
      console.log('New chat opened, no messages to fetch yet');
      setMessages([]);
      return;
    }      // Fetch messages for this chat
    await fetchMessages(chatId, true); // Show loading indicators on initial load
    
    // Scroll to the bottom of messages after fetching completes
    // Use a longer delay to ensure messages have rendered
    setTimeout(() => {
      if (scrollViewRef.current) {
        console.log('Scrolling to end of messages');
        scrollViewRef.current.scrollToEnd({ animated: true });
      }
    }, 500);
  };
  
  // Go back to chat list
  const closeChat = () => {
    // Animate slide-out
    Animated.timing(slideAnim, {
      toValue: width,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setCurrentChat(null);
      setMessages([]);
    });
  };
  
  // Format avatar URL
  const formatAvatarUrl = (avatar) => {
    if (!avatar) return null;
    
    // If it's already a full URL
    if (avatar.startsWith('http')) {
      return avatar;
    }
    
    // If it's a local path, prepend the API URL
    return `${API_URL}/${avatar.startsWith('/') ? avatar.substring(1) : avatar}`;
  };
  
  // Filter chats based on search query and active tab
  const filteredChats = chats.filter(chat => {
    // Filter by search query
    const matchesSearch = !searchQuery || 
      chat.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Filter by tab
    let matchesTab = true;
    if (activeTab === 'groups') {
      matchesTab = chat.is_group;
    } else if (activeTab === 'contacts') {
      matchesTab = !chat.is_group;
    }
    
    return matchesSearch && matchesTab;
  });

  // Chat list item component
  const renderChatItem = ({ item }) => {
    const avatarUrl = formatAvatarUrl(item.avatar);
    
    return (
      <TouchableOpacity 
        style={styles.chatItem} 
        onPress={() => openChat(item)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          {avatarUrl ? (
            <Image 
              source={{ uri: avatarUrl }} 
              style={styles.avatar}
              defaultSource={require('../../assets/icons/medicine.png')} 
            />
          ) : (
            <View style={[styles.avatar, styles.defaultAvatar]}>
              <Text style={styles.defaultAvatarText}>
                {item.name?.charAt(0) || '?'}
              </Text>
            </View>
          )}
          {item.isOnline && <View style={styles.onlineIndicator} />}
        </View>
        
        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>            <Text style={styles.chatName}>{item.name}</Text>
            <Text style={styles.chatTime}>{item.lastMessageTime}</Text>
          </View>
          
          <View style={styles.chatPreview}>
            {item.isTyping ? (
              <Text style={styles.typingText}>{item.name} is typing...</Text>
            ) : (
              <Text 
                style={[
                  styles.lastMessageText,
                  item.isLastMessageMine ? styles.myLastMessage : null,
                  item.unreadCount > 0 ? styles.unreadLastMessage : null,
                ]} 
                numberOfLines={1}
              >                {typeof item.lastMessage === 'object' ? 
                  (item.lastMessage.text || 'No messages yet') : 
                  (item.lastMessage || 'No messages yet')}
              </Text>
            )}
            
            {item.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadCount}>
                  {item.unreadCount > 99 ? '99+' : item.unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };  // Chat message item component
  const MessageItem = React.memo(({ item, authUser }) => {
    console.log('Rendering message:', item);
    
    // Check if the message is from the current user
    // It could be either item.is_mine or we might need to compare with auth.user.id
    const isMe = item.is_mine || 
                 (item.sender?.id === authUser?.id) || 
                 (item.sender === 'me');
    
    // Handle sender avatar for group chats
    const renderSenderInfo = () => {
      if (isMe || !currentChat?.isGroup) return null;
      
      // Get avatar URL - handle different possible structures
      let avatarUrl = null;
      if (item.sender?.avatar) {
        avatarUrl = formatAvatarUrl(item.sender.avatar);
      } else if (item.sender?.profilePicture) {
        avatarUrl = formatAvatarUrl(item.sender.profilePicture);
      } else if (item.senderInfo?.avatar) {
        avatarUrl = formatAvatarUrl(item.senderInfo.avatar);
      }
      
      // Get sender name - handle different possible structures
      let senderName = item.sender?.name || 
                       item.senderInfo?.name || 
                       'Unknown';
      
      return (
        <View style={styles.messageSenderInfo}>
          {avatarUrl ? (
            <Image 
              source={{ uri: avatarUrl }} 
              style={styles.messageAvatar} 
              defaultSource={require('../../assets/icons/medicine.png')}
            />
          ) : (
            <View style={[styles.messageAvatar, styles.defaultAvatar]}>
              <Text style={styles.defaultAvatarText}>
                {senderName.charAt(0) || '?'}
              </Text>
            </View>
          )}
          <Text style={styles.messageSenderName}>{senderName}</Text>
        </View>
      );
    };
      // Handle content - message could have either content or text property
    const messageContent = item.content || item.text || '';
    console.log('Message content being rendered:', messageContent, 'from item:', item);
    
    // Handle message time - could be in various formats
    const messageTime = item.formatted_time || item.time || 'now';
    // Create animations for new messages
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(isMe ? 50 : -50)).current;
    
    useEffect(() => {
      // Run both animations in parallel
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        })
      ]).start();
    }, []);
    
    return (
      <Animated.View 
        style={[
          styles.messageWrapper,
          isMe ? styles.myMessageWrapper : styles.otherMessageWrapper,
          { 
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }]
          }
        ]}
      >
        {!isMe && renderSenderInfo()}
        
        <View style={styles.messageRow}>
          {!isMe && (
            <View style={styles.avatarContainer}>
              {item.sender?.profilePicture ? (
                <Image
                  source={{ uri: formatAvatarUrl(item.sender.profilePicture) }}
                  style={styles.messageAvatar}
                  defaultSource={require('../../assets/icons/medicine.png')}
                />
              ) : (
                <View style={[styles.messageAvatar, styles.defaultAvatar]}>
                  <Text style={styles.defaultAvatarText}>
                    {(item.sender?.name || 'U').charAt(0)}
                  </Text>
                </View>
              )}
            </View>
          )}
          
          <View style={[
            styles.messageContentContainer,
            isMe ? styles.myMessageContent : styles.otherMessageContent,
          ]}>
            <Text style={[
              styles.messageText,
              isMe ? styles.myMessageText : styles.otherMessageText
            ]}>
              {messageContent}
            </Text>
            
            <Text style={[
              styles.messageTime,
              isMe ? styles.myMessageTime : styles.otherMessageTime
            ]}>
              {messageTime}
            </Text>
          </View>
          
          {isMe && <View style={styles.spacer} />}
        </View>
      </Animated.View>
    );
  });
  
  const renderMessageItem = ({ item }) => {
    return <MessageItem item={item} authUser={auth?.user} />;
    
    return (
      <Animated.View 
        style={[
          styles.messageWrapper,
          isMe ? styles.myMessageWrapper : styles.otherMessageWrapper,
          { 
            opacity: fadeAnim,
            transform: [{ translateX: slideAnim }]
          }
        ]}
      >
        {!isMe && renderSenderInfo()}
        
        <View style={styles.messageRow}>
          {!isMe && (
            <View style={styles.avatarContainer}>
              {item.sender?.profilePicture ? (
                <Image
                  source={{ uri: formatAvatarUrl(item.sender.profilePicture) }}
                  style={styles.messageAvatar}
                  defaultSource={require('../../assets/icons/medicine.png')}
                />
              ) : (
                <View style={[styles.messageAvatar, styles.defaultAvatar]}>
                  <Text style={styles.defaultAvatarText}>
                    {(item.sender?.name || 'U').charAt(0)}
                  </Text>
                </View>
              )}
            </View>
          )}
          
          <View style={[
            styles.messageContentContainer,
            isMe ? styles.myMessageContent : styles.otherMessageContent,
          ]}>
            <Text style={[
              styles.messageText,
              isMe ? styles.myMessageText : styles.otherMessageText
            ]}>
              {messageContent}
            </Text>
            
            <Text style={[
              styles.messageTime,
              isMe ? styles.myMessageTime : styles.otherMessageTime
            ]}>
              {messageTime}
            </Text>
          </View>
          
          {isMe && <View style={styles.spacer} />}
        </View>
      </Animated.View>
    );
  };

  // Typing indicator component
const TypingIndicator = ({ isVisible }) => {
  if (!isVisible) return null;
  
  // Animation dots
  const [dotOpacity1] = useState(new Animated.Value(0.3));
  const [dotOpacity2] = useState(new Animated.Value(0.3));
  const [dotOpacity3] = useState(new Animated.Value(0.3));
  
  // Run animation sequence
  useEffect(() => {
    const animate = () => {
      // Reset opacities
      dotOpacity1.setValue(0.3);
      dotOpacity2.setValue(0.3);
      dotOpacity3.setValue(0.3);
      
      // Sequence of animations
      Animated.sequence([
        // First dot
        Animated.timing(dotOpacity1, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true
        }),
        // Second dot
        Animated.timing(dotOpacity2, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true
        }),
        // Third dot
        Animated.timing(dotOpacity3, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true
        }),
      ]).start(() => {
        // Repeat animation
        setTimeout(animate, 500);
      });
    };
    
    animate();
    return () => {
      // Cleanup any pending animations on unmount
      dotOpacity1.stopAnimation();
      dotOpacity2.stopAnimation();
      dotOpacity3.stopAnimation();
    };
  }, [dotOpacity1, dotOpacity2, dotOpacity3]);
  
  return (
    <View style={styles.typingIndicatorContainer}>
      <View style={styles.typingIndicatorBubble}>
        <Animated.View style={[styles.typingDot, { opacity: dotOpacity1 }]} />
        <Animated.View style={[styles.typingDot, { opacity: dotOpacity2 }]} />
        <Animated.View style={[styles.typingDot, { opacity: dotOpacity3 }]} />
      </View>
    </View>
  );
};  
  // Render the chat list screen
  const renderChatList = () => (
    <SafeAreaView style={styles.container}>      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello,</Text>
        <Text style={styles.username}>{auth?.user?.name || 'User'}</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="search" size={22} color="#333" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton}>
            <Ionicons name="ellipsis-vertical" size={22} color="#333" />
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'all' && styles.activeTab]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
            All Chats
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'groups' && styles.activeTab]}
          onPress={() => setActiveTab('groups')}
        >
          <Text style={[styles.tabText, activeTab === 'groups' && styles.activeTabText]}>
            Groups
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'contacts' && styles.activeTab]}
          onPress={() => setActiveTab('contacts')}
        >
          <Text style={[styles.tabText, activeTab === 'contacts' && styles.activeTabText]}>
            Contacts
          </Text>
        </TouchableOpacity>
      </View>
      
      {loading && chats.length === 0 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#5F58E2" />
          <Text style={styles.loaderText}>Loading conversations...</Text>
        </View>      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <View style={styles.buttonRow}>
            {renderServerDebug()}
            {renderChatDiagnostics()}
          </View>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchChats()}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredChats.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubble-outline" size={60} color="#CCCCCC" />
          <Text style={styles.emptyText}>
            {searchQuery 
              ? 'No conversations match your search' 
              : activeTab === 'all' 
                ? 'No conversations yet' 
                : activeTab === 'groups' 
                  ? 'No group conversations yet'
                  : 'No direct messages yet'
            }
          </Text>
          <Text style={styles.emptySubtext}>
            {searchQuery 
              ? 'Try a different search term' 
              : 'Start a chat with your friends'
            }
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredChats}
          renderItem={renderChatItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={[styles.chatList, { paddingBottom: insets.bottom + 70 }]}
          showsVerticalScrollIndicator={false}
          refreshing={loading}
          onRefresh={fetchChats}
        />
      )}
      
      <TouchableOpacity 
        style={[styles.newChatButton, { bottom: insets.bottom + 90 }]}
        onPress={fetchChats}
      >
        <Ionicons name="refresh" size={24} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );

  // Render the chat detail screen
  const renderChatDetail = () => (
    <SafeAreaView style={styles.chatDetailContainer} edges={['right', 'left']}>
      <View style={styles.chatDetailHeader}>
        <View style={styles.chatDetailHeaderContent}>
          <TouchableOpacity onPress={closeChat} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          
          {currentChat?.avatar ? (
            <Image 
              source={{ uri: formatAvatarUrl(currentChat.avatar) }} 
              style={styles.chatDetailAvatar} 
              defaultSource={require('../../assets/icons/medicine.png')}
            />
          ) : (
            <View style={[styles.chatDetailAvatar, styles.defaultAvatar]}>
              <Text style={styles.defaultAvatarText}>{currentChat?.name?.charAt(0)}</Text>
            </View>
          )}
          
          <View style={styles.chatDetailHeaderInfo}>
            <Text style={styles.chatDetailName}>{currentChat?.name}</Text>
            <Text style={styles.chatDetailStatus}>
              {currentChat?.is_group 
                ? `${currentChat?.participants?.length || 0} members` 
                : currentChat?.isOnline ? 'Online' : ''}
            </Text>
          </View>
          
          <View style={styles.chatDetailActions}>
            <TouchableOpacity style={styles.chatDetailAction}>
              <Ionicons name="call" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.chatDetailAction}>
              <Ionicons name="videocam" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#5F58E2" />
          <Text style={styles.loaderText}>Loading messages...</Text>
        </View>      ) : messages.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubble-ellipses-outline" size={60} color="#CCCCCC" />
          <Text style={styles.emptyText}>No messages yet</Text>
          <Text style={styles.emptySubtext}>Start the conversation</Text>
          {currentChat && <Text style={styles.debugInfo}>Chat ID: {currentChat.id}</Text>}
          <TouchableOpacity 
            style={styles.refreshButton}            onPress={() => fetchMessages(currentChat?.id, true)}>
            <Text style={styles.refreshButtonText}>Refresh Messages</Text>
          </TouchableOpacity>
        </View>
      ) : (        <FlatList
          ref={scrollViewRef}
          data={messages}
          renderItem={renderMessageItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={[styles.messageList, { paddingBottom: 180 }]} // Increased padding to accommodate message area above navbar
          showsVerticalScrollIndicator={false}
          inverted={false}
          ListFooterComponent={() => <TypingIndicator isVisible={currentChat?.isTyping} />}
          ListEmptyComponent={() => (
            <View style={styles.emptyListContainer}>
              <Text style={styles.emptyListText}>Messages failed to load</Text>              <TouchableOpacity onPress={() => fetchMessages(currentChat?.id, true)}>
                <Text style={styles.retryText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}        <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0} // Reduced offset since we're positioning above the navbar
        style={[styles.inputContainerWrapper, { paddingBottom: 10 }]} // Minimal padding since we're above the navbar
      >        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachmentButton}>
            <Ionicons name="attach-outline" size={24} color="#6c63ff" />
          </TouchableOpacity>
          
          <View style={styles.inputFieldContainer}>
            <TouchableOpacity style={styles.emojiButton}>
              <Ionicons name="happy-outline" size={24} color="#666" />
            </TouchableOpacity>
              <TextInput
              style={styles.input}
              value={inputMessage}
              onChangeText={(text) => {
                // Direct update without triggering any other operations
                setInputMessage(text);
              }}
              placeholder="Type a message..."
              placeholderTextColor="#999"
              multiline={true}
              maxLength={1000}
              returnKeyType="default"
            />
            
            <TouchableOpacity style={styles.cameraButton}>
              <Ionicons name="camera-outline" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            style={[
              styles.sendButton,
              inputMessage.trim().length > 0 ? styles.sendButtonActive : null
            ]}
            onPress={sendMessage}
            disabled={inputMessage.trim().length === 0 || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons 
                name="send" 
                size={20} 
                color={inputMessage.trim().length > 0 ? "#fff" : "#999"} 
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  // Update server address function
  const updateServerAddress = () => {
    // Ask user for new server address using alert with prompt
    // On real app, you would use a proper input dialog
    // This is just for development purposes
    
    const newAddress = prompt("Enter new server address (e.g. 192.168.1.5:3000):");
    
    if (newAddress && newAddress.trim() !== '') {
      // Update the API_URL in memory
      // Note: This won't persist after app restart, it's just for testing
      const newApiUrl = `http://${newAddress.trim()}/api`;
      console.log(`Updating API URL to: ${newApiUrl}`);
      
      // In a real implementation, you would update your API provider
      // For now, we'll just show an alert about restarting the app
      alert(`API URL would be updated to ${newApiUrl}\n\nPlease update the API_URL in services/api.js and restart the app.`);
    }
  };
  
  // Function to diagnose chat issues
  const diagnoseChatIssues = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // First check if server is reachable
      const serverReachable = await isServerReachable();
      if (!serverReachable) {
        setError('Server is not reachable. Check your network connection and server status.');
        setLoading(false);
        return;
      }
      
      // Get the most current token from context
      const currentToken = authContext.token;
      if (!currentToken) {
        setError('Authentication is required. Please log in again.');
        setLoading(false);
        return;
      }
      
      // Make test API request directly to check for detailed errors
      try {
        console.log('Diagnosing chat API. Making test request...');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(`${API_URL}/chats`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${currentToken}`,
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          console.log('Chat API response:', data);
          
          // Check if the data is in the expected format
          if (data && data.conversations) {
            setError(null);
            alert('Chat API is working correctly. Found ' + data.conversations.length + ' conversations.');
          } else {
            setError('Chat API response is missing expected data structure.');
          }
        } else {
          const errorText = await response.text();
          console.error('Chat API error:', response.status, errorText);
          setError(`Server error: ${response.status}. Details: ${errorText}`);
        }
      } catch (apiError) {
        console.error('Chat API test failed:', apiError);
        setError('Chat API request failed: ' + apiError.message);
      }
    } catch (error) {
      console.error('Chat diagnosis failed:', error);
      setError('Diagnosis failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Render server status debug component
  const renderServerDebug = () => {
    if (__DEV__) {
      return (
        <TouchableOpacity
          style={styles.debugButton}
          onPress={checkServerConnection}
        >
          <Text style={styles.debugButtonText}>Check Server</Text>
        </TouchableOpacity>
      );
    }
    return null;
  };

  // Render chat diagnostics button
  const renderChatDiagnostics = () => {
    if (__DEV__) {
      return (
        <TouchableOpacity
          style={styles.diagnosticsButton}
          onPress={diagnoseChatIssues}
        >
          <Text style={styles.diagnosticsButtonText}>Diagnose Chat API</Text>
        </TouchableOpacity>
      );
    }
    return null;
  };

  // Add the diagnostic button to the error display
  // Update the error view to include both debug buttons
  const renderErrorView = () => {
    if (error) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <View style={styles.buttonRow}>
            {renderServerDebug()}
            {renderChatDiagnostics()}
          </View>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => fetchChats()}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return null;
  };  // Handle direct chat with a friend from FriendsScreen
  useEffect(() => {
    const handleFriendChat = async () => {
      if (!route.params?.friend || !token) return;
      
      const friendData = route.params.friend;
      console.log('Starting chat with friend:', friendData);
      
      // Store the friend ID to prevent duplicate handling
      const friendId = friendData.id || friendData.userId;
      
      // Clear the route params immediately to prevent multiple executions
      navigation.setParams({ friend: null });
      
      // Check if we already have this conversation
      const existingChat = chats.find(chat => {
        // For direct chats, check if the other person is our friend
        if ((!chat.is_group_chat || !chat.is_group) && chat.participants && chat.participants.length === 2) {
          return chat.participants.some(p => {
            const participantId = p.userId || p.user_id;
            return participantId == friendId; // Use loose comparison for string/number comparison
          });
        }
        return false;
      });
        
      if (existingChat) {
        // Use existing chat
        console.log('Found existing chat:', existingChat);
        // Call openChat instead of just setting currentChat
        openChat(existingChat);
      } else {
        // Create a new conversation with this friend
        console.log('Creating new chat with friend:', friendData);
        setLoading(true);
        
        try {
          // Use the ChatService to create a new conversation
          const result = await ChatService.startDirectChat(token, friendData);
          
          if (result.success && result.conversation) {
            console.log('Successfully created conversation:', result.conversation);
            // Add the new conversation to the list
            const newChat = result.conversation;
            
            // Add to chats list only if it doesn't already exist
            setChats(prevChats => {
              // Check if chat already exists in the list
              const exists = prevChats.some(c => c.id === newChat.id);
              if (exists) {
                return prevChats;
              }
              return [newChat, ...prevChats];
            });
            
            // Open the newly created chat
            openChat(newChat);
          } else {
            console.error('Failed to create conversation:', result.error);
            // Fallback to temporary chat view
            const tempChat = {
              id: 'new_' + friendId, // Use friendId to make this deterministic
              title: friendData.name,
              is_group_chat: false,
              created_at: new Date().toISOString(),
              participants: [
                { user_id: user?.user_id || user?.userId, name: user?.name },
                { user_id: friendId, name: friendData.name }
              ],
              friend: friendData
            };
            
            // Open the temporary chat
            openChat(tempChat);
          }
        } catch (err) {
          console.error('Error creating conversation:', err);
        } finally {
          setLoading(false);
        }
      }
    };
    
    if (route.params?.friend) {
      handleFriendChat();
    }
  }, [route.params?.friend]);

  return (
    <>
      {renderChatList()}
      {currentChat && (
        <Animated.View 
          style={[
            styles.chatDetailWrapper,
            {
              transform: [{ translateX: slideAnim }]
            }
          ]}
        >
          {renderChatDetail()}
        </Animated.View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 16,
    paddingTop: 10,
    backgroundColor: '#fff',
  },
  greeting: {
    fontSize: 16,
    color: '#999',
  },
  username: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  headerButtons: {
    flexDirection: 'row',
    position: 'absolute',
    right: 16,
    top: 16,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
  },
  activeTab: {
    backgroundColor: '#5F58E2',
  },
  tabText: {
    color: '#999',
    fontSize: 14,
  },
  activeTabText: {
    color: '#fff',
    fontWeight: '500',
  },
  chatList: {
    paddingHorizontal: 16,
  },
  chatItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  defaultAvatar: {
    backgroundColor: '#5F58E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultAvatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  onlineIndicator: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2,
    borderColor: '#fff',
  },
  chatInfo: {
    flex: 1,
    marginLeft: 12,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chatName: {
    fontWeight: '600',
    fontSize: 16,
    color: '#333',
  },
  chatTime: {
    fontSize: 12,
    color: '#999',
  },
  chatPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  lastMessageWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  lastMessageText: {
    fontSize: 14,
    color: '#8E8E93',
    flex: 1,
  },
  myLastMessage: {
    color: '#999',
    fontStyle: 'italic',
  },
  unreadLastMessage: {
    fontWeight: 'bold',
    color: '#333',
  },  typingText: {
    fontSize: 14,
    color: '#6C63FF',
    fontStyle: 'italic',
    flex: 1,
  },
  typingIndicatorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'flex-start',
  },
  typingIndicatorBubble: {
    backgroundColor: '#F0F0F0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#666',
    marginHorizontal: 2,
  },
  unreadBadge: {
    backgroundColor: '#5F58E2',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadCount: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  newChatButton: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#5F58E2',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#5F58E2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },  chatDetailWrapper: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    zIndex: 1000, // Higher zIndex to ensure it's visible
  },
  chatDetailContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },  chatDetailHeader: {
    backgroundColor: '#6C63FF',
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  chatDetailHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 18,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatDetailAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginLeft: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  chatDetailHeaderInfo: {
    flex: 1,
    marginLeft: 12,
  },
  chatDetailName: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  chatDetailStatus: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
  },
  chatDetailActions: {
    flexDirection: 'row',
  },
  chatDetailAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingBottom: 100, // Extra padding at bottom to ensure messages aren't hidden behind input
  },messageWrapper: {
    marginBottom: 12,
    maxWidth: '85%',
  },
  myMessageWrapper: {
    alignItems: 'flex-end',
    alignSelf: 'flex-end',
  },
  otherMessageWrapper: {
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
  },
  messageSenderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  messageAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  messageSenderName: {
    fontSize: 12,
    color: '#999',
  },  messageContentContainer: {
    maxWidth: '85%',
    padding: 14,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  myMessageContent: {
    backgroundColor: '#6C63FF',
    borderBottomRightRadius: 6,
  },
  otherMessageContent: {
    backgroundColor: '#F5F5F5',
    borderBottomLeftRadius: 6,
  },  messageText: {
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: 0.2,
  },
  myMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#333',
  },messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  messageTime: {
    fontSize: 10,
  },
  myMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  otherMessageTime: {
    color: '#999',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  loaderText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  errorText: {
    marginTop: 12,
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#5F58E2',
    borderRadius: 20,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    marginTop: 16,
    justifyContent: 'center',
  },
  checkButton: {
    marginLeft: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#4CAF50',
    borderRadius: 20,
  },
  retryText: {
    color: '#fff',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '500',
    color: '#333',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',  },  inputContainerWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 70, // Position above the navbar (which is at bottom:0)
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 10,
    zIndex: 5000, // Much higher zIndex to ensure it appears above everything
  },  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },inputFieldContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F7F7',
    borderRadius: 24,
    marginHorizontal: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#EBEBEB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },attachmentButton: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 21,
    backgroundColor: '#F0F0FF',
    marginRight: 8,
    shadowColor: '#6C63FF',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },  emojiButton: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  cameraButton: {
    width: 38,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 16,
    color: '#333',
    fontWeight: '400',
    letterSpacing: 0.2,
  },sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sendButtonActive: {
    backgroundColor: '#6C63FF',
  },
  fileMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  fileIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileDetails: {
    marginLeft: 8,
    flex: 1,
  },
  fileName: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 14,
  },
  fileSize: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  downloadButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  debugButton: {
    backgroundColor: '#8a2be2', // Purple color
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginVertical: 10,
    alignSelf: 'center',
  },
  debugButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  diagnosticsButton: {
    backgroundColor: '#ff6b6b', // Coral red color
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginVertical: 10,
    alignSelf: 'center',
  },
  diagnosticsButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  typingIndicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  typingIndicatorBubble: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#5F58E2',
    marginHorizontal: 2,
  },
});

export default ChatScreen;
