"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, MessageCircle, Send, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  user?: { name: string | null; email: string } | null;
}

export function MeetingChatDrawer({
  meetingId,
  initialMessages,
}: {
  meetingId: string;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function handleSend() {
    const question = input.trim();
    if (!question || isSending) return;

    setError(null);
    setInput("");
    setIsSending(true);

    const userMessage: ChatMessage = {
      id: `local-user-${Date.now()}`,
      role: "USER",
      content: question,
    };
    const assistantId = `local-assistant-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: assistantId, role: "ASSISTANT", content: "" },
    ]);

    try {
      const res = await fetch(`/api/meetings/${meetingId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "No se pudo obtener respuesta.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + chunk } : m,
          ),
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            size="icon-lg"
            className="fixed right-6 bottom-6 z-40 rounded-full shadow-lg shadow-black/20"
          />
        }
      >
        <MessageCircle />
        <span className="sr-only">Preguntar sobre esta reunión</span>
      </SheetTrigger>

      <SheetContent className="flex w-full flex-col sm:max-w-md" side="right">
        <SheetHeader className="border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            Pregúntale a Gemini
          </SheetTitle>
          <SheetDescription>
            Responde en base a la transcripción de esta reunión.
          </SheetDescription>
        </SheetHeader>

        <div
          ref={scrollRef}
          className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-2"
        >
          {messages.length === 0 ? (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Pregunta cualquier cosa sobre esta reunión: decisiones, temas
              específicos, quién dijo qué, etc.
            </p>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-2",
                  message.role === "USER" && "flex-row-reverse",
                )}
              >
                {message.role === "ASSISTANT" && (
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bot className="size-3.5" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap",
                    message.role === "USER"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground",
                  )}
                >
                  {message.content || (
                    <Loader2 className="size-3.5 animate-spin" />
                  )}
                </div>
              </div>
            ))
          )}
          {error && (
            <p className="text-center text-xs text-destructive">{error}</p>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2 border-t border-border p-4"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu pregunta..."
            disabled={isSending}
            autoComplete="off"
          />
          <Button
            type="submit"
            size="icon"
            disabled={isSending || !input.trim()}
          >
            {isSending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Send />
            )}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
