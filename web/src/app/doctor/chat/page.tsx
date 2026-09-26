"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";

export default function DoctorChatPage() {
  const [messages, setMessages] = useState([
    { sender: "doctor", text: "Hello John, how are you feeling after the medication?" },
    { sender: "patient", text: "Much better, the headaches have reduced significantly." },
    { sender: "doctor", text: "Great to hear. Continue the medication for another week." },
  ]);
  const [input, setInput] = useState("");

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages([...messages, { sender: "doctor", text: input }]);
    setInput("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Patient Chat</h1>
        <p className="text-sm text-muted-foreground mt-1">Communicate with your patients</p>
      </div>

      <Card className="beeline-card">
        <CardContent className="p-0">
          <div className="flex items-center gap-3 border-b border-border p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold">JD</div>
            <div>
              <p className="text-sm font-semibold">John Doe</p>
              <p className="text-xs text-accent-teal">● Online</p>
            </div>
          </div>
          <div className="h-96 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.sender === "doctor" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                  msg.sender === "doctor" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                }`}>
                  <p className="text-sm">{msg.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 border-t border-border p-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
              placeholder="Type a message..."
              className="rounded-xl"
            />
            <Button onClick={sendMessage} className="bg-primary text-primary-foreground rounded-xl">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
