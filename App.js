import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";

/* ============================================================
   GYAN AI
   Native React Native / Expo App
   Backend:
   https://gyan-ai-ef7h.onrender.com
   ============================================================ */

const API_BASE = "https://gyan-ai-ef7h.onrender.com";

const API = {
  register: "/api/register",
  login: "/api/login",
  logout: "/api/logout",

  chat: "/api/chat",

  history: "/api/history",
  historyChat: (id) => `/api/history/${encodeURIComponent(id)}`,

  memory: "/api/memory",
  memoryItem: (id) => `/api/memory/${encodeURIComponent(id)}`,

  webSearch: "/api/web-search",
  youtubeSearch: "/api/youtube-search",
  imageEdit: "/api/image-edit",
};

const STORAGE_TOKEN = "@gyan_ai_token";
const STORAGE_USER = "@gyan_ai_user";

const COLORS = {
  bg: "#0b0f14",
  panel: "#111820",
  panel2: "#18212b",
  border: "#293542",
  text: "#f2f5f7",
  muted: "#8d9aa8",
  green: "#2ea043",
  green2: "#238636",
  red: "#da3633",
  blue: "#388bfd",
  white: "#ffffff",
};

/* ============================================================
   HELPERS
   ============================================================ */

function getConversationId(item) {
  if (!item) return null;

  return (
    item.id ??
    item.conversation_id ??
    item.conversationId ??
    item.conversation?.id ??
    item.uuid ??
    null
  );
}

function sameId(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

function makeHeaders(token) {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {}),
  };
}

async function apiRequest(path, options = {}, token = null) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...makeHeaders(token),
      ...(options.headers || {}),
    },
  });

  let data = null;

  try {
    const text = await response.text();

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = {
          raw: text,
        };
      }
    }
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        `Server error: ${response.status}`
    );
  }

  return data;
}

/* ============================================================
   APP
   ============================================================ */

