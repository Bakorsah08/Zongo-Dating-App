
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { User, Message, Gift } from '../types';
import { generateChatResponse } from '../services/geminiService';
import { getGifts, getMonetizationSettings } from '../data';
import {
  listMessages,
  sendMessage,
  subscribeToConversationMessages,
  unsubscribeChannel,
} from '../services/supabaseMessaging';
import BackButton from './BackButton';

interface ChatRoomViewProps {
  partner: User;
  /** Current user id for outgoing messages (use real auth id when not using mock `me`). */
  selfUserId?: string;
  /** Persisted thread (human-human or human-AI with AI replies local-only). */
  cloudChat?: { conversationId: string; partnerIsAi: boolean };
  onBack: () => void;
  onVideoCall: () => void;
  /** Voice-only call (tokens deducted in parent when applicable). */
  onAudioCall: () => void;
  onViewProfile: () => void;
  deductTokens: (amount: number) => boolean;
  /** Upload to Supabase Storage; returns object path for persisted media in `cloudChat` threads. */
  uploadChatMedia?: (blob: Blob, mimeType?: string) => Promise<string | null>;
  /** Persist gift to `gift_events` after tokens are deducted. */
  onGiftRecorded?: (gift: Gift, partnerId: string) => void;
}

/** Curated picker — common chat / reaction emojis (no extra dependency). */
const CHAT_EMOJIS: string[] = [
  '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😍', '🥰', '😘', '😋', '😜', '🤗', '🤭', '🤔',
  '😎', '🥳', '🤩', '😭', '😤', '🙄', '😴', '😇', '🤝', '👋', '👍', '👎', '👏', '🙌', '✌️', '🤞',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔', '💕', '💖', '💘', '💯', '🔥', '✨', '🎉', '🌹',
  '😺', '😸', '🙈', '🙉', '🙊', '💪', '🤦', '🤷', '👀', '💋', '🍕', '☕', '🎵', '☀️', '🌙', '⭐',
];

