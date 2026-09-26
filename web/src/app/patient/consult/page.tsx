"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Video, Phone, MessageSquare, Send } from "lucide-react";

export default function PatientConsultPage() {
  const [mode, setMode] = useState<"chat" | "video">("chat");
  const [messages, setMessages] = useState([
    { sender: "doctor", text: "Hello! How are you feeling today?" },
    { sender: "patient", text: "I've been having headaches for the past few days." },
    { sender: "doctor", text: "I see. Can you describe the pain?" },
  ]);
  const [input, setInput] = useState("");

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages([...messages, { sender: "patient", text: input }]);
    setInput("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Consultation</h1>
        <p className="text-sm text-muted-foreground mt-1">Chat or video call with your doctor</p>
      </div>

      {/* Mode selector */}
      <div className="flex gap-2">
        <Button
          variant={mode === "chat" ? "default" : "outline"}
          onClick={() => setMode("chat")}
          className="rounded-xl"
        >
          <MessageSquare className="h-4 w-4 mr-1" /> Chat
        </Button>
        <Button
          variant={mode === "video" ? "default" : "outline"}
          onClick={() => setMode("video")}
          className="rounded-xl"
        >
          <Video className="h-4 w-4 mr-1" /> Video Call
        </Button>
      </div>

      {mode === "chat" ? (
        <Card className="beeline-card">
          <CardContent className="p-0">
            {/* Chat messages */}
            <div className="h-96 overflow-y-auto p-4 space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.sender === "patient" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                    msg.sender === "patient" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}>
                    <p className="text-sm">{msg.text}</p>
                  </div>
                </div>
              ))}
            </div>
            {/* Input */}
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
      ) : (
        <Card className="beeline-card">
          <CardContent className="p-6">
            <div className="flex flex-col items-center justify-center h-96 rounded-2xl bg-muted">
              <Video className="h-16 w-16 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">Video call will start when the doctor joins</p>
              <div className="flex gap-2 mt-4">
                <Button className="bg-accent-teal text-white rounded-xl">
                  <Phone className="h-4 w-4 mr-1" /> Start Call
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