export default function App() {
  /* ---------------- AUTH ---------------- */

  const [screen, setScreen] = useState("loading");

  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);

  const [authMode, setAuthMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  /* ---------------- CHAT ---------------- */

  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);

  /* ---------------- HISTORY ---------------- */

  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  /* ---------------- MEMORY ---------------- */

  const [memory, setMemory] = useState([]);
  const [loadingMemory, setLoadingMemory] = useState(false);

  /* ---------------- DELETE ---------------- */

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  /* ---------------- PLUS ---------------- */

  const [showPlus, setShowPlus] = useState(false);

  /* ---------------- FILES ---------------- */

  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  /* ---------------- SEARCH ---------------- */

  const [searchMode, setSearchMode] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  /* ============================================================
     START APP
     ============================================================ */

  useEffect(() => {
    restoreSession();
  }, []);

  async function restoreSession() {
    try {
      const savedToken = await AsyncStorage.getItem(
        STORAGE_TOKEN
      );

      const savedUser = await AsyncStorage.getItem(
        STORAGE_USER
      );

      if (savedToken && savedUser) {
        const parsedUser = JSON.parse(savedUser);

        setToken(savedToken);
        setUser(parsedUser);
        setScreen("chat");
      } else {
        setScreen("auth");
      }
    } catch (error) {
      console.log("RESTORE SESSION ERROR:", error);
      setScreen("auth");
    }
  }

  /* ============================================================
     LOGIN / REGISTER
     ============================================================ */

  async function handleAuth() {
    const cleanUsername = username.trim();

    if (!cleanUsername || !password) {
      Alert.alert(
        "Gyan AI",
        "Username और password डालें।"
      );
      return;
    }

    setAuthLoading(true);

    try {
      const endpoint =
        authMode === "login"
          ? API.login
          : API.register;

      const data = await apiRequest(
        endpoint,
        {
          method: "POST",
          body: JSON.stringify({
            username: cleanUsername,
            password,
          }),
        }
      );

      if (!data?.ok) {
        throw new Error(
          data?.error ||
            data?.message ||
            "Authentication failed."
        );
      }

      const account =
        data.user ||
        data.account ||
        data;

      const newToken =
        data.token ||
        account?.token;

      const newUser = {
        id:
          account?.user_id ||
          account?.id ||
          data?.user_id ||
          null,
        username:
          account?.username ||
          data?.username ||
          cleanUsername,
      };

      if (!newToken) {
        throw new Error(
          "Server ने login token नहीं भेजा।"
        );
      }

      await AsyncStorage.setItem(
        STORAGE_TOKEN,
        newToken
      );

      await AsyncStorage.setItem(
        STORAGE_USER,
        JSON.stringify(newUser)
      );

      setToken(newToken);
      setUser(newUser);

      setUsername("");
      setPassword("");

      setConversationId(null);
      setMessages([]);

      setScreen("chat");
    } catch (error) {
      console.log("AUTH ERROR:", error);

      Alert.alert(
        authMode === "login"
          ? "Login Error"
          : "Register Error",
        error?.message ||
          "कुछ गलत हो गया।"
      );
    } finally {
      setAuthLoading(false);
    }
  }

  async function logout() {
    try {
      if (token) {
        await apiRequest(
          API.logout,
          {
            method: "POST",
          },
          token
        );
      }
    } catch (error) {
      console.log("LOGOUT API ERROR:", error);
    }

    await AsyncStorage.removeItem(STORAGE_TOKEN);
    await AsyncStorage.removeItem(STORAGE_USER);

    setToken(null);
    setUser(null);
    setConversationId(null);
    setMessages([]);
    setHistory([]);
    setMemory([]);
    setScreen("auth");
  }

  /* ============================================================
     CHAT
     ============================================================ */

  function startNewChat() {
    setConversationId(null);
    setMessages([]);
    setMessageText("");
    setScreen("chat");
  }

  async function sendMessage() {
    const text = messageText.trim();

    if (!text || sending || !token) {
      return;
    }

    setMessageText("");
    setSending(true);

    const temporaryUserMessage = {
      id: `local-user-${Date.now()}`,
      role: "user",
      content: text,
    };

    setMessages((prev) => [
      ...prev,
      temporaryUserMessage,
    ]);

    try {
      const data = await apiRequest(
        API.chat,
        {
          method: "POST",
          body: JSON.stringify({
            message: text,
            conversation_id:
              conversationId || null,
          }),
        },
        token
      );

      if (data?.ok === false) {
        throw new Error(
          data?.error ||
            data?.message ||
            "Chat request failed."
        );
      }

      const newConversationId =
        data?.conversation_id ||
        data?.conversationId ||
        conversationId ||
        null;

      if (newConversationId) {
        setConversationId(newConversationId);
      }

      let serverMessages = [];

      if (Array.isArray(data?.history)) {
        serverMessages = data.history;
      }

      if (serverMessages.length > 0) {
        setMessages(
          serverMessages.map((item, index) => ({
            id:
              item?.id ||
              `${index}-${Date.now()}`,
            role:
              item?.role ||
              (item?.user
                ? "user"
                : "assistant"),
            content:
              item?.content ||
              item?.message ||
              "",
          }))
        );
      } else if (data?.answer) {
        const assistantMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: String(data.answer),
        };

        setMessages((prev) => [
          ...prev,
          assistantMessage,
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content:
              "AI से कोई उत्तर नहीं मिला।",
          },
        ]);
      }

      loadHistory();
    } catch (error) {
      console.log("CHAT ERROR:", error);

      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content:
            error?.message ||
            "Chat request failed.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  /* ============================================================
     HISTORY
     ============================================================ */

  async function loadHistory() {
    if (!token) return;

    setLoadingHistory(true);

    try {
      const data = await apiRequest(
        API.history,
        {
          method: "GET",
        },
        token
      );

      if (data?.ok === false) {
        throw new Error(
          data?.error ||
            "History load failed."
        );
      }

      const list =
        Array.isArray(data?.conversations)
          ? data.conversations
          : Array.isArray(data?.history)
          ? data.history
          : Array.isArray(data)
          ? data
          : [];

      setHistory(list);
    } catch (error) {
      console.log("HISTORY ERROR:", error);

      Alert.alert(
        "History",
        error?.message ||
          "History load नहीं हो सकी।"
      );
    } finally {
      setLoadingHistory(false);
    }
  }

  async function openHistoryChat(id) {
    if (!token || !id) {
      Alert.alert(
        "Chat",
        "इस chat की ID नहीं मिली।"
      );
      return;
    }

    try {
      const data = await apiRequest(
        API.historyChat(id),
        {
          method: "GET",
        },
        token
      );

      if (data?.ok === false) {
        throw new Error(
          data?.error ||
            "Conversation load failed."
        );
      }

      const chatMessages =
        Array.isArray(data?.messages)
          ? data.messages
          : Array.isArray(data?.history)
          ? data.history
          : [];

      setConversationId(id);
      setMessages(chatMessages);
      setScreen("chat");
    } catch (error) {
      console.log(
        "OPEN HISTORY ERROR:",
        error
      );

      Alert.alert(
        "Chat",
        error?.message ||
          "Conversation load नहीं हो सकी।"
      );
    }
  }

  /* ============================================================
     DELETE HISTORY
     ============================================================ */

  function requestDeleteHistory(item) {
    const id = getConversationId(item);

    if (!id) {
      Alert.alert(
        "Delete Chat",
        "इस chat की ID नहीं मिली। इसलिए इसे delete नहीं किया जा सकता।"
      );
      return;
    }

    setDeleteTarget({
      id: String(id),
      title:
        item?.title ||
        item?.name ||
        "New Chat",
    });
  }

  async function confirmDeleteHistory() {
    if (
      !deleteTarget?.id ||
      deleteLoading ||
      !token
    ) {
      return;
    }

    const id = deleteTarget.id;

    setDeleteLoading(true);

    try {
      const data = await apiRequest(
        API.historyChat(id),
        {
          method: "DELETE",
        },
        token
      );

      /*
       * Backend can return:
       * {ok:true}
       * {success:true}
       * empty response
       *
       * Only explicit ok:false is treated as failure.
       */

      if (data?.ok === false) {
        throw new Error(
          data?.error ||
            data?.message ||
            "Chat delete failed."
        );
      }

      if (data?.success === false) {
        throw new Error(
          data?.error ||
            data?.message ||
            "Chat delete failed."
        );
      }

      setHistory((previous) =>
        previous.filter((item) => {
          const itemId =
            getConversationId(item);

          return !sameId(itemId, id);
        })
      );

      if (sameId(conversationId, id)) {
        setConversationId(null);
        setMessages([]);
      }

      setDeleteTarget(null);

      Alert.alert(
        "Gyan AI",
        "Chat successfully delete हो गई।"
      );
    } catch (error) {
      console.log(
        "DELETE HISTORY ERROR:",
        error
      );

      Alert.alert(
        "Delete Error",
        error?.message ||
          "Chat delete नहीं हो सकी।"
      );
    } finally {
      setDeleteLoading(false);
    }
  }

  /* ============================================================
     MEMORY
     ============================================================ */

  async function loadMemory() {
    if (!token) return;

    setLoadingMemory(true);

    try {
      const data = await apiRequest(
        API.memory,
        {
          method: "GET",
        },
        token
      );

      if (data?.ok === false) {
        throw new Error(
          data?.error ||
            "Memory load failed."
        );
      }

      const list =
        Array.isArray(data?.memory)
          ? data.memory
          : Array.isArray(data?.memories)
          ? data.memories
          : Array.isArray(data)
          ? data
          : [];

      setMemory(list);
    } catch (error) {
      console.log(
        "MEMORY ERROR:",
        error
      );

      Alert.alert(
        "Memory",
        error?.message ||
          "Memory load नहीं हो सकी।"
      );
    } finally {
      setLoadingMemory(false);
    }
  }

  async function deleteMemory(id) {
    if (!token || !id) return;

    try {
      const data = await apiRequest(
        API.memoryItem(id),
        {
          method: "DELETE",
        },
        token
      );

      if (data?.ok === false) {
        throw new Error(
          data?.error ||
            "Memory delete failed."
        );
      }

      setMemory((previous) =>
        previous.filter(
          (item) =>
            !sameId(
              item?.id,
              id
            )
        )
      );
    } catch (error) {
      Alert.alert(
        "Memory",
        error?.message ||
          "Memory delete नहीं हो सकी।"
      );
    }
  }

  async function clearMemory() {
    if (!token) return;

    Alert.alert(
      "Clear Memory",
      "क्या आप अपनी पूरी memory delete करना चाहते हैं?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              const data =
                await apiRequest(
                  API.memory,
                  {
                    method: "DELETE",
                  },
                  token
                );

              if (data?.ok === false) {
                throw new Error(
                  data?.error ||
                    "Memory clear failed."
                );
              }

              setMemory([]);

              Alert.alert(
                "Gyan AI",
                "Memory clear हो गई।"
              );
            } catch (error) {
              Alert.alert(
                "Memory",
                error?.message ||
                  "Memory clear नहीं हो सकी।"
              );
            }
          },
        },
      ]
    );
  }

  /* ============================================================
     IMAGE / FILE
     ============================================================ */

  async function pickGallery() {
    try {
      const result =
        await ImagePicker.launchImageLibraryAsync(
          {
            mediaTypes:
              ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 1,
          }
        );

      if (!result.canceled) {
        const asset =
          result.assets?.[0];

        if (asset) {
          setSelectedImage(asset);
          setShowPlus(false);
        }
      }
    } catch (error) {
      Alert.alert(
        "Gallery",
        "Gallery open नहीं हो सकी।"
      );
    }
  }

  async function takePhoto() {
    try {
      const permission =
        await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Camera",
          "Camera permission चाहिए।"
        );
        return;
      }

      const result =
        await ImagePicker.launchCameraAsync(
          {
            allowsEditing: false,
            quality: 1,
          }
        );

      if (!result.canceled) {
        const asset =
          result.assets?.[0];

        if (asset) {
          setSelectedImage(asset);
          setShowPlus(false);
        }
      }
    } catch (error) {
      Alert.alert(
        "Camera",
        "Camera open नहीं हो सका।"
      );
    }
  }

  async function pickFile() {
    try {
      const result =
        await DocumentPicker.getDocumentAsync(
          {
            copyToCacheDirectory: true,
            multiple: false,
          }
        );

      if (!result.canceled) {
        const file =
          result.assets?.[0];

        if (file) {
          setSelectedFile(file);
          setShowPlus(false);
        }
      }
    } catch (error) {
      Alert.alert(
        "File",
        "File select नहीं हो सकी।"
      );
    }
  }

  /* ============================================================
     SEARCH
     ============================================================ */

  function openWebSearch() {
    setShowPlus(false);
    setSearchMode("web");
    setSearchText("");
    setSearchResults([]);
  }

  function openYoutubeSearch() {
    setShowPlus(false);
    setSearchMode("youtube");
    setSearchText("");
    setSearchResults([]);
  }

  async function performSearch() {
    const query = searchText.trim();

    if (!query || searchLoading) {
      return;
    }

    setSearchLoading(true);
    setSearchResults([]);

    try {
      const endpoint =
        searchMode === "youtube"
          ? API.youtubeSearch
          : API.webSearch;

      let data = null;

      try {
        data = await apiRequest(
          endpoint,
          {
            method: "POST",
            body: JSON.stringify({
              query,
              search: query,
              q: query,
            }),
          },
          token
        );
      } catch (backendError) {
        console.log(
          "SEARCH BACKEND ERROR:",
          backendError
        );
      }

      const results =
        Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data?.items)
          ? data.items
          : [];

      if (results.length > 0) {
        setSearchResults(results);
      } else {
        /*
         * Backend endpoint available न होने पर
         * browser search खुल जाएगा।
         */

        const encoded =
          encodeURIComponent(query);

        const url =
          searchMode === "youtube"
            ? `https://www.youtube.com/results?search_query=${encoded}`
            : `https://www.google.com/search?q=${encoded}`;

        await Linking.openURL(url);

        setSearchResults([]);
      }
    } catch (error) {
      Alert.alert(
        "Search",
        error?.message ||
          "Search नहीं हो सकी।"
      );
    } finally {
      setSearchLoading(false);
    }
  }

  /* ============================================================
     IMAGE EDIT
     ============================================================ */

  function imageEdit() {
    setShowPlus(false);

    Alert.alert(
      "Image Edit",
      "Image Edit backend endpoint उपलब्ध होने पर यहाँ से connect होगा।"
    );
  }

  /* ============================================================
     LOADING SCREEN
     ============================================================ */

  if (screen === "loading") {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={COLORS.bg}
        />

        <View style={styles.center}>
          <Text style={styles.logoLarge}>
            Gyan AI
          </Text>

          <ActivityIndicator
            size="large"
            color={COLORS.green}
            style={{ marginTop: 20 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  /* ============================================================
     AUTH SCREEN
     ============================================================ */

  if (screen === "auth") {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={COLORS.bg}
        />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={
            Platform.OS === "ios"
              ? "padding"
              : undefined
          }
        >
          <ScrollView
            contentContainerStyle={
              styles.authContainer
            }
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.authLogo}>
              <Text style={styles.logoLarge}>
                Gyan AI
              </Text>

              <Text style={styles.authSubtitle}>
                Your AI Assistant
              </Text>
            </View>

            <View style={styles.authCard}>
              <Text style={styles.authTitle}>
                {authMode === "login"
                  ? "Welcome Back"
                  : "Create Account"}
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor={
                  COLORS.muted
                }
                autoCapitalize="none"
                value={username}
                onChangeText={setUsername}
              />

              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={
                  COLORS.muted
                }
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleAuth}
                disabled={authLoading}
              >
                {authLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text
                    style={
                      styles.primaryButtonText
                    }
                  >
                    {authMode === "login"
                      ? "Login"
                      : "Register"}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.switchAuth}
                onPress={() => {
                  setAuthMode(
                    authMode === "login"
                      ? "register"
                      : "login"
                  );
                }}
              >
                <Text
                  style={styles.switchAuthText}
                >
                  {authMode === "login"
                    ? "Create new account"
                    : "Already have an account? Login"}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  /* ============================================================
     HISTORY SCREEN
     ============================================================ */

  if (screen === "history") {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={COLORS.bg}
        />

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() =>
              setScreen("chat")
            }
          >
            <Text style={styles.headerButtonText}>
              ←
            </Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            Chat History
          </Text>

          <TouchableOpacity
            style={styles.headerButton}
            onPress={loadHistory}
          >
            <Text style={styles.headerButtonText}>
              ↻
            </Text>
          </TouchableOpacity>
        </View>

        {loadingHistory ? (
          <View style={styles.center}>
            <ActivityIndicator
              size="large"
              color={COLORS.green}
            />
          </View>
        ) : history.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyIcon}>
              💬
            </Text>

            <Text style={styles.emptyTitle}>
              No chats yet
            </Text>

            <Text style={styles.emptyText}>
              आपकी पुरानी chats यहाँ दिखाई देंगी।
            </Text>

            <TouchableOpacity
              style={styles.primaryButtonSmall}
              onPress={startNewChat}
            >
              <Text
                style={
                  styles.primaryButtonText
                }
              >
                New Chat
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={history}
            keyExtractor={(item, index) => {
              const id =
                getConversationId(item);

              return id
                ? String(id)
                : `history-${index}`;
            }}
            contentContainerStyle={
              styles.historyList
            }
            renderItem={({ item }) => {
              const id =
                getConversationId(item);

              return (
                <View style={styles.historyCard}>
                  <TouchableOpacity
                    style={styles.historyMain}
                    activeOpacity={0.7}
                    disabled={!id}
                    onPress={() => {
                      if (id) {
                        openHistoryChat(id);
                      }
                    }}
                  >
                    <Text
                      style={
                        styles.historyTitle
                      }
                      numberOfLines={2}
                    >
                      {item?.title ||
                        item?.name ||
                        "New Chat"}
                    </Text>

                    <Text
                      style={
                        styles.historyDate
                      }
                      numberOfLines={1}
                    >
                      {item?.updated_at ||
                        item?.created_at ||
                        ""}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.deleteButton}
                    activeOpacity={0.7}
                    hitSlop={{
                      top: 12,
                      bottom: 12,
                      left: 12,
                      right: 12,
                    }}
                    accessibilityLabel="Delete chat"
                    onPress={() =>
                      requestDeleteHistory(
                        item
                      )
                    }
                  >
                    <Text
                      style={
                        styles.deleteText
                      }
                    >
                      🗑️
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        )}

        {/* ====================================================
            DELETE CONFIRMATION MODAL
            ==================================================== */}

        <Modal
          visible={
            deleteTarget !== null
          }
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!deleteLoading) {
              setDeleteTarget(null);
            }
          }}
        >
          <View
            style={
              styles.deleteModalOverlay
            }
          >
            <View
              style={styles.deleteModal}
            >
              <Text
                style={
                  styles.deleteModalIcon
                }
              >
                🗑️
              </Text>

              <Text
                style={
                  styles.deleteModalTitle
                }
              >
                Delete Chat?
              </Text>

              <Text
                style={
                  styles.deleteModalText
                }
              >
                क्या आप इस chat को permanently
                delete करना चाहते हैं?
              </Text>

              {deleteTarget?.title ? (
                <Text
                  style={
                    styles.deleteModalChatTitle
                  }
                  numberOfLines={2}
                >
                  "{deleteTarget.title}"
                </Text>
              ) : null}

              <View
                style={
                  styles.deleteModalButtons
                }
              >
                <TouchableOpacity
                  style={
                    styles.cancelDeleteButton
                  }
                  disabled={deleteLoading}
                  activeOpacity={0.7}
                  onPress={() =>
                    setDeleteTarget(null)
                  }
                >
                  <Text
                    style={
                      styles.cancelDeleteText
                    }
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={
                    styles.confirmDeleteButton
                  }
                  disabled={deleteLoading}
                  activeOpacity={0.7}
                  onPress={
                    confirmDeleteHistory
                  }
                >
                  {deleteLoading ? (
                    <ActivityIndicator
                      color="#fff"
                    />
                  ) : (
                    <Text
                      style={
                        styles.confirmDeleteText
                      }
                    >
                      Delete
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  /* ============================================================
     MEMORY SCREEN
     ============================================================ */

  if (screen === "memory") {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={COLORS.bg}
        />

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() =>
              setScreen("chat")
            }
          >
            <Text style={styles.headerButtonText}>
              ←
            </Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            Memory
          </Text>

          <TouchableOpacity
            style={styles.headerButton}
            onPress={loadMemory}
          >
            <Text style={styles.headerButtonText}>
              ↻
            </Text>
          </TouchableOpacity>
        </View>

        {loadingMemory ? (
          <View style={styles.center}>
            <ActivityIndicator
              size="large"
              color={COLORS.green}
            />
          </View>
        ) : memory.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyIcon}>
              🧠
            </Text>

            <Text style={styles.emptyTitle}>
              No memory yet
            </Text>

            <Text style={styles.emptyText}>
              Gyan AI आपकी saved memories यहाँ दिखाएगा।
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={
              styles.memoryList
            }
          >
            {memory.map((item, index) => (
              <View
                style={styles.memoryCard}
                key={
                  item?.id
                    ? String(item.id)
                    : `memory-${index}`
                }
              >
                <View
                  style={{
                    flex: 1,
                  }}
                >
                  <Text
                    style={
                      styles.memoryKey
                    }
                  >
                    {item?.memory_key ||
                      item?.key ||
                      "Memory"}
                  </Text>

                  <Text
                    style={
                      styles.memoryValue
                    }
                  >
                    {item?.memory_value ||
                      item?.value ||
                      ""}
                  </Text>
                </View>

                {item?.id ? (
                  <TouchableOpacity
                    style={
                      styles.memoryDelete
                    }
                    onPress={() =>
                      deleteMemory(
                        item.id
                      )
                    }
                  >
                    <Text
                      style={
                        styles.deleteText
                      }
                    >
                      🗑️
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
          </ScrollView>
        )}

        <View
          style={styles.memoryBottom}
        >
          <TouchableOpacity
            style={styles.clearMemoryButton}
            onPress={clearMemory}
          >
            <Text
              style={
                styles.clearMemoryText
              }
            >
              Clear All Memory
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  /* ============================================================
     SETTINGS SCREEN
     ============================================================ */

  if (screen === "settings") {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={COLORS.bg}
        />

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() =>
              setScreen("chat")
            }
          >
            <Text style={styles.headerButtonText}>
              ←
            </Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            Settings
          </Text>

          <View style={styles.headerButton} />
        </View>

        <ScrollView
          contentContainerStyle={
            styles.settingsList
          }
        >
          <View style={styles.profileCard}>
            <View
              style={styles.profileCircle}
            >
              <Text
                style={
                  styles.profileLetter
                }
              >
                {(user?.username || "G")
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            </View>

            <View>
              <Text
                style={
                  styles.profileName
                }
              >
                {user?.username ||
                  "Gyan User"}
              </Text>

              <Text
                style={
                  styles.profileSub
                }
              >
                Gyan AI Account
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.settingCard}
            onPress={() => {
              setScreen("history");
              loadHistory();
            }}
          >
            <Text style={styles.settingIcon}>
              🕘
            </Text>

            <View style={styles.settingInfo}>
              <Text
                style={
                  styles.settingTitle
                }
              >
                Chat History
              </Text>

              <Text
                style={
                  styles.settingSub
                }
              >
                अपनी सभी पुरानी chats देखें
              </Text>
            </View>

            <Text
              style={
                styles.settingArrow
              }
            >
              ›
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingCard}
            onPress={() => {
              setScreen("memory");
              loadMemory();
            }}
          >
            <Text style={styles.settingIcon}>
              🧠
            </Text>

            <View style={styles.settingInfo}>
              <Text
                style={
                  styles.settingTitle
                }
              >
                Long-Term Memory
              </Text>

              <Text
                style={
                  styles.settingSub
                }
              >
                Gyan AI की saved memories देखें
              </Text>
            </View>

            <Text
              style={
                styles.settingArrow
              }
            >
              ›
            </Text>
          </TouchableOpacity>

          <View style={styles.settingCard}>
            <Text style={styles.settingIcon}>
              🌙
            </Text>

            <View style={styles.settingInfo}>
              <Text
                style={
                  styles.settingTitle
                }
              >
                Dark Mode
              </Text>

              <Text
                style={
                  styles.settingSub
                }
              >
                Dark interface enabled
              </Text>
            </View>

            <Text
              style={
                styles.enabledText
              }
            >
              ON
            </Text>
          </View>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={logout}
          >
            <Text
              style={
                styles.logoutButtonText
              }
            >
              Logout
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ============================================================
     SEARCH SCREEN
     ============================================================ */

  if (searchMode) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={COLORS.bg}
        />

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() =>
              setSearchMode(null)
            }
          >
            <Text style={styles.headerButtonText}>
              ←
            </Text>
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            {searchMode === "youtube"
              ? "YouTube Search"
              : "Web Search"}
          </Text>

          <View style={styles.headerButton} />
        </View>

        <View
          style={styles.searchContainer}
        >
          <TextInput
            style={styles.searchInput}
            placeholder={
              searchMode === "youtube"
                ? "Search YouTube..."
                : "Search the web..."
            }
            placeholderTextColor={
              COLORS.muted
            }
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={
              performSearch
            }
            returnKeyType="search"
          />

          <TouchableOpacity
            style={styles.searchButton}
            onPress={performSearch}
            disabled={searchLoading}
          >
            {searchLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                style={
                  styles.searchButtonText
                }
              >
                Search
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={
            styles.searchResults
          }
        >
          {searchResults.map(
            (item, index) => {
              const title =
                item?.title ||
                item?.name ||
                `Result ${index + 1}`;

              const url =
                item?.url ||
                item?.link ||
                item?.webpage_url;

              const thumbnail =
                item?.thumbnail ||
                item?.thumbnail_url ||
                item?.image;

              return (
                <TouchableOpacity
                  key={`result-${index}`}
                  style={
                    styles.resultCard
                  }
                  onPress={() => {
                    if (url) {
                      Linking.openURL(url);
                    }
                  }}
                >
                  {thumbnail ? (
                    <Image
                      source={{
                        uri: thumbnail,
                      }}
                      style={
                        styles.resultImage
                      }
                    />
                  ) : null}

                  <Text
                    style={
                      styles.resultTitle
                    }
                  >
                    {title}
                  </Text>

                  {item?.description ? (
                    <Text
                      style={
                        styles.resultDescription
                      }
                      numberOfLines={3}
                    >
                      {item.description}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              );
            }
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ============================================================
     CHAT SCREEN
     ============================================================ */

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.bg}
      />

      <View style={styles.chatHeader}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={startNewChat}
        >
          <Text style={styles.headerButtonText}>
            +
          </Text>
        </TouchableOpacity>

        <View style={styles.chatHeaderCenter}>
          <Text style={styles.chatHeaderTitle}>
            Gyan AI
          </Text>

          <Text
            style={
              styles.chatHeaderSubtitle
            }
          >
            {user?.username ||
              "AI Assistant"}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => {
            setScreen("history");
            loadHistory();
          }}
        >
          <Text style={styles.headerButtonText}>
            ☰
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        {messages.length === 0 ? (
          <View style={styles.welcome}>
            <Text style={styles.welcomeLogo}>
              G
            </Text>

            <Text style={styles.welcomeTitle}>
              How can I help you?
            </Text>

            <Text style={styles.welcomeText}>
              Ask anything. Your chats and
              memories are connected to your
              Gyan AI account.
            </Text>
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(item, index) =>
              String(
                item?.id ||
                  `message-${index}`
              )
            }
            contentContainerStyle={
              styles.messagesList
            }
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const isUser =
                item?.role === "user";

              return (
                <View
                  style={[
                    styles.messageRow,
                    isUser
                      ? styles.userRow
                      : styles.assistantRow,
                  ]}
                >
                  <View
                    style={[
                      styles.messageBubble,
                      isUser
                        ? styles.userBubble
                        : styles.assistantBubble,
                    ]}
                  >
                    <Text
                      style={
                        styles.messageText
                      }
                    >
                      {String(
                        item?.content ||
                          item?.message ||
                          ""
                      )}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        {sending ? (
          <View
            style={
              styles.typingContainer
            }
          >
            <ActivityIndicator
              size="small"
              color={COLORS.green}
            />

            <Text
              style={
                styles.typingText
              }
            >
              Gyan AI is thinking...
            </Text>
          </View>
        ) : null}

        {selectedImage ? (
          <View
            style={
              styles.attachmentBar
            }
          >
            <Image
              source={{
                uri: selectedImage.uri,
              }}
              style={
                styles.attachmentImage
              }
            />

            <Text
              style={
                styles.attachmentText
              }
            >
              Image attached
            </Text>

            <TouchableOpacity
              onPress={() =>
                setSelectedImage(null)
              }
            >
              <Text
                style={
                  styles.removeAttachment
                }
              >
                ✕
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {selectedFile ? (
          <View
            style={
              styles.attachmentBar
            }
          >
            <Text
              style={
                styles.fileIcon
              }
            >
              📄
            </Text>

            <Text
              style={
                styles.attachmentText
              }
              numberOfLines={1}
            >
              {selectedFile.name ||
                "File attached"}
            </Text>

            <TouchableOpacity
              onPress={() =>
                setSelectedFile(null)
              }
            >
              <Text
                style={
                  styles.removeAttachment
                }
              >
                ✕
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.inputArea}>
          <TouchableOpacity
            style={styles.plusButton}
            onPress={() =>
              setShowPlus(
                !showPlus
              )
            }
          >
            <Text
              style={
                styles.plusButtonText
              }
            >
              +
            </Text>
          </TouchableOpacity>

          <TextInput
            style={styles.chatInput}
            placeholder="Message Gyan AI..."
            placeholderTextColor={
              COLORS.muted
            }
            value={messageText}
            onChangeText={setMessageText}
            multiline
            maxLength={10000}
            editable={!sending}
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              (!messageText.trim() ||
                sending) &&
                styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
            disabled={
              !messageText.trim() ||
              sending
            }
          >
            <Text
              style={
                styles.sendButtonText
              }
            >
              ↑
            </Text>
          </TouchableOpacity>
        </View>

        {showPlus ? (
          <View
            style={
              styles.plusMenu
            }
          >
            <TouchableOpacity
              style={styles.plusItem}
              onPress={takePhoto}
            >
              <Text
                style={
                  styles.plusIcon
                }
              >
                📷
              </Text>

              <Text
                style={
                  styles.plusItemText
                }
              >
                Camera
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.plusItem}
              onPress={pickGallery}
            >
              <Text
                style={
                  styles.plusIcon
                }
              >
                🖼️
              </Text>

              <Text
                style={
                  styles.plusItemText
                }
              >
                Gallery
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.plusItem}
              onPress={pickFile}
            >
              <Text
                style={
                  styles.plusIcon
                }
              >
                📄
              </Text>

              <Text
                style={
                  styles.plusItemText
                }
              >
                File
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.plusItem}
              onPress={imageEdit}
            >
              <Text
                style={
                  styles.plusIcon
                }
              >
                ✏️
              </Text>

              <Text
                style={
                  styles.plusItemText
                }
              >
                Image Edit
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.plusItem}
              onPress={openWebSearch}
            >
              <Text
                style={
                  styles.plusIcon
                }
              >
                🌐
              </Text>

              <Text
                style={
                  styles.plusItemText
                }
              >
                Web Search
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.plusItem}
              onPress={() => {
                setShowPlus(false);

                Linking.openURL(
                  "https://www.google.com"
                );
              }}
            >
              <Text
                style={
                  styles.plusIcon
                }
              >
                🔗
              </Text>

              <Text
                style={
                  styles.plusItemText
                }
              >
                Open Web
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.plusItem}
              onPress={openYoutubeSearch}
            >
              <Text
                style={
                  styles.plusIcon
                }
              >
                ▶️
              </Text>

              <Text
                style={
                  styles.plusItemText
                }
              >
                YouTube
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.bottomNavItem}
          onPress={() =>
            setScreen("chat")
          }
        >
          <Text
            style={
              styles.bottomNavIcon
            }
          >
            💬
          </Text>

          <Text
            style={
              styles.bottomNavText
            }
          >
            Chat
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomNavItem}
          onPress={() => {
            setScreen("history");
            loadHistory();
          }}
        >
          <Text
            style={
              styles.bottomNavIcon
            }
          >
            🕘
          </Text>

          <Text
            style={
              styles.bottomNavText
            }
          >
            History
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomNavItem}
          onPress={() => {
            setScreen("memory");
            loadMemory();
          }}
        >
          <Text
            style={
              styles.bottomNavIcon
            }
          >
            🧠
          </Text>

          <Text
            style={
              styles.bottomNavText
            }
          >
            Memory
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomNavItem}
          onPress={() =>
            setScreen("settings")
          }
        >
          <Text
            style={
              styles.bottomNavIcon
            }
          >
            ⚙️
          </Text>

          <Text
            style={
              styles.bottomNavText
            }
          >
            Settings
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/* ============================================================
   STYLES
   ============================================================ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  /* ---------------- AUTH ---------------- */

  authContainer: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },

  authLogo: {
    alignItems: "center",
    marginBottom: 35,
  },

  logoLarge: {
    color: COLORS.text,
    fontSize: 38,
    fontWeight: "900",
    letterSpacing: -1,
  },

  authSubtitle: {
    color: COLORS.muted,
    fontSize: 15,
    marginTop: 8,
  },

  authCard: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 20,
  },

  authTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 20,
  },

  input: {
    height: 52,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.panel2,
    color: COLORS.text,
    paddingHorizontal: 15,
    fontSize: 15,
    marginBottom: 13,
  },

  primaryButton: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: COLORS.green2,
    alignItems: "center",
    justifyContent: "center",
  },

  primaryButtonSmall: {
    marginTop: 20,
    paddingHorizontal: 25,
    minHeight: 45,
    borderRadius: 12,
    backgroundColor: COLORS.green2,
    alignItems: "center",
    justifyContent: "center",
  },

  primaryButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "800",
  },

  switchAuth: {
    paddingVertical: 18,
    alignItems: "center",
  },

  switchAuthText: {
    color: COLORS.blue,
    fontSize: 14,
    fontWeight: "600",
  },

  /* ---------------- HEADER ---------------- */

  header: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  headerButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },

  headerButtonText: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: "500",
  },

  headerTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },

  /* ---------------- CHAT HEADER ---------------- */

  chatHeader: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  chatHeaderCenter: {
    flex: 1,
    alignItems: "center",
  },

  chatHeaderTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
  },

  chatHeaderSubtitle: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 2,
  },

  /* ---------------- WELCOME ---------------- */

  welcome: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },

  welcomeLogo: {
    width: 65,
    height: 65,
    borderRadius: 20,
    backgroundColor: COLORS.green2,
    color: COLORS.white,
    fontSize: 38,
    fontWeight: "900",
    textAlign: "center",
    textAlignVertical: "center",
    overflow: "hidden",
  },

  welcomeTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "800",
    marginTop: 20,
    textAlign: "center",
  },

  welcomeText: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 10,
    maxWidth: 330,
  },

  /* ---------------- MESSAGES ---------------- */

  messagesList: {
    padding: 14,
    paddingBottom: 20,
  },

  messageRow: {
    width: "100%",
    marginVertical: 5,
  },

  userRow: {
    alignItems: "flex-end",
  },

  assistantRow: {
    alignItems: "flex-start",
  },

  messageBubble: {
    maxWidth: "88%",
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },

  userBubble: {
    backgroundColor: "#1f6feb",
    borderBottomRightRadius: 4,
  },

  assistantBubble: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomLeftRadius: 4,
  },

  messageText: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 22,
  },

  typingContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 7,
  },

  typingText: {
    color: COLORS.muted,
    marginLeft: 8,
    fontSize: 12,
  },

  /* ---------------- INPUT ---------------- */

  inputArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },

  plusButton: {
    width: 44,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.panel2,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 7,
  },

  plusButtonText: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "300",
  },

  chatInput: {
    flex: 1,
    minHeight: 48,
    maxHeight: 130,
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    color: COLORS.text,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 11,
    fontSize: 15,
  },

  sendButton: {
    width: 44,
    height: 48,
    borderRadius: 14,
    backgroundColor: COLORS.green2,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 7,
  },

  sendButtonDisabled: {
    opacity: 0.35,
  },

  sendButtonText: {
    color: COLORS.white,
    fontSize: 25,
    fontWeight: "800",
  },

  /* ---------------- PLUS MENU ---------------- */

  plusMenu: {
    position: "absolute",
    left: 10,
    bottom: 65,
    width: 190,
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingVertical: 7,
    elevation: 10,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },
  },

  plusItem: {
    minHeight: 45,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
  },

  plusIcon: {
    fontSize: 20,
    width: 34,
  },

  plusItemText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },

  /* ---------------- ATTACHMENTS ---------------- */

  attachmentBar: {
    minHeight: 55,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.panel,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 12,
  },

  attachmentImage: {
    width: 42,
    height: 42,
    borderRadius: 8,
    marginRight: 10,
  },

  fileIcon: {
    fontSize: 27,
    marginRight: 10,
  },

  attachmentText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
  },

  removeAttachment: {
    color: COLORS.muted,
    fontSize: 20,
    padding: 8,
  },

  /* ---------------- BOTTOM NAV ---------------- */

  bottomNav: {
    height: 62,
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.panel,
  },

  bottomNavItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  bottomNavIcon: {
    fontSize: 19,
  },

  bottomNavText: {
    color: COLORS.muted,
    fontSize: 10,
    marginTop: 3,
  },

  /* ---------------- HISTORY ---------------- */

  historyList: {
    padding: 12,
    paddingBottom: 30,
  },

  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    marginBottom: 10,
    minHeight: 70,
  },

  historyMain: {
    flex: 1,
    padding: 14,
  },

  historyTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
  },

  historyDate: {
    color: COLORS.muted,
    fontSize: 11,
    marginTop: 6,
  },

  deleteButton: {
    width: 54,
    height: 65,
    alignItems: "center",
    justifyContent: "center",
  },

  deleteText: {
    fontSize: 21,
  },

  /* ---------------- DELETE MODAL ---------------- */

  deleteModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  deleteModal: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: COLORS.panel,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  deleteModalIcon: {
    fontSize: 42,
    textAlign: "center",
    marginBottom: 10,
  },

  deleteModalTitle: {
    color: COLORS.text,
    fontSize: 21,
    fontWeight: "800",
    textAlign: "center",
  },

  deleteModalText: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 9,
  },

  deleteModalChatTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 12,
  },

  deleteModalButtons: {
    flexDirection: "row",
    marginTop: 22,
  },

  cancelDeleteButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: COLORS.panel2,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 5,
  },

  cancelDeleteText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
  },

  confirmDeleteButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: COLORS.red,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 5,
  },

  confirmDeleteText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

  /* ---------------- MEMORY ---------------- */

  memoryList: {
    padding: 12,
    paddingBottom: 100,
  },

  memoryCard: {
    flexDirection: "row",
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
  },

  memoryKey: {
    color: COLORS.blue,
    fontSize: 13,
    fontWeight: "800",
  },

  memoryValue: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },

  memoryDelete: {
    width: 45,
    alignItems: "center",
    justifyContent: "center",
  },

  memoryBottom: {
    position: "absolute",
    bottom: 12,
    left: 12,
    right: 12,
  },

  clearMemoryButton: {
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },

  clearMemoryText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
  },

  /* ---------------- SETTINGS ---------------- */

  settingsList: {
    padding: 14,
    paddingBottom: 30,
  },

  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },

  profileCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.green2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },

  profileLetter: {
    color: "#fff",
    fontSize: 23,
    fontWeight: "900",
  },

  profileName: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "800",
  },

  profileSub: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 3,
  },

  settingCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
  },

  settingIcon: {
    fontSize: 22,
    width: 40,
  },

  settingInfo: {
    flex: 1,
  },

  settingTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
  },

  settingSub: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: 4,
  },

  settingArrow: {
    color: COLORS.muted,
    fontSize: 28,
  },

  enabledText: {
    color: COLORS.green,
    fontSize: 11,
    fontWeight: "900",
  },

  logoutButton: {
    height: 50,
    borderRadius: 12,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },

  logoutButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },

  /* ---------------- SEARCH ---------------- */

  searchContainer: {
    flexDirection: "row",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  searchInput: {
    flex: 1,
    height: 48,
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    color: COLORS.text,
    paddingHorizontal: 13,
    fontSize: 14,
  },

  searchButton: {
    minWidth: 82,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.green2,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 7,
  },

  searchButtonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 13,
  },

  searchResults: {
    padding: 12,
    paddingBottom: 30,
  },

  resultCard: {
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 15,
    padding: 13,
    marginBottom: 10,
  },

  resultImage: {
    width: "100%",
    height: 170,
    borderRadius: 10,
    marginBottom: 10,
  },

  resultTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
  },

  resultDescription: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
  },

  /* ---------------- EMPTY ---------------- */

  emptyIcon: {
    fontSize: 45,
    marginBottom: 12,
  },

  emptyTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
  },

  emptyText: {
    color: COLORS.muted,
    fontSize: 13,
    textAlign: "center",
    marginTop: 7,
    maxWidth: 300,
  },
});