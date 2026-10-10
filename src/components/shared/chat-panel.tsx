"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiClient } from "@/lib/api-client";
import { formatClinicDateTime } from "@/lib/format";

interface Conversation {
  id: string;
  with: string;
  patientId: string;
  doctorId: string;
  unread: number;
  lastMessage: { body: string; createdAt: string } | null;
}

interface Message {
  id: string;
  mine: boolean;
  body: string;
  createdAt: string;
}

export interface ChatContact {
  /** The other person's patient / doctor id (what the server needs to open a conversation). */
  id: string;
  name: string;
}

interface Props {
  /** People the signed-in user is allowed to start a conversation with. */
  contacts: ChatContact[];
  /** Which id the server expects when starting a conversation. */
  startKey: "patientId" | "doctorId";
}

const POLL_MS = 5000;

/** Text chat between a doctor and a patient in their care. Polls for new messages. */
export function ChatPanel({ contacts, startKey }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchConversations = useCallback(() => apiClient.get<{ conversations: Conversation[] }>("/conversations"), []);

  // Refresh after an action (called from event handlers).
  const loadConversations = useCallback(async () => {
    try {
      const data = await fetchConversations();
      setConversations(data.conversations);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load conversations");
    }
  }, [fetchConversations]);

  // Poll for conversation changes; state is only set from promise callbacks.
  useEffect(() => {
    let cancelled = false;
    const tick = () =>
      fetchConversations()
        .then((data) => {
          if (!cancelled) setConversations(data.conversations);
        })
        .catch((e) => {
          if (!cancelled) setError(e instanceof Error ? e.message : "Could not load conversations");
        });
    tick();
    const timer = setInterval(tick, 15000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [fetchConversations]);

  // Load the open conversation, then poll for anything newer.
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    let latest: string | null = null;

    const load = async (initial: boolean) => {
      try {
        const query = initial || !latest ? "" : `?after=${encodeURIComponent(latest)}`;
        const data = await apiClient.get<{ messages: Message[] }>(`/conversations/${activeId}/messages${query}`);
        if (cancelled || data.messages.length === 0) return;
        latest = data.messages[data.messages.length - 1].createdAt;
        setMessages((current) => (initial || !latest ? data.messages : [...current, ...data.messages.filter((m) => !current.some((c) => c.id === m.id))]));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load messages");
      }
    };

    load(true);
    const timer = setInterval(() => load(false), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectConversation = (id: string) => {
    setMessages([]);
    setActiveId(id);
  };

  const open = async (contact: ChatContact) => {
    setError("");
    try {
      const { id } = await apiClient.post<{ id: string }>("/conversations", { [startKey]: contact.id });
      await loadConversations();
      selectConversation(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the conversation");
    }
  };

  const send = async () => {
    const body = input.trim();
    if (!body || !activeId || sending) return;
    setSending(true);
    setError("");
    try {
      const data = await apiClient.post<{ message: Message }>(`/conversations/${activeId}/messages`, { body });
      setMessages((current) => [...current, data.message]);
      setInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the message");
    } finally {
      setSending(false);
    }
  };

  const active = conversations.find((c) => c.id === activeId);
  const startable = contacts.filter((c) => !conversations.some((conv) => (startKey === "patientId" ? conv.patientId : conv.doctorId) === c.id));

  return (
    <div className="grid gap-4 md:grid-cols-[260px_1fr]">
      <div className="space-y-2">
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => selectConversation(c.id)}
            className={`w-full rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted/50 ${c.id === activeId ? "border-foreground" : "border-border"}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{c.with}</span>
              {c.unread > 0 && <Badge className="rounded-full">{c.unread}</Badge>}
            </div>
            {c.lastMessage && <p className="mt-1 truncate text-xs text-muted-foreground">{c.lastMessage.body}</p>}
          </button>
        ))}
        {startable.length > 0 && <p className="pt-2 text-xs font-semibold text-muted-foreground">Start a conversation</p>}
        {startable.map((c) => (
          <Button key={c.id} variant="outline" size="sm" className="w-full justify-start rounded-lg" onClick={() => open(c)}>
            {c.name}
          </Button>
        ))}
        {conversations.length === 0 && startable.length === 0 && (
          <p className="text-sm text-muted-foreground">No conversations yet. You can message people once they are in your care.</p>
        )}
      </div>

      <Card className="beeline-card">
        <CardContent className="flex h-[28rem] flex-col p-4">
          {!active ? (
            <p className="m-auto text-sm text-muted-foreground">Select a conversation</p>
          ) : (
            <>
              <p className="border-b border-border pb-2 text-sm font-semibold">{active.with}</p>
              <div className="flex-1 space-y-2 overflow-y-auto py-3">
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${m.mine ? "bg-foreground text-background" : "bg-muted"}`}>
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={`mt-1 text-[10px] ${m.mine ? "text-background/70" : "text-muted-foreground"}`}>{formatClinicDateTime(m.createdAt)}</p>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <div className="flex gap-2 border-t border-border pt-3">
                <Input
                  value={input}
                  maxLength={4000}
                  placeholder="Type a message…"
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                />
                <Button className="bg-foreground text-background rounded-lg" disabled={sending || !input.trim()} onClick={send}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
          {error && <p className="pt-2 text-xs text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