const ChatRoomView: React.FC<ChatRoomViewProps> = ({
  partner,
  selfUserId = 'me',
  cloudChat,
  onBack,
  onVideoCall,
  onAudioCall,
  onViewProfile,
  deductTokens,
  uploadChatMedia,
  onGiftRecorded,
}) => {
  const { videoCallEnabled, giftingEnabled } = getMonetizationSettings();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGiftPicker, setShowGiftPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<BlobPart[]>([]);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const voiceBlobUrlsRef = useRef<string[]>([]);
  /** True while the mic button is held (press-and-hold to record). */
  const voiceHoldActiveRef = useRef(false);

  const [viewerState, setViewerState] = useState<{
    isOpen: boolean;
    url: string;
    type: 'image' | 'video';
  }>({ isOpen: false, url: '', type: 'image' });

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (cloudChat) return;
    setMessages([
      {
        id: 'local-welcome',
        senderId: partner.id,
        text: `Hey! I'm ${partner.name}. Nice to meet you!`,
        timestamp: Date.now() - 100000,
      },
    ]);
  }, [cloudChat, partner.id, partner.name]);

  useEffect(() => {
    if (!cloudChat) return;
    let channel: ReturnType<typeof subscribeToConversationMessages> = null;
    let cancelled = false;
    (async () => {
      const list = await listMessages(cloudChat.conversationId);
      if (cancelled) return;
      if (list.length === 0 && cloudChat.partnerIsAi) {
        setMessages([
          {
            id: 'ai-welcome',
            senderId: partner.id,
            text: `Hey! I'm ${partner.name}. Nice to meet you!`,
            timestamp: Date.now() - 100000,
          },
        ]);
      } else {
        setMessages(list);
      }
      channel = subscribeToConversationMessages(cloudChat.conversationId, (m) => {
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      });
    })();
    return () => {
      cancelled = true;
      unsubscribeChannel(channel);
    };
  }, [cloudChat?.conversationId, cloudChat?.partnerIsAi, partner.id, partner.name]);

  useEffect(() => {
    if (!showEmojiPicker) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowEmojiPicker(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showEmojiPicker]);

  useEffect(() => {
    if (!showGiftPicker) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowGiftPicker(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showGiftPicker]);

  useEffect(() => {
    return () => {
      voiceBlobUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      voiceBlobUrlsRef.current = [];
      const mr = mediaRecorderRef.current;
      if (mr && mr.state !== 'inactive') {
        try {
          mr.stop();
        } catch {
          /* ignore */
        }
      }
      recordStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleSendGift = (gift: Gift) => {
    if (!deductTokens(gift.value)) return;
    onGiftRecorded?.(gift, partner.id);
    setShowGiftPicker(false);
    const line: Message = {
      id: Date.now().toString(),
      senderId: selfUserId,
      text: `sent a gift: ${gift.icon} ${gift.name}`,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, line]);
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-g`,
          senderId: partner.id,
          text: `Thanks for the ${gift.name}! ${gift.icon}`,
          timestamp: Date.now(),
        },
      ]);
    }, 1200);
  };

  const startVoiceRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      window.alert('Voice notes are not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!voiceHoldActiveRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      recordStreamRef.current = stream;
      recordChunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) recordChunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        recordStreamRef.current = null;
        const blob = new Blob(recordChunksRef.current, { type: mr.mimeType || 'audio/webm' });
        recordChunksRef.current = [];
        if (blob.size < 64) return;
        void (async () => {
          if (cloudChat && uploadChatMedia) {
            const mediaPath = await uploadChatMedia(blob, blob.type || 'audio/webm');
            if (mediaPath) {
              const sent = await sendMessage(cloudChat.conversationId, selfUserId, {
                audio_url: mediaPath,
              });
              if (sent) {
                setMessages((prev) => (prev.some((x) => x.id === sent.id) ? prev : [...prev, sent]));
              }
              if (cloudChat.partnerIsAi) {
                setIsTyping(true);
                setTimeout(() => {
                  setIsTyping(false);
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: `${Date.now()}-v`,
                      senderId: partner.id,
                      text: '🎤 Nice voice note!',
                      timestamp: Date.now(),
                    },
                  ]);
                }, 800);
              }
              return;
            }
          }
          const url = URL.createObjectURL(blob);
          voiceBlobUrlsRef.current.push(url);
          const voiceMsg: Message = {
            id: Date.now().toString(),
            senderId: selfUserId,
            audioUrl: url,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, voiceMsg]);
          setIsTyping(true);
          setTimeout(() => {
            setIsTyping(false);
            setMessages((prev) => [
              ...prev,
              {
                id: `${Date.now()}-v`,
                senderId: partner.id,
                text: '🎤 Nice voice note!',
                timestamp: Date.now(),
              },
            ]);
          }, 1000);
        })();
      };
      mediaRecorderRef.current = mr;
      if (!voiceHoldActiveRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        recordStreamRef.current = null;
        mediaRecorderRef.current = null;
        return;
      }
      mr.start();
      setIsRecording(true);
    } catch {
      window.alert('Microphone permission is needed to record a voice note.');
    }
  }, [partner.id, cloudChat, uploadChatMedia, selfUserId]);

  const stopVoiceRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr) {
      if (mr.state === 'recording' || mr.state === 'paused') {
        try {
          mr.stop();
        } catch {
          /* ignore */
        }
        mediaRecorderRef.current = null;
      } else {
        recordStreamRef.current?.getTracks().forEach((t) => t.stop());
        recordStreamRef.current = null;
        mediaRecorderRef.current = null;
      }
    } else {
      recordStreamRef.current?.getTracks().forEach((t) => t.stop());
      recordStreamRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const onVoiceMicPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    voiceHoldActiveRef.current = true;
    void startVoiceRecording();
  };

  const onVoiceMicPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    voiceHoldActiveRef.current = false;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      /* ignore */
    }
    stopVoiceRecording();
  };

  const onVoiceMicLostPointerCapture = () => {
    voiceHoldActiveRef.current = false;
    stopVoiceRecording();
  };

  const insertEmoji = (emoji: string) => {
    const el = inputRef.current;
    if (!el) {
      setInput((prev) => prev + emoji);
      return;
    }
    const start = el.selectionStart ?? input.length;
    const end = el.selectionEnd ?? input.length;
    const next = input.slice(0, start) + emoji + input.slice(end);
    setInput(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    setShowEmojiPicker(false);
    const text = input.trim();
    setInput('');

    if (cloudChat) {
      const sent = await sendMessage(cloudChat.conversationId, selfUserId, { text });
      if (sent) {
        setMessages((prev) => (prev.some((x) => x.id === sent.id) ? prev : [...prev, sent]));
      }
      if (cloudChat.partnerIsAi) {
        setIsTyping(true);
        const aiResponse = await generateChatResponse(text, partner.name);
        setIsTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            senderId: partner.id,
            text: aiResponse || "That's cool!",
            timestamp: Date.now(),
          },
        ]);
      }
      return;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      senderId: selfUserId,
      text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    setIsTyping(true);
    const aiResponse = await generateChatResponse(text, partner.name);

    setIsTyping(false);
    const partnerMsg: Message = {
      id: (Date.now() + 1).toString(),
      senderId: partner.id,
      text: aiResponse || "That's cool!",
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, partnerMsg]);
  };
  
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    void (async () => {
      if (cloudChat && uploadChatMedia) {
        const mediaPath = await uploadChatMedia(file, file.type);
        if (!mediaPath) {
          window.alert('Could not upload this file. Try a smaller image or video.');
          return;
        }
        const payload =
          file.type.startsWith('image/')
            ? { image_url: mediaPath }
            : file.type.startsWith('video/')
              ? { video_url: mediaPath }
              : null;
        if (!payload) return;
        const sent = await sendMessage(cloudChat.conversationId, selfUserId, payload);
        if (sent) {
          setMessages((prev) => (prev.some((x) => x.id === sent.id) ? prev : [...prev, sent]));
        }
        if (cloudChat.partnerIsAi) {
          setIsTyping(true);
          setTimeout(() => {
            setIsTyping(false);
            setMessages((prev) => [
              ...prev,
              {
                id: `${Date.now()}-m`,
                senderId: partner.id,
                text: file.type.startsWith('image/') ? 'Wow, great picture!' : 'Cool video!',
                timestamp: Date.now(),
              },
            ]);
          }, 1200);
        }
        return;
      }

      const url = URL.createObjectURL(file);
      const message: Message = {
        id: Date.now().toString(),
        senderId: selfUserId,
        timestamp: Date.now(),
      };

      if (file.type.startsWith('image/')) {
        message.imageUrl = url;
      } else if (file.type.startsWith('video/')) {
        message.videoUrl = url;
      } else {
        URL.revokeObjectURL(url);
        return;
      }

      setMessages((prev) => [...prev, message]);

      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        const partnerMsg: Message = {
          id: (Date.now() + 1).toString(),
          senderId: partner.id,
          text: file.type.startsWith('image/') ? 'Wow, great picture!' : 'Cool video!',
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, partnerMsg]);
      }, 1500);
    })();
  };

  const openMediaViewer = (url: string, type: 'image' | 'video') => {
    setViewerState({ isOpen: true, url, type });
  };
  
  const renderMessageContent = (msg: Message) => {
    if (msg.imageUrl) {
      return (
        <img 
          src={msg.imageUrl} 
          onClick={() => openMediaViewer(msg.imageUrl!, 'image')}
          className="w-48 h-auto rounded-xl cursor-pointer object-cover"
        />
      );
    }
    if (msg.videoUrl) {
      return (
        <video 
          src={msg.videoUrl} 
          onClick={() => openMediaViewer(msg.videoUrl!, 'video')}
          className="w-48 h-auto rounded-xl cursor-pointer" 
          preload="metadata"
        />
      );
    }
    if (msg.audioUrl) {
      const wrap =
        msg.senderId === selfUserId ? 'rounded-lg bg-white/20 p-1' : 'rounded-lg bg-zinc-100 p-1';
      return (
        <div className={wrap}>
          <audio
            src={msg.audioUrl}
            controls
            className="h-9 w-full min-w-[200px] max-w-[260px]"
            preload="metadata"
          />
        </div>
      );
    }
    return msg.text;
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-white text-zinc-900">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] z-10">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <BackButton variant="light" onClick={onBack} />
          <button
            type="button"
            className="flex min-w-0 cursor-pointer items-center gap-3 rounded-xl py-1 pr-2 text-left transition-all hover:bg-zinc-50 active:scale-[0.99]"
            onClick={onViewProfile}
            title="View profile"
          >
            <img
              src={partner.avatar}
              className="h-10 w-10 shrink-0 rounded-full border border-zinc-200 object-cover"
              alt={partner.name}
            />
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-zinc-900">{partner.name}</h3>
              <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-widest text-emerald-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Active
              </span>
            </div>
          </button>
        </div>
      </header>

      {/* Scrollable messages — fills space above pinned composer */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-zinc-50 p-4">
        <div className="mx-auto flex max-w-lg flex-col space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.senderId === selfUserId ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                  msg.senderId === selfUserId
                    ? 'rounded-br-md bg-pink-600 text-white'
                    : 'rounded-bl-md border border-zinc-200 bg-white text-zinc-900'
                }`}
              >
                {renderMessageContent(msg)}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md border border-zinc-200 bg-white px-4 py-3 shadow-sm">
                <div className="flex gap-1">
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" />
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:0.15s]" />
                  <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400 [animation-delay:0.3s]" />
                </div>
              </div>
            </div>
          )}
          <div ref={scrollRef} className="h-px w-full shrink-0" aria-hidden />
        </div>
      </div>

      {/* Composer pinned to bottom of screen (navbar hidden in chat) */}
      <footer className="shrink-0 border-t border-zinc-200 bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        {showEmojiPicker && (
          <div
            className="mx-auto mb-2 max-h-40 max-w-lg overflow-y-auto rounded-xl border border-zinc-200 bg-white p-2 shadow-md"
            role="listbox"
            aria-label="Emoji picker"
          >
            <div className="grid grid-cols-8 gap-0.5 sm:grid-cols-10">
              {CHAT_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="flex h-9 w-full items-center justify-center rounded-lg text-xl transition-colors hover:bg-zinc-100 active:scale-95"
                  onClick={() => insertEmoji(emoji)}
                  aria-label={`Insert ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="mx-auto flex max-w-lg items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-2 py-2 shadow-sm focus-within:border-pink-300 focus-within:ring-2 focus-within:ring-pink-200">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-full p-2 text-zinc-500 transition-colors hover:bg-zinc-200/80 hover:text-zinc-700"
            aria-label="Attach photo or video"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.59a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setShowEmojiPicker((v) => !v)}
            className={`rounded-full p-2 transition-colors hover:bg-zinc-200/80 ${
              showEmojiPicker ? 'bg-pink-100 text-pink-600' : 'text-zinc-500 hover:text-zinc-700'
            }`}
            aria-label={showEmojiPicker ? 'Close emoji picker' : 'Open emoji picker'}
            aria-expanded={showEmojiPicker}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
          </button>
          <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileSelect} />
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="min-w-0 flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
          />
          <button
            type="button"
            onClick={handleSend}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pink-600 text-white transition-transform hover:bg-pink-500 active:scale-90"
            aria-label="Send"
          >
            ↑
          </button>
        </div>

        {/* Quick actions: audio, gift, video, voice — icon only */}
        <div className="mx-auto mt-3 grid max-w-lg grid-cols-4 place-items-center gap-1">
          <button
            type="button"
            onClick={onAudioCall}
            className="flex h-11 w-11 items-center justify-center rounded-full border-0 bg-transparent p-0 text-zinc-600 transition-transform hover:text-pink-600 active:scale-90"
            aria-label="Audio call"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => giftingEnabled && setShowGiftPicker(true)}
            disabled={!giftingEnabled}
            title={giftingEnabled ? 'Send a gift' : 'Gifting is off'}
            className="flex h-11 w-11 items-center justify-center rounded-full border-0 bg-transparent p-0 text-xl leading-none transition-transform hover:opacity-80 active:scale-90 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Send gift"
          >
            <span aria-hidden>🎁</span>
          </button>
          <button
            type="button"
            onClick={onVideoCall}
            disabled={!videoCallEnabled}
            title={videoCallEnabled ? 'Video call' : 'Video calls are off'}
            className="flex h-11 w-11 items-center justify-center rounded-full border-0 bg-transparent p-0 text-zinc-600 transition-transform hover:text-pink-600 active:scale-90 disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Video call"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="2" y="7" width="15" height="10" rx="2" />
              <path d="M17 11l5-3v8l-5-3v-2z" />
            </svg>
          </button>
          <button
            type="button"
            onPointerDown={onVoiceMicPointerDown}
            onPointerUp={onVoiceMicPointerUp}
            onPointerCancel={onVoiceMicPointerUp}
            onLostPointerCapture={onVoiceMicLostPointerCapture}
            onContextMenu={(ev) => ev.preventDefault()}
            title="Hold to record, release to send"
            className={`flex h-11 w-11 touch-manipulation select-none items-center justify-center rounded-full border-0 bg-transparent p-0 transition-transform active:scale-90 ${
              isRecording ? 'text-red-600 animate-pulse' : 'text-zinc-600 hover:text-pink-600'
            }`}
            aria-label="Hold to record a voice note, release to send"
            aria-pressed={isRecording}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          </button>
        </div>
      </footer>

      {showGiftPicker && (
        <div className="fixed inset-0 z-[80] flex flex-col justify-end bg-black/40 backdrop-blur-[2px]">
          <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={() => setShowGiftPicker(false)} />
          <div
            className="relative mx-auto w-full max-w-md rounded-t-[28px] border border-zinc-200 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Send a gift"
          >
            <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-zinc-300" />
            <div className="mb-3 flex items-center justify-between px-1">
              <h3 className="text-sm font-black uppercase tracking-widest text-zinc-500">Send a gift</h3>
              <button type="button" onClick={() => setShowGiftPicker(false)} className="text-sm font-bold text-zinc-500">
                Close
              </button>
            </div>
            <div className="grid max-h-[45vh] grid-cols-4 gap-3 overflow-y-auto pb-2">
              {getGifts().map((gift) => (
                <button
                  key={gift.id}
                  type="button"
                  onClick={() => handleSendGift(gift)}
                  className="flex flex-col items-center gap-1 rounded-2xl border border-zinc-100 bg-zinc-50 py-3 transition-all hover:border-pink-200 hover:bg-pink-50/40 active:scale-95"
                >
                  <span className="text-2xl">{gift.icon}</span>
                  <span className="text-[9px] font-bold text-zinc-600">{gift.name}</span>
                  <span className="flex items-center gap-0.5 text-[10px] font-black text-pink-600">
                    <span className="text-[8px]">💎</span>
                    {gift.value}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatRoomView;