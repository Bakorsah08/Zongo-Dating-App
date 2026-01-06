
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { User } from '../types';
import { TOKEN_COSTS } from '../constants';
import { encode, decode, decodeAudioData } from '../services/geminiService';

interface VideoCallViewProps {
  partner: User;
  onEnd: () => void;
  deductTokens: (amount: number) => boolean;
  tokens: number;
}

const VideoCallView: React.FC<VideoCallViewProps> = ({ partner, onEnd, deductTokens, tokens }) => {
  const [isCalling, setIsCalling] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [showDeduction, setShowDeduction] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const billingIntervalRef = useRef<number | null>(null);

  // Main call setup effect
  useEffect(() => {
    let active = true;

    const startCall = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
        const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        audioContextRef.current = outputAudioContext;

        const sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-09-2025',
          callbacks: {
            onopen: () => setIsCalling(false),
            onmessage: async (message: any) => {
              const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
              if (base64Audio && active) {
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContext.currentTime);
                const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
                const source = outputAudioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputAudioContext.destination);
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                sourcesRef.current.add(source);
                source.onended = () => sourcesRef.current.delete(source);
              }
              if (message.serverContent?.interrupted) {
                sourcesRef.current.forEach(s => s.stop());
                sourcesRef.current.clear();
              }
            },
            onerror: (e) => setError("Connection failed"),
            onclose: () => console.log("Closed"),
          },
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
            },
            systemInstruction: `You are ${partner.name}. You are on a video date with the user. Be romantic, playful, and charming. React naturally to what they say. Ask about their day and share small stories about yours.`,
          },
        });
        
        sessionRef.current = await sessionPromise;

        const source = inputAudioContext.createMediaStreamSource(stream);
        const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
        scriptProcessor.onaudioprocess = (e) => {
          if (!active || isMuted) return;
          const inputData = e.inputBuffer.getChannelData(0);
          const l = inputData.length;
          const int16 = new Int16Array(l);
          for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;
          const pcmBlob = {
            data: encode(new Uint8Array(int16.buffer)),
            mimeType: 'audio/pcm;rate=16000',
          };
          sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
        };
        source.connect(scriptProcessor);
        scriptProcessor.connect(inputAudioContext.destination);

      } catch (err) {
        console.error(err);
        setError("Could not access camera/mic");
      }
    };

    startCall();

    return () => {
      active = false;
      if (sessionRef.current) sessionRef.current.close();
      if (localVideoRef.current?.srcObject) {
        (localVideoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // Billing logic effect
  useEffect(() => {
    if (!isCalling) {
      billingIntervalRef.current = window.setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            if (deductTokens(TOKEN_COSTS.VIDEO_CALL_PER_INTERVAL)) {
              setShowDeduction(true);
              setTimeout(() => setShowDeduction(false), 1200);
              return 10;
            } else {
              setError("Call ended due to insufficient tokens.");
              setTimeout(onEnd, 2000);
              return 0;
            }
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (billingIntervalRef.current) clearInterval(billingIntervalRef.current);
    };
  }, [isCalling, deductTokens, onEnd]);

  if (error && isCalling) { // Show error screen only if call failed to connect
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-black">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
        <p className="text-zinc-500 mb-6">{error}</p>
        <button onClick={onEnd} className="bg-white text-black px-6 py-2 rounded-full font-bold">Back to Chat</button>
      </div>
    );
  }

  return (
    <div className="relative h-screen bg-zinc-900 overflow-hidden">
      {/* Remote Video (Partner) */}
      <div className="absolute inset-0 bg-black">
        <img src={partner.avatar} className="w-full h-full object-cover blur-sm opacity-50" />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <img src={partner.avatar} className="w-40 h-40 rounded-full object-cover border-4 border-pink-500 shadow-2xl animate-pulse" />
          <h2 className="text-2xl font-bold mt-6">{partner.name}</h2>
          <p className="text-pink-400 font-medium">In AI Video Call...</p>
        </div>
      </div>

      {/* Local Video Overlay */}
      <div className="absolute top-4 right-4 w-32 h-44 rounded-xl overflow-hidden border border-white/20 shadow-2xl bg-black">
        <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
      </div>
      
      {/* Token Balance */}
      <div className="absolute top-5 left-5 flex items-center gap-2">
        <div className="relative bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-sm font-bold flex items-center gap-2">
          💎 <span>{tokens}</span>
          {showDeduction && (
            <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-red-500 font-black text-sm animate-token-deduct">
              -{TOKEN_COSTS.VIDEO_CALL_PER_INTERVAL}
            </span>
          )}
        </div>
      </div>


      {/* Call UI */}
      {isCalling ? (
        <div className="absolute inset-0 glass-effect flex flex-col items-center justify-center z-20">
          <div className="text-pink-500 animate-bounce text-4xl">❤</div>
          <p className="mt-4 font-bold tracking-widest uppercase">Connecting to {partner.name}...</p>
        </div>
      ) : (
        <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-4">
          {error && (
            <div className="bg-red-900/80 text-white backdrop-blur-md px-4 py-2 rounded-full border border-red-500 text-xs font-medium">
              {error}
            </div>
          )}
          <div className="bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-xs font-medium">
            Next charge in <span className="font-bold text-pink-400">{countdown}s</span>
          </div>
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className={`w-14 h-14 rounded-full flex items-center justify-center text-xl transition-all ${
                isMuted ? 'bg-red-500 text-white' : 'bg-white/20 text-white backdrop-blur-md'
              }`}
            >
              {isMuted ? '🔇' : '🎤'}
            </button>
            <button 
              onClick={onEnd}
              className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center text-3xl shadow-2xl shadow-red-900/50 hover:scale-105 active:scale-90 transition-all"
            >
              📞
            </button>
            <button 
              onClick={() => setIsVideoOff(!isVideoOff)}
              className={`w-14 h-14 rounded-full flex items-center justify-center text-xl transition-all ${
                isVideoOff ? 'bg-zinc-800 text-white' : 'bg-white/20 text-white backdrop-blur-md'
              }`}
            >
              {isVideoOff ? '🚫' : '📹'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoCallView;