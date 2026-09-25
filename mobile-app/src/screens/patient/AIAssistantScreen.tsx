/**
 * AIAssistant Screen — Chat interface for asking about lab results.
 * Powered by Kimi K3 with medical safety constraints.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import Theme from '../../theme';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const SUGGESTED_QUESTIONS = [
  'What do my CBC results mean?',
  'Why is my hemoglobin low?',
  'What questions should I ask my doctor?',
  'Are my lipid panel results concerning?',
];

export default function AIAssistantScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your AI health assistant. I can help explain your lab results in plain language. What would you like to know?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // Simulate AI response (would call backend /api/ai/lab in production)
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Based on your recent CBC results, some values are slightly outside the typical range. This doesn't necessarily mean something is wrong — many factors can affect these numbers. I'd recommend discussing these results with your doctor, who can provide context based on your full medical history.\n\nRemember: I provide informational explanations only, not medical diagnoses or treatment advice.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiResponse]);
      setLoading(false);
    }, 2000);
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[styles.messageContainer, item.role === 'user' ? styles.userMessage : styles.aiMessage]}>
      {item.role === 'assistant' && <Text style={styles.aiAvatar}>🤖</Text>}
      <View style={[styles.messageBubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
        <Text style={[styles.messageText, item.role === 'user' ? styles.userText : styles.aiText]}>
          {item.content}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI Health Assistant</Text>
        <Text style={styles.headerSubtitle}>Powered by Kimi K3</Text>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
      />

      {/* Suggested questions */}
      {messages.length <= 1 && (
        <View style={styles.suggestions}>
          {SUGGESTED_QUESTIONS.map((q, i) => (
            <TouchableOpacity key={i} style={styles.suggestionChip} onPress={() => sendMessage(q)}>
              <Text style={styles.suggestionText}>{q}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Loading indicator */}
      {loading && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={Theme.Colors.primary} />
          <Text style={styles.loadingText}>AI is thinking...</Text>
        </View>
      )}

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.inputContainer}
      >
        <TextInput
          style={styles.input}
          placeholder="Ask about your results..."
          placeholderTextColor={Theme.Colors.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
          onPress={() => sendMessage(input)}
          disabled={!input.trim() || loading}
        >
          <Text style={styles.sendIcon}>→</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>

      {/* Disclaimer */}
      <Text style={styles.disclaimer}>
        AI responses are informational only, not medical advice. Always consult your doctor.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.Colors.background },
  header: { padding: Theme.Spacing.xl, borderBottomWidth: 1, borderBottomColor: Theme.Colors.borderLight, backgroundColor: Theme.Colors.surface },
  headerTitle: { fontSize: Theme.Typography.heading, fontWeight: Theme.Typography.bold, color: Theme.Colors.textPrimary },
  headerSubtitle: { fontSize: Theme.Typography.caption, color: Theme.Colors.primary, marginTop: 2 },
  messagesList: { padding: Theme.Spacing.xl, paddingBottom: Theme.Spacing.sm },
  messageContainer: { flexDirection: 'row', marginBottom: Theme.Spacing.lg, alignItems: 'flex-start' },
  userMessage: { justifyContent: 'flex-end' },
  aiMessage: { justifyContent: 'flex-start' },
  aiAvatar: { fontSize: 24, marginRight: Theme.Spacing.sm, marginTop: 4 },
  messageBubble: { maxWidth: '75%', borderRadius: Theme.BorderRadius.lg, padding: Theme.Spacing.lg },
  userBubble: { backgroundColor: Theme.Colors.primary },
  aiBubble: { backgroundColor: Theme.Colors.surface, ...Theme.Shadows.small },
  messageText: { fontSize: Theme.Typography.bodySmall, lineHeight: 20 },
  userText: { color: '#fff' },
  aiText: { color: Theme.Colors.textPrimary },
  suggestions: { padding: Theme.Spacing.lg, gap: Theme.Spacing.sm },
  suggestionChip: { backgroundColor: Theme.Colors.surfaceTint, borderRadius: Theme.BorderRadius.pill, paddingHorizontal: Theme.Spacing.lg, paddingVertical: Theme.Spacing.md, borderWidth: 1, borderColor: Theme.Colors.primary, alignSelf: 'flex-start' },
  suggestionText: { fontSize: Theme.Typography.bodySmall, color: Theme.Colors.primary, fontWeight: Theme.Typography.medium },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: Theme.Spacing.sm, gap: Theme.Spacing.sm },
  loadingText: { fontSize: Theme.Typography.caption, color: Theme.Colors.textSecondary },
  inputContainer: { flexDirection: 'row', alignItems: 'flex-end', padding: Theme.Spacing.lg, backgroundColor: Theme.Colors.surface, borderTopWidth: 1, borderTopColor: Theme.Colors.borderLight, gap: Theme.Spacing.sm },
  input: { flex: 1, backgroundColor: Theme.Colors.background, borderRadius: Theme.BorderRadius.lg, paddingHorizontal: Theme.Spacing.lg, paddingVertical: Theme.Spacing.md, fontSize: Theme.Typography.bodySmall, color: Theme.Colors.textPrimary, maxHeight: 100, borderWidth: 1, borderColor: Theme.Colors.border },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: Theme.Colors.primary, justifyContent: 'center', alignItems: 'center', ...Theme.Shadows.small },
  sendButtonDisabled: { backgroundColor: Theme.Colors.border },
  sendIcon: { fontSize: 20, color: '#fff', fontWeight: '700' },
  disclaimer: { fontSize: 10, color: Theme.Colors.textMuted, textAlign: 'center', padding: Theme.Spacing.sm, backgroundColor: Theme.Colors.surface },
});
