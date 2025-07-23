import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  ActivityIndicator,
  Alert,
  Modal,
  TouchableWithoutFeedback,
  Keyboard,
  Animated,
  Switch,
  RefreshControl
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CustomHeader from '../../components/navigation/CustomHeader';
import { useAuth } from '../../components/context/AuthContext';
import { ContactService, API_URL, UserService } from '../../services/api';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

const FriendsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const [friends, setFriends] = useState([]);  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [addFriendModalVisible, setAddFriendModalVisible] = useState(false);
  const [searchType, setSearchType] = useState('email'); // 'email', 'name', 'username', or 'medication'
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // States for friend requests
  const [friendRequests, setFriendRequests] = useState({ sent: [], received: [] });
  const [isRequestsLoading, setIsRequestsLoading] = useState(false);
  const [friendRequestsModalVisible, setFriendRequestsModalVisible] = useState(false);
  const [requestsRefreshKey, setRequestsRefreshKey] = useState(0);
  
  // States for username management
  const [currentUsername, setCurrentUsername] = useState('');
  const [isUsernameAvailable, setIsUsernameAvailable] = useState(true);
  const [usernameErrorMessage, setUsernameErrorMessage] = useState('');
  const [isUsernameModalVisible, setIsUsernameModalVisible] = useState(false);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  
  // Create animation values array to store animation values for each item
  const animatedValues = useRef([]).current;
    // Load friends when component mounts
  useEffect(() => {
    if (token) {
      loadFriends();
      loadFriendRequests();
    }
  }, [token]);
  
  // Function to load friends from API
  const loadFriends = async () => {
    setIsLoading(true);
    
    try {
      const response = await ContactService.getContacts(token);
      
      if (response.success) {
        // Filter to show only contacts of type 'friend'
        const friendContacts = response.data.filter(contact => contact.type === 'friend');
        
        // Transform to match our UI format
        const mappedFriends = friendContacts.map((contact, index) => {
          // Use a different gradient for each friend based on index
          const gradientColors = [
            ['#FF9966', '#FF5E62'],
            ['#56CCF2', '#2F80ED'],
            ['#FFAFBD', '#ffc3a0'],
            ['#7F7FD5', '#91EAE4'],
            ['#43C6AC', '#191654'],
            ['#DCE35B', '#45B649']
          ][index % 6];
          
          return {
            id: contact.id.toString(),
            userId: contact.userId,
            name: contact.nickname || contact.name,
            username: contact.name.toLowerCase().replace(' ', ''),
            email: contact.email,
            profilePicture: contact.profilePicture,
            lastActive: 'Recently', // This info isn't available from the backend
            medications: 0, // This info isn't available from the backend
            online: false, // This info isn't available from the backend
            backgroundGradient: gradientColors
          };
        });
        
        setFriends(mappedFriends);
      } else {
        console.error('Failed to load friends:', response.error);
        Alert.alert('Error', 'Failed to load friends. Please try again later.');
      }
    } catch (error) {
      console.error('Error loading friends:', error);
      Alert.alert('Error', 'Failed to load friends. Please try again later.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };
    // Function to handle pull-to-refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    loadFriends();
    loadFriendRequests();
  };
  
  // Load friend requests
  const loadFriendRequests = async () => {
    setIsRequestsLoading(true);
    
    try {
      const response = await ContactService.getFriendRequests(token);
      
      if (response.success) {
        setFriendRequests({
          sent: response.data.sent || [],
          received: response.data.received || []
        });
      } else {
        console.error('Failed to load friend requests:', response.error);
      }
    } catch (error) {
      console.error('Error loading friend requests:', error);
    } finally {
      setIsRequestsLoading(false);
    }
  };
  
  // Function to accept a friend request
  const handleAcceptFriendRequest = async (requestId) => {
    try {
      const response = await ContactService.acceptFriendRequest(token, requestId);
      
      if (response.success) {
        // Add new friend to friends list with a random gradient
        const randomIndex = Math.floor(Math.random() * 6);
        const gradients = [
          ['#FF9966', '#FF5E62'],
          ['#56CCF2', '#2F80ED'],
          ['#FFAFBD', '#ffc3a0'],
          ['#7F7FD5', '#91EAE4'],
          ['#43C6AC', '#191654'],
          ['#DCE35B', '#45B649']
        ];
        
        // Reload friends and friend requests
        loadFriends();
        loadFriendRequests();
        
        // Refresh the requests list
        setRequestsRefreshKey(prev => prev + 1);
        
        Alert.alert('Success', 'Friend request accepted!');
      } else {
        Alert.alert('Error', response.error || 'Failed to accept friend request.');
      }
    } catch (error) {
      console.error('Error accepting friend request:', error);
      Alert.alert('Error', 'Failed to accept friend request. Please try again later.');
    }
  };
  
  // Function to reject a friend request
  const handleRejectFriendRequest = async (requestId) => {
    try {
      const response = await ContactService.rejectFriendRequest(token, requestId);
      
      if (response.success) {
        // Remove the request from the list
        setFriendRequests(prev => ({
          ...prev,
          received: prev.received.filter(request => request.id !== requestId)
        }));
        
        // Refresh the requests list
        setRequestsRefreshKey(prev => prev + 1);
        
        Alert.alert('Success', 'Friend request rejected.');
      } else {
        Alert.alert('Error', response.error || 'Failed to reject friend request.');
      }
    } catch (error) {
      console.error('Error rejecting friend request:', error);
      Alert.alert('Error', 'Failed to reject friend request. Please try again later.');
    }
  };
  
  // Function to cancel a friend request
  const handleCancelFriendRequest = async (requestId) => {
    try {
      const response = await ContactService.cancelFriendRequest(token, requestId);
      
      if (response.success) {
        // Remove the request from the list
        setFriendRequests(prev => ({
          ...prev,
          sent: prev.sent.filter(request => request.id !== requestId)
        }));
        
        // Refresh the requests list
        setRequestsRefreshKey(prev => prev + 1);
        
        Alert.alert('Success', 'Friend request cancelled.');
      } else {
        Alert.alert('Error', response.error || 'Failed to cancel friend request.');
      }
    } catch (error) {
      console.error('Error cancelling friend request:', error);
      Alert.alert('Error', 'Failed to cancel friend request. Please try again later.');
    }
  };
  
  // Search for users
  const searchUsers = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    
    try {
      const response = await ContactService.searchUsers(token, searchQuery.trim(), searchType);
      
      if (response.success) {
        setSearchResults(response.data);
      } else {
        Alert.alert('Search Failed', response.error || 'Failed to search users.');
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Error searching users:', error);
      Alert.alert('Error', 'Failed to search for users. Please try again later.');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };
    // Function to add a friend (send a friend request)
  const handleAddFriend = async (user) => {
    try {
      // Check if already in friends list
      if (friends.some(friend => friend.userId === user.userId)) {
        Alert.alert('Already Friends', 'You are already friends with this user.');
        return;
      }
      
      // Check if there's already a pending friend request to this user
      if (friendRequests.sent.some(request => request.userId === user.userId && request.status === 'pending')) {
        Alert.alert('Request Pending', 'You already have a pending friend request to this user.');
        return;
      }
      
      // Send a friend request
      const response = await ContactService.addContact(token, user.userId, 'friend');
      
      if (response.success) {
        // Check if this was auto-accepted (meaning the other user already sent you a request)
        if (response.data.requestStatus === 'accepted') {
          // Create a new friend object with a random gradient color
          const randomIndex = Math.floor(Math.random() * 6);
          const gradients = [
            ['#FF9966', '#FF5E62'],
            ['#56CCF2', '#2F80ED'],
            ['#FFAFBD', '#ffc3a0'],
            ['#7F7FD5', '#91EAE4'],
            ['#43C6AC', '#191654'],
            ['#DCE35B', '#45B649']
          ];
          
          const newFriend = {
            id: response.data.id.toString(),
            userId: response.data.userId,
            name: response.data.name,
            username: response.data.name ? response.data.name.toLowerCase().replace(' ', '') : '',
            email: response.data.email,
            profilePicture: response.data.profilePicture,
            lastActive: 'Just added',
            medications: 0,
            online: false,
            backgroundGradient: gradients[randomIndex]
          };
          
          // Add to friends list
          setFriends([...friends, newFriend]);
          
          Alert.alert('Success', `${response.data.name} has been added to your friends list.`);
        } else {          // Friend request was sent but needs to be accepted
          // Update the friend requests list
          loadFriendRequests();
          
          Alert.alert('Friend Request Sent', `A friend request has been sent to ${user.name}.`);
        }
          // Close modal and reset search
        setAddFriendModalVisible(false);
        setSearchQuery('');
        setSearchResults([]);
      } else {
        Alert.alert('Error', response.error || 'Failed to send friend request.');
      }
    } catch (error) {
      console.error('Error adding friend:', error);
      Alert.alert('Error', 'Failed to add friend. Please try again later.');
    }
  };
  
  // Remove a friend
  const handleRemoveFriend = async (friend) => {
    try {
      // Confirm before removing
      Alert.alert(
        'Remove Friend',
        `Are you sure you want to remove ${friend.name} from your friends list?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: async () => {
            // Send delete request to the API
            const response = await ContactService.deleteContact(token, friend.id);
            
            if (response.success) {
              // Remove from the friends list
              setFriends(friends.filter(f => f.id !== friend.id));
              Alert.alert('Success', `${friend.name} has been removed from both users' friends lists.`);
            } else {
              Alert.alert('Error', response.error || 'Failed to remove friend.');
            }
          }}
        ]
      );
    } catch (error) {
      console.error('Error removing friend:', error);
      Alert.alert('Error', 'Failed to remove friend. Please try again later.');
    }
  };
    // Load user profile data to get username
  const loadUserProfile = async () => {
    try {
      const response = await UserService.getProfile(token);
      
      if (response.success && response.data) {
        // Set username from user profile - ensure it's not undefined
        if (response.data.username) {
          setCurrentUsername(response.data.username);
          console.log('Username loaded:', response.data.username);
        } else {
          setCurrentUsername('');
          console.log('No username set in profile');
        }
      } else {
        console.error('Failed to load user profile:', response.error);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };
  
  // Load profile when component mounts
  useEffect(() => {
    if (token) {
      loadUserProfile();
    }
  }, [token]);
  
  // Filter friends based on search query
  const filteredFriends = useMemo(() => {
    return searchQuery
      ? friends.filter(friend => 
          friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          friend.email.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : friends;
  }, [searchQuery, friends]);
  
  // Generate initials for avatar
  const getInitials = (name) => {
    if (!name) return '??';
    const names = name.split(' ');
    if (names.length >= 2) {
      return `${names[0].charAt(0)}${names[1].charAt(0)}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };  // Create animation when friends change
  useEffect(() => {
    friends.forEach((_, i) => {
      if (!animatedValues[i]) {
        animatedValues[i] = new Animated.Value(0);
      }
    });
    
    const animations = friends.map((_, i) => {
      return Animated.timing(animatedValues[i], {
        toValue: 1,
        duration: 300,
        delay: i * 150,
        useNativeDriver: true,
      });
    });
    
    Animated.stagger(100, animations).start();
  }, [friends]);
  
  // Add debug function for image URLs
  const getImageUrl = (profilePicture) => {
    let url;
    if (profilePicture) {
      if (profilePicture.startsWith('http')) {
        url = profilePicture;
      } else if (profilePicture.startsWith('/')) {
        url = `${API_URL}${profilePicture}`;
      } else {
        url = `${API_URL}/${profilePicture}`;
      }
      console.log('Image URL constructed:', url, 'from original:', profilePicture);
      return url;
    }
    return null;
  };
  
  // Render each friend item
  const renderItem = ({ item, index }) => {
    const animatedStyle = {
      opacity: animatedValues[index] || new Animated.Value(1),
      transform: [
        {
          translateY: animatedValues[index] ? animatedValues[index].interpolate({
            inputRange: [0, 1],
            outputRange: [50, 0],
          }) : 0,
        }
      ],
    };
    
    return (
      <Animated.View style={[styles.friendItem, animatedStyle]}>
        <LinearGradient
          colors={item.backgroundGradient}
          style={styles.friendCardGradient}
        >
          <View style={styles.friendContent}>
            {/* Avatar */}
            <View style={styles.avatarContainer}>              {item.profilePicture ? (
                <Image                  source={{ uri: getImageUrl(item.profilePicture) }}
                  style={styles.avatar}
                  onError={() => console.log('Error loading image:', item.profilePicture)}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
                </View>
              )}
              <View style={[
                styles.onlineIndicator, 
                { backgroundColor: item.online ? '#4CAF50' : '#A0AEC0' }
              ]} />
            </View>
            
            {/* Friend Info */}
            <View style={styles.friendInfo}>
              <View style={styles.nameAndUsername}>
                <Text style={styles.friendName}>{item.name}</Text>
                {/* <Text style={styles.usernameText}>@{item.username}</Text> */}
              </View>
              <Text style={styles.friendEmail}>{item.email}</Text>
            </View>
            
            {/* Friend Actions */}
            <View style={styles.friendActions}>              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  
                  // Create a minimal friend object with just the necessary properties
                  const friendForChat = {
                    id: item.userId || item.id,
                    name: item.name,
                    profilePicture: item.profilePicture
                  };
                  
                  // Navigate to the TabHome first, then to the Chat tab
                  navigation.navigate('TabHome', { 
                    screen: 'Chat', 
                    params: { friend: friendForChat, timestamp: Date.now() } // Add timestamp to force param change
                  });
                  console.log('Navigating to chat with friend:', friendForChat);
                }}
              >
                <Ionicons name="chatbubble-outline" size={18} color="#4A6AFF" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  handleRemoveFriend(item);
                }}
              >
                <Ionicons name="person-remove-outline" size={18} color="#FF4A4A" />
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    );
  };
  
  // Render empty state when there are no friends
  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4A6AFF" />
          <Text style={styles.loadingText}>Loading friends...</Text>
        </View>
      );
    }
    
    return (
      <View style={styles.emptyState}>
        <LinearGradient
          colors={['#F0F5FF', '#E0EAFF']}
          style={styles.emptyStateIconContainer}
        >
          <Ionicons name="people" size={50} color="#4A6AFF" />
        </LinearGradient>
        <Text style={styles.emptyStateTitle}>No Friends Yet</Text>
        <Text style={styles.emptyStateText}>
          Add friends to share your medication schedules and keep track of each other's medication adherence.
        </Text>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setAddFriendModalVisible(true);
          }}
        >
          <LinearGradient
            colors={['#4A6AFF', '#6C8FFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.emptyStateButtonGradient}
          >
            <View style={styles.emptyStateButton}>
              <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 }}>
                Add Friends
              </Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  };
  
  // Add Friend Modal
  const renderAddFriendModal = () => {
    return (
      <Modal
        visible={addFriendModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAddFriendModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <LinearGradient
                colors={['#FFFFFF', '#F5F7FA']}
                style={styles.modalGradient}
              >
                <View style={styles.modalHandleBar} />
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Add New Friend</Text>
                  <TouchableOpacity 
                    style={styles.modalCloseButton}
                    onPress={() => {
                      setAddFriendModalVisible(false);
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                  >
                    <Ionicons name="close" size={20} color="#4A6AFF" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.formContainer}>
                  <View style={styles.searchTypeContainer}>
                    <Text style={styles.searchTypeLabel}>Search by:</Text>
                    <View style={styles.searchTypeButtonsContainer}>
                      <TouchableOpacity 
                        style={[
                          styles.searchTypeButton, 
                          searchType === 'email' && styles.searchTypeButtonActive
                        ]}
                        onPress={() => setSearchType('email')}
                      >
                        <Text style={[
                          styles.searchTypeText,
                          searchType === 'email' && styles.searchTypeTextActive
                        ]}>Email</Text>
                      </TouchableOpacity>
                        <TouchableOpacity 
                        style={[
                          styles.searchTypeButton, 
                          searchType === 'name' && styles.searchTypeButtonActive
                        ]}
                        onPress={() => setSearchType('name')}
                      >
                        <Text style={[
                          styles.searchTypeText,
                          searchType === 'name' && styles.searchTypeTextActive
                        ]}>Name</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity 
                        style={[
                          styles.searchTypeButton, 
                          searchType === 'username' && styles.searchTypeButtonActive
                        ]}
                        onPress={() => setSearchType('username')}
                      >
                        <Text style={[
                          styles.searchTypeText,
                          searchType === 'username' && styles.searchTypeTextActive
                        ]}>Username</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={[
                          styles.searchTypeButton, 
                          searchType === 'medication' && styles.searchTypeButtonActive
                        ]}
                        onPress={() => setSearchType('medication')}
                      >
                        <Text style={[
                          styles.searchTypeText,
                          searchType === 'medication' && styles.searchTypeTextActive
                        ]}>Medication</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  <View style={styles.formLabelContainer}>
                    <Ionicons name="search" size={18} color="#4A6AFF" />                    <Text style={styles.formLabel}>
                      {searchType === 'email' ? 'Enter Email Address' : 
                       searchType === 'name' ? 'Enter User Name' :
                       searchType === 'username' ? 'Enter Username' : 'Enter Medication Name'}
                    </Text>
                  </View>
                  <View style={styles.inputContainer}>                    <TextInput
                      style={styles.formInput}
                      value={searchQuery}
                      onChangeText={setSearchQuery}                      placeholder={
                        searchType === 'email' ? "friend@example.com" :
                        searchType === 'name' ? "John Smith" :
                        searchType === 'username' ? "username123" : "Aspirin"
                      }
                      placeholderTextColor="#A0AEC0"
                      autoCapitalize="none"
                      keyboardType={searchType === 'email' ? "email-address" : "default"}
                    />
                    {searchQuery.length > 0 && (
                      <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Ionicons name="close-circle" size={20} color="#A0AEC0" />
                      </TouchableOpacity>
                    )}
                  </View>
                  
                  <TouchableOpacity
                    style={[styles.gradientButton, !searchQuery.trim() && styles.disabledGradientButton]}
                    onPress={searchUsers}
                    disabled={!searchQuery.trim() || isSearching}
                  >
                    <LinearGradient
                      colors={['#4A6AFF', '#6E8AFF']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.submitButton}
                    >
                      {isSearching ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text style={styles.submitButtonText}>Search</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
                
                {/* Search Results */}
                {searchResults.length > 0 ? (
                  <View style={styles.searchResultsContainer}>
                    <Text style={styles.searchResultsTitle}>Search Results</Text>
                    <FlatList
                      data={searchResults}
                      keyExtractor={(item) => item.userId.toString()}
                      renderItem={({ item }) => (
                        <View style={styles.searchResultItem}>
                          <View style={styles.searchResultAvatarContainer}>
                            {item.profilePicture ? (                              <Image                                source={{ uri: getImageUrl(item.profilePicture) }}
                                style={styles.searchResultAvatar}
                                onError={() => console.log('Error loading search result image:', item.profilePicture)}
                              />
                            ) : (
                              <View style={[
                                styles.searchResultAvatarPlaceholder,
                                { backgroundColor: '#4A6AFF' }
                              ]}>
                                <Text style={styles.searchResultAvatarText}>
                                  {getInitials(item.name)}
                                </Text>
                              </View>
                            )}
                          </View>                          <View style={styles.searchResultInfo}>
                            <Text style={styles.searchResultName}>{item.name}</Text>
                            <View style={styles.searchResultDetailContainer}>
                              {item.username ? (
                                <Text style={styles.searchResultUsername}>@{item.username}</Text>
                              ) : null}
                              <Text style={styles.searchResultEmail}>{item.email}</Text>
                            </View>
                          </View>
                          <TouchableOpacity
                            style={styles.addUserButton}
                            onPress={() => handleAddFriend(item)}
                          >
                            <Ionicons name="person-add" size={18} color="#FFFFFF" />
                          </TouchableOpacity>
                        </View>
                      )}
                      contentContainerStyle={{ paddingBottom: 20 }}
                    />
                  </View>
                ) : (
                  <View style={styles.noResultsContainer}>
                    <Text style={styles.noResultsText}>
                      {searchQuery && !isSearching 
                        ? `No users found with the ${searchType} "${searchQuery}"`
                        : 'Search for users to add as friends'}
                    </Text>
                    <Text style={styles.noResultsSubText}>
                      {searchType === 'email' 
                        ? 'Try searching with a different email address'
                        : searchType === 'name'
                        ? 'Try searching with a different name'
                        : 'Try searching for a different medication'}
                    </Text>
                  </View>
                )}
              </LinearGradient>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  };
    // Username modal component
  const renderUsernameModal = () => {
    return (
      <Modal
        visible={isUsernameModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsUsernameModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <LinearGradient
                colors={['#FFFFFF', '#F5F7FA']}
                style={styles.modalGradient}
              >
                <View style={styles.modalHandleBar} />
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Set Display Username</Text>
                  <TouchableOpacity 
                    style={styles.modalCloseButton}
                    onPress={() => {
                      setIsUsernameModalVisible(false);
                    }}
                  >
                    <Ionicons name="close" size={20} color="#4A6AFF" />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.formContainer}>
                  <View style={styles.formLabelContainer}>
                    <Ionicons name="at" size={18} color="#4A6AFF" />
                    <Text style={styles.formLabel}>Your Unique Username</Text>
                  </View>
                  
                  <View style={[
                    styles.inputContainer, 
                    currentUsername && currentUsername.length >= 3 && !isUsernameAvailable && styles.inputError
                  ]}>
                    <TextInput
                      style={styles.formInput}
                      value={currentUsername}
                      onChangeText={handleUsernameChange}
                      placeholder="Enter a username"
                      placeholderTextColor="#A0AEC0"
                      autoCapitalize="none"
                      maxLength={20}
                    />
                    {currentUsername && currentUsername.length >= 3 ? (
                      isUsernameAvailable ? (
                        <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                      ) : (
                        <Ionicons name="close-circle" size={20} color="#FF4A4A" />
                      )
                    ) : null}
                  </View>
                  
                  {usernameErrorMessage ? (
                    <Text style={styles.errorText}>{usernameErrorMessage}</Text>
                  ) : currentUsername && currentUsername.length >= 3 && isUsernameAvailable ? (
                    <Text style={styles.successText}>Username looks good!</Text>
                  ) : null}
                  
                  <Text style={styles.usernameHelpText}>
                    Set a unique username that will be visible to your friends.
                    Usernames must be at least 3 characters and can only contain letters, numbers, and underscores.
                    Friends can search for you using this username.
                  </Text>
                  
                  <TouchableOpacity
                    style={[
                      styles.gradientButton, 
                      (!currentUsername || currentUsername.length < 3 || !isUsernameAvailable || isSavingUsername) && styles.disabledGradientButton
                    ]}
                    onPress={saveUsername}
                    disabled={!currentUsername || currentUsername.length < 3 || !isUsernameAvailable || isSavingUsername}
                  >
                    <LinearGradient
                      colors={['#4A6AFF', '#6E8AFF']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.submitButton}
                    >
                      {isSavingUsername ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <Text style={styles.submitButtonText}>Save Username</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  };
  // Functions for username management
  const handleUsernameChange = (text) => {
    // Accept only alphanumeric characters and underscores
    const sanitizedText = text.replace(/[^a-zA-Z0-9_]/g, '');
    setCurrentUsername(sanitizedText);
    
    if (sanitizedText.length >= 3) {
      // Check username availability from backend
      checkUsernameAvailability(sanitizedText);
    } else {
      setIsUsernameAvailable(false);
      if (sanitizedText.length > 0) {
        setUsernameErrorMessage('Username must be at least 3 characters');
      } else {
        setUsernameErrorMessage('');
      }
    }
  };
  
  const checkUsernameAvailability = async (username) => {
    if (!username || username.length < 3) return;
    
    try {
      setIsCheckingUsername(true);
      const response = await UserService.checkUsername(token, username);
      
      if (response && response.data) {
        setIsUsernameAvailable(response.data.available);
        if (!response.data.available) {
          setUsernameErrorMessage('This username is already taken');
        } else {
          setUsernameErrorMessage('');
        }
      }
    } catch (error) {
      console.error('Error checking username:', error);
      // Even if there's an error, allow the user to continue
      setIsUsernameAvailable(true);
      setUsernameErrorMessage('Could not verify username. You may continue.');
    } finally {
      setIsCheckingUsername(false);
    }
  };
  
  const saveUsername = async () => {
    if (!currentUsername || currentUsername.length < 3 || !isUsernameAvailable) {
      console.log('Cannot save username:', { 
        username: currentUsername, 
        length: currentUsername ? currentUsername.length : 0, 
        isAvailable: isUsernameAvailable 
      });
      return;
    }
    
    try {
      setIsSavingUsername(true);
      const response = await UserService.updateUsername(token, currentUsername);
      
      if (response && response.success) {
        Alert.alert('Success', 'Your username has been updated successfully');
        setIsUsernameModalVisible(false);
      } else {
        console.error('Failed to update username:', response?.error);
        Alert.alert('Error', response?.error || 'Failed to update username');
      }
    } catch (error) {
      console.error('Error saving username:', error);
      Alert.alert('Error', 'Failed to update username. Please try again later.');
    } finally {
      setIsSavingUsername(false);
    }
  };
    // Render Friend Requests Modal
  const renderFriendRequestsModal = () => {
    return (      <Modal
        visible={friendRequestsModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setFriendRequestsModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setFriendRequestsModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.friendRequestModalContainer}>
                <LinearGradient
                  colors={['#F0F4FF', '#FFFFFF']}
                  style={styles.modalContent}
                >
                  <View style={styles.modalHandleBar} />
                  <View style={styles.modalHeader}>
                    <View style={styles.modalTitleContainer}>
                      <Ionicons name="people" size={24} color="#4A6AFF" style={{ marginRight: 10 }} />
                      <Text style={styles.modalTitle}>Friend Requests</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setFriendRequestsModalVisible(false)}
                      style={styles.modalCloseButton}
                    >
                      <Ionicons name="close" size={18} color="#4A6AFF" />
                    </TouchableOpacity>
                  </View>
                  
                  {isRequestsLoading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color="#4A6AFF" />
                    </View>
                  ) : (
                    <View style={{ flex: 1 }}>                      {/* Received Friend Requests Section */}
                      <View style={styles.requestSectionHeader}>
                        <Ionicons name="arrow-down-circle" size={20} color="#4A6AFF" />
                        <Text style={styles.requestSectionTitle}>Requests Received</Text>
                      </View>
                      {friendRequests.received.length === 0 ? (
                        <View style={styles.emptyRequestContainer}>
                          <Ionicons name="mail-unread-outline" size={36} color="#A0AEC0" />
                          <Text style={styles.noRequestsText}>No friend requests received</Text>
                          <Text style={styles.noRequestsSubtext}>When someone sends you a request, it will appear here</Text>
                        </View>
                      ) : (
                        <FlatList                          key={`received-${requestsRefreshKey}`}
                          data={friendRequests.received.filter(r => r.status === 'pending')}
                          keyExtractor={item => `received-${item.id}`}
                          renderItem={({ item }) => (
                            <View style={styles.requestItem}>                              <View style={styles.requestUserInfo}>
                                <Image
                                  source={
                                    item.profilePicture
                                      ? { uri: getImageUrl(item.profilePicture) }
                                      : require('../../assets/icons/medicine.png') // Use a default icon
                                  }
                                  style={styles.requestUserImage}
                                  onError={() => console.log('Error loading received request image:', item.profilePicture)}
                                />
                                <View>
                                  <Text style={styles.requestUserName}>{item.name}</Text>
                                  {item.username && (
                                    <Text style={styles.requestUserUsername}>@{item.username}</Text>
                                  )}
                                </View>
                              </View>
                              <View style={styles.requestActions}>                                <TouchableOpacity
                                  style={styles.acceptButton}
                                  onPress={() => {
                                    handleAcceptFriendRequest(item.id);
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  }}
                                >
                                  <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" style={{ marginRight: 5 }} />
                                  <Text style={styles.acceptButtonText}>Accept</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.rejectButton}
                                  onPress={() => {
                                    handleRejectFriendRequest(item.id);
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  }}
                                >
                                  <Ionicons name="close-circle" size={16} color="#4A6AFF" style={{ marginRight: 5 }} />
                                  <Text style={styles.rejectButtonText}>Reject</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          )}
                        />
                      )}
                        {/* Sent Friend Requests Section */}
                      <View style={[styles.requestSectionHeader, { marginTop: 25 }]}>
                        <Ionicons name="arrow-up-circle" size={20} color="#4CAF50" />
                        <Text style={styles.requestSectionTitle}>Requests Sent</Text>
                      </View>
                      {friendRequests.sent.length === 0 ? (
                        <View style={styles.emptyRequestContainer}>
                          <Ionicons name="paper-plane-outline" size={36} color="#A0AEC0" />
                          <Text style={styles.noRequestsText}>No friend requests sent</Text>
                          <Text style={styles.noRequestsSubtext}>Search for friends to send them a request</Text>
                        </View>
                      ) : (
                        <FlatList                          key={`sent-${requestsRefreshKey}`}
                          data={friendRequests.sent.filter(r => r.status === 'pending')}
                          keyExtractor={item => `sent-${item.id}`}
                          renderItem={({ item }) => (
                            <View style={styles.requestItem}>                              <View style={styles.requestUserInfo}>
                                <Image
                                  source={
                                    item.profilePicture
                                      ? { uri: getImageUrl(item.profilePicture) }
                                      : require('../../assets/icons/medicine.png') // Use a default icon
                                  }
                                  style={styles.requestUserImage}
                                  onError={() => console.log('Error loading sent request image:', item.profilePicture)}
                                />
                                <View>
                                  <Text style={styles.requestUserName}>{item.name}</Text>
                                  {item.username && (
                                    <Text style={styles.requestUserUsername}>@{item.username}</Text>
                                  )}
                                </View>
                              </View>
                              <View style={styles.requestActions}>                                <TouchableOpacity
                                  style={styles.cancelButton}
                                  onPress={() => {
                                    handleCancelFriendRequest(item.id);
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  }}
                                >
                                  <Ionicons name="close-circle" size={16} color="#DC2626" style={{ marginRight: 5 }} />
                                  <Text style={styles.cancelButtonText}>Cancel</Text>
                                </TouchableOpacity>
                              </View>
                            </View>
                          )}
                        />
                      )}
                    </View>
                  )}
                    <TouchableOpacity 
                    style={styles.refreshButton}
                    onPress={() => {
                      loadFriendRequests();
                      setRequestsRefreshKey(prev => prev + 1);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Ionicons name="refresh" size={18} color="#4A6AFF" style={{ marginRight: 8 }} />
                    <Text style={styles.refreshButtonText}>Refresh Requests</Text>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  };
  
    return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="dark-content" />
        
        <CustomHeader title="Friends" />
        
        {/* Username Section */}        <TouchableOpacity 
          style={styles.usernameSection}
          onPress={() => setIsUsernameModalVisible(true)}
        >
          <View style={styles.usernameContent}>
            <View style={styles.usernameIconContainer}>
              <Ionicons name="at" size={18} color="#4A6AFF" />
            </View>
            <View style={styles.usernameTextContainer}>
              {currentUsername && currentUsername.length > 0 ? (
                <View style={styles.activeUsernameContainer}>
                  <Text style={styles.activeUsernameLabel}>Your Username</Text>
                  <Text style={styles.activeUsername}>@{currentUsername}</Text>
                </View>
              ) : (
                <Text style={styles.setUsernameText}>
                  Set your username to make it easier for friends to find you
                </Text>
              )}
            </View>
            <View style={styles.usernameArrowContainer}>
              <Ionicons name="chevron-forward" size={20} color="#4A6AFF" />
            </View>
          </View>
        </TouchableOpacity>
          <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={22} color="#A0AEC0" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search friends..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#A0AEC0"
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="#A0AEC0" />
              </TouchableOpacity>
            ) : null}
          </View>
          
          <TouchableOpacity
            style={styles.requestsButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setFriendRequestsModalVisible(true);
            }}
          >
            <Ionicons name="people" size={22} color="#4A6AFF" />
            {friendRequests.received.filter(r => r.status === 'pending').length > 0 && (
              <View style={styles.requestsBadge}>
                <Text style={styles.requestsBadgeText}>
                  {friendRequests.received.filter(r => r.status === 'pending').length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setAddFriendModalVisible(true);
            }}
          >
            <Ionicons name="person-add" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        
        <FlatList
          data={filteredFriends}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContainer,
            filteredFriends.length === 0 && { flex: 1 }
          ]}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={['#4A6AFF']}
              tintColor="#4A6AFF"
            />
          }
        />
        
        {renderAddFriendModal()}
        {renderUsernameModal()}
        {renderFriendRequestsModal()}
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    alignItems: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginRight: 12,
    elevation: 2,
    shadowColor: '#718096',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#2D3748',
  },
  addButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4A6AFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#4A6AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  friendItem: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#718096',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  friendCardGradient: {
    borderRadius: 16,
  },
  friendContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
  },
  onlineIndicator: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: 'white',
    bottom: 0,
    right: 0,
  },
  friendActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  friendInfo: {
    marginLeft: 2,
  },
  nameAndUsername: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  friendName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2C3E50',
    marginRight: 8,
  },
  usernameText: {
    fontSize: 14,
    color: '#7F8C8D',
  },
  friendEmail: {
    fontSize: 14,
    color: '#7F8C8D',
    marginBottom: 8,
  },
  friendDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 4,
  },
  detailText: {
    fontSize: 13,
    color: '#7F8C8D',
    marginLeft: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },  loadingText: {
    marginTop: 8,
    fontSize: 16,
    color: '#4A6AFF',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
    flex: 1,
  },
  emptyStateIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#4A6AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  emptyStateTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2C3E50',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 22,
  },
  emptyStateButton: {
    backgroundColor: '#4A6AFF',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#4A6AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyStateButtonGradient: {
    borderRadius: 12,
    shadowColor: '#4A6AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    minHeight: 350,
  },
  modalGradient: {
    padding: 20,
    paddingBottom: 34,
  },
  modalHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2C3E50',
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(74, 106, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formContainer: {
    marginBottom: 28,
  },
  formLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  formLabel: {
    fontSize: 16,
    color: '#4A6AFF',
    fontWeight: '500',
    marginLeft: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 18,
  },
  formInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#2C3E50',
  },
  toggleSearchModeButton: {
    padding: 8,
  },
  gradientButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  disabledGradientButton: {
    opacity: 0.6,
  },
  submitButton: {
    paddingVertical: 15,
    alignItems: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    color: '#95A5A6',
    paddingHorizontal: 16,
    fontSize: 14,
  },
  alternativeOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  alternativeOption: {
    alignItems: 'center',
    width: '40%',
  },
  optionIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(74, 106, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  optionText: {
    fontSize: 14,
    color: '#4A6AFF',
    fontWeight: '500',
  },
  loadingIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#4A6AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  searchTypeContainer: {
    marginBottom: 20,
  },
  searchTypeLabel: {
    fontSize: 14,
    color: '#4A5568',
    marginBottom: 10,
  },
  searchTypeButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  searchTypeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
    backgroundColor: '#EDF2F7',
  },
  searchTypeButtonActive: {
    backgroundColor: '#4A6AFF',
  },
  searchTypeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4A5568',
  },
  searchTypeTextActive: {
    color: '#FFFFFF',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  searchResultsContainer: {
    marginTop: 10,
  },
  searchResultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 10,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#718096',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchResultAvatarContainer: {
    marginRight: 12,
  },
  searchResultAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  searchResultAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'white',
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 4,
  },
  searchResultEmail: {
    fontSize: 14,
    color: '#718096',
  },
  addUserButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#4A6AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noResultsContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  noResultsText: {
    fontSize: 16,
    color: '#4A5568',
    textAlign: 'center',
    marginBottom: 8,
  },
  noResultsSubText: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#FF4A4A',
    marginTop: 8,
  },
  successText: {
    fontSize: 14,
    color: '#4CAF50',
    marginTop: 8,
  },
  usernameSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    shadowColor: '#718096',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  usernameContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  usernameIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EBF4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  usernameTextContainer: {
    flex: 1,
  },
  setUsernameText: {
    fontSize: 14,
    color: '#4A5568',
  },
  activeUsernameContainer: {
    flexDirection: 'column',
  },
  activeUsernameLabel: {
    fontSize: 12,
    color: '#718096',
    marginBottom: 2,
  },
  activeUsername: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
  },
  usernameArrowContainer: {
    marginLeft: 8,
  },
  usernameHelpText: {
    fontSize: 12,
    color: '#718096',
    marginTop: 8,
    marginBottom: 16,
    textAlign: 'center',
  },
  searchResultDetailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  searchResultUsername: {
    fontSize: 14,
    color: '#4A6AFF',
    marginRight: 8,
  },
  inputError: {
    borderColor: '#FF4A4A',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  friendRequestModalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 10,
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  requestSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 5,
  },
  emptyRequestContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFC',
    borderRadius: 16,
    padding: 24,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },
  noRequestsSubtext: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    marginTop: 5,
  },
  requestSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D3748',
    marginLeft: 8,
  },
  requestItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFC',
    borderRadius: 16,
    marginBottom: 10,
    shadowColor: '#2D3748',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#EDF2F7',
  },
  requestUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  requestUserImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  requestUserName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
  },
  requestUserUsername: {
    fontSize: 14,
    color: '#718096',
    marginTop: 2,
  },
  requestActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4A6AFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginRight: 8,
    shadowColor: '#4A6AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  rejectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F4FF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rejectButtonText: {
    color: '#4A6AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  cancelButtonText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '600',
  },
  noRequestsText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#718096',
    textAlign: 'center',
    marginTop: 10,
  },
});

export default FriendsScreen;
