import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ComponentRef } from 'react';
import { useEffect } from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useCompactLayout } from '@/hooks/use-compact-layout';

type Message = { id: number; role: 'user' | 'assistant'; text: string };
const suggestions = [
  { icon: '✦', title: 'Make something', prompt: 'Help me brainstorm ideas for a new project.' },
  { icon: '↗', title: 'Learn something', prompt: 'Explain a tricky concept in simple words.' },
  { icon: '≡', title: 'Find the words', prompt: 'Help me write a thoughtful message.' },
];
function demoReply(prompt: string) {
  if (/brainstorm|project/i.test(prompt)) return 'Demo reply: Try a daily learning journal, a personal expense tracker, or a study planner. Pick one and describe who you want to help.\n\nThese are sample ideas. Live AI replies need the backend connection.';
  if (/explain|concept|learn/i.test(prompt)) return 'Demo reply: Start with a familiar analogy, walk through one example, and explain it in your own words.\n\nThis is a sample response. The AI backend is not connected yet.';
  if (/write|message/i.test(prompt)) return 'Demo reply: “Hey! I wanted to check in and see how you’re doing. Let me know when you have a moment to catch up.”\n\nThis is a sample message. Personalized AI writing needs the backend connection.';
  return 'Demo reply: Your message has been added to this conversation. This preview lets you try the chat interface; live AI responses are not connected yet.\n\nTry a starter prompt, or start a new chat.';
}
export default function HomeScreen() {
  const dark = useColorScheme() === 'dark';
  const compact = useCompactLayout();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [live, setLive] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const nextId = useRef(0);
  const c = dark
    ? { bg: '#111714', surface: '#1b241f', text: '#edf3ed', muted: '#a5b5aa', border: '#334039', accent: '#b6e7c3', ink: '#14251b' }
    : { bg: '#f7f8f2', surface: '#ffffff', text: '#24392e', muted: '#64756b', border: '#dce3d8', accent: '#244e3b', ink: '#ffffff' };
  function reset() {
    request.current?.abort();
    request.current = null;
    setPending(false); setError(''); setMessages([]); setDraft('');
    input.current?.focus();
  }
  async function reply(history: Message[]) {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true); setError('');
    const timeout = setTimeout(() => controller.abort(), 55000);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-39).map(({ role, text }) => ({ role, text })) }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not get a reply. Please try again.');
      if (typeof data.text !== 'string' || !data.text.trim()) throw new Error('The reply was empty. Please try again.');
      if (request.current === controller) setMessages(previous => [...previous, { id: nextId.current++, role: 'assistant', text: data.text }]);
    } catch (failure) {
      if (request.current === controller) setError(controller.signal.aborted ? 'The request timed out. Please try again.' : failure instanceof Error ? failure.message : 'Could not connect. Please try again.');
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) { request.current = null; setPending(false); }
    }
  }
  function send(value = draft) {
    const text = value.trim();
    if (!text || request.current || error) return;
    const user: Message = { id: nextId.current++, role: 'user', text };
    const history = [...messages, user];
    if (live) { setMessages(history); void reply(history); }
    else setMessages([...history, { id: nextId.current++, role: 'assistant', text: demoReply(text) }]);
    setDraft('');
  }
  return (
    <SafeAreaView style={[s.screen, { backgroundColor: c.bg }]} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[s.page, { paddingTop: Platform.OS === 'web' ? 86 : 12 }]}>
          <View style={[s.header, { borderBottomColor: c.border }]}>
            <View style={s.heading}>
              <Text style={[s.brand, { color: c.text }]}>mishirji ka bot / chat</Text>
              <Text style={[s.caption, { color: c.muted }]}>A little space for your next big thought.</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Start a new chat" onPress={reset} style={({ pressed }) => [s.newChat, { borderColor: c.border, opacity: pressed ? 0.6 : 1 }]}>
              <Text style={{ color: c.text, fontWeight: '600' }}>+ {compact ? 'New' : 'New chat'}</Text>
            </Pressable>
          </View>
          <View style={s.modeRow}>
            <Text style={[s.caption, { color: c.muted }]}>{live ? 'AI · Live chat' : 'Demo · Sample replies'}</Text>
            <Pressable accessibilityRole="button" onPress={() => { reset(); setLive(!live); }}>
              <Text style={[s.modeLink, { color: c.text }]}>Switch to {live ? 'demo' : 'live chat'} · starts a new chat</Text>
            </Pressable>
          </View>
          <ScrollView ref={scroll} style={s.screen} contentContainerStyle={[s.conversation, !messages.length && s.empty]} keyboardShouldPersistTaps="handled" onContentSizeChange={() => { if (messages.length) scroll.current?.scrollToEnd({ animated: true }); }}>
            {!messages.length ? (
              <View style={s.welcome}>
                <View style={[s.mark, { backgroundColor: c.accent }]}><Text style={[s.markText, { color: c.ink }]}>m.</Text></View>
                <Text style={[s.eyebrow, { color: c.muted }]}>YOUR EVERYDAY THINKING PARTNER</Text>
                <Text accessibilityRole="header" style={[s.title, { color: c.text, fontSize: compact ? 36 : 52 }]}>What’s on your mind?</Text>
                <Text style={[s.subtitle, { color: c.muted }]}>An idea to explore. A question to untangle.{'\n'}A blank page to get past. Start here.</Text>
                <View style={[s.suggestions, { flexDirection: compact ? 'column' : 'row' }]}>
                  {suggestions.map(item => (
                    <Pressable key={item.title} accessibilityRole="button" accessibilityLabel={item.prompt} onPress={() => send(item.prompt)} style={({ pressed }) => [s.suggestion, { flexBasis: compact ? 'auto' : 0, backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.65 : 1 }]}>
                      <Text style={[s.suggestionIcon, { color: c.accent }]}>{item.icon}</Text>
                      <Text style={[s.suggestionTitle, { color: c.text }]}>{item.title}</Text>
                      <Text style={[s.caption, { color: c.muted }]}>{item.prompt}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : messages.map(message => (
              <View key={message.id} style={[s.message, { alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start', backgroundColor: message.role === 'user' ? c.accent : c.surface, borderColor: c.border }]}>
                <Text style={[s.messageLabel, { color: message.role === 'user' ? c.ink : c.muted }]}>{message.role === 'user' ? 'YOU' : live ? 'MISHIRJI · AI' : 'MISHIRJI · DEMO'}</Text>
                <Text selectable style={[s.messageText, { color: message.role === 'user' ? c.ink : c.text }]}>{message.text}</Text>
              </View>
            ))}
          </ScrollView>
          <View style={s.footer}>
            {pending && <Text accessibilityLiveRegion="polite" style={[s.caption, { color: c.muted }]}>Mishirji is thinking…</Text>}
            {!!error && <View accessibilityRole="alert" style={s.errorBox}>
              <Text style={[s.caption, { color: c.text }]}>{error}</Text>
              <Pressable accessibilityRole="button" onPress={() => void reply(messages)}><Text style={[s.modeLink, { color: c.text }]}>Retry reply</Text></Pressable>
            </View>}
            <View style={[s.composer, { backgroundColor: c.surface, borderColor: c.border }]}>
              <TextInput ref={input} value={draft} onChangeText={setDraft} multiline maxLength={4000} accessibilityLabel="Message mishirji ka bot" placeholder="Let’s think it through…" placeholderTextColor={c.muted} style={[s.input, { color: c.text }]} onKeyPress={event => {
                const key = event.nativeEvent as { key: string; shiftKey?: boolean; isComposing?: boolean; keyCode?: number };
                if (Platform.OS === 'web' && key.key === 'Enter' && !key.shiftKey && !key.isComposing && key.keyCode !== 229) { event.preventDefault(); send(); }
              }} />
              <Pressable accessibilityRole="button" accessibilityLabel="Send message" disabled={!draft.trim() || pending || !!error} onPress={() => send()} style={({ pressed }) => [s.send, { backgroundColor: c.accent, opacity: !draft.trim() || pending || !!error ? 0.35 : pressed ? 0.7 : 1 }]}>
                <Text style={[s.sendText, { color: c.ink }]}>↑</Text>
              </Pressable>
            </View>
            <Text style={[s.footnote, { color: c.muted }]}>{live ? 'Messages are sent to the AI provider · AI can make mistakes' : 'Demo mode · Sample replies'} · Chats reset on reload</Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1 },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', paddingVertical: 12 },
  modeLink: { fontSize: 12, lineHeight: 20, textDecorationLine: 'underline' },
  errorBox: { gap: 8, padding: 12, borderWidth: 1, borderColor: '#a77b54', borderRadius: 12 },
  page: { flex: 1, width: '100%', maxWidth: 1000, alignSelf: 'center', paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 20, borderBottomWidth: 1 },
  heading: { flex: 1, gap: 5 }, brand: { fontSize: 17, fontWeight: '700' }, caption: { fontSize: 12, lineHeight: 18 },
  newChat: { borderWidth: 1, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 24 },
  conversation: { paddingVertical: 28, gap: 18 }, empty: { flexGrow: 1, justifyContent: 'center' },
  welcome: { alignItems: 'center', paddingVertical: 24 },
  mark: { width: 64, height: 64, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  markText: { fontSize: 34, fontWeight: '700' },
  eyebrow: { fontSize: 10, letterSpacing: 2, fontWeight: '600', textAlign: 'center', marginBottom: 14 },
  title: { fontWeight: '600', letterSpacing: -1.5, textAlign: 'center', marginBottom: 14 },
  subtitle: { fontSize: 16, lineHeight: 25, textAlign: 'center' },
  suggestions: { gap: 12, width: '100%', marginTop: 36 },
  suggestion: { flexGrow: 1, flexBasis: 0, borderWidth: 1, borderRadius: 18, padding: 18, gap: 8 },
  suggestionIcon: { fontSize: 24 }, suggestionTitle: { fontSize: 15, fontWeight: '600' },
  message: { maxWidth: '88%', padding: 18, borderRadius: 20, gap: 8, borderWidth: 1 },
  messageLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1 }, messageText: { fontSize: 16, lineHeight: 25 },
  footer: { paddingTop: 10, paddingBottom: 16, gap: 10 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', borderWidth: 1, borderRadius: 24, padding: 10, gap: 10 },
  input: { flex: 1, fontSize: 16, lineHeight: 24, minHeight: 44, maxHeight: 140, padding: 10 },
  send: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sendText: { fontSize: 26, fontWeight: '600' }, footnote: { fontSize: 11, textAlign: 'center', lineHeight: 16 },
});
