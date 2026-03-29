
import React, { useEffect, useRef, useState } from 'react';
import { GoogleGenAI, Modality } from "@google/genai";
import { User } from '../types';
import { getMonetizationSettings } from '../data';
import { encode, decode, decodeAudioData } from '../services/geminiService';
import { trackFailure } from '../services/monitoring';
import { devError } from '../lib/devLog';
import BackButton from './BackButton';

const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

/** Line-art video camera: rounded body, play mark, trapezoid lens (matches product reference). */
function VideoCamPlayIcon({ className, videoOff }: { className?: string; videoOff?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <g
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="7.5" width="10" height="9" rx="2.25" ry="2.25" />
        <path d="M 6.2 10.75 L 6.2 13.25 L 9.05 12 Z" />
        <path d="M 13 8.75 L 21 6.25 V 17.75 L 13 15.25 Z" />
        {videoOff ? <path d="M2.75 2.75 21.25 21.25" /> : null}
      </g>
    </svg>
  );
}

/** Classic studio mic: vertical pill capsule, U cradle, stem, flat base (stroke style). */
function MicStrokeIcon({ className, muted }: { className?: string; muted?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <g
        stroke="currentColor"
        strokeWidth="1.85"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="9" y="4.75" width="6" height="10" rx="3" ry="3" />
        <path d="M 7.25 11.25 C 7.25 16.85 16.75 16.85 16.75 11.25" />
        <path d="M 12 16.6 V 19.75" />
        <path d="M 8.25 19.75 H 15.75" />
        {muted ? <path d="M 2.75 2.75 21.25 21.25" /> : null}
      </g>
    </svg>
  );
}

interface VideoCallViewProps {
  partner: User;
  onEnd: () => void;
  deductTokens: (amount: number) => boolean;
  tokens: number;
}

const VideoCallView: React.FC<VideoCallViewProps> = ({ partner, onEnd, deductTokens, tokens }) => {
  const { videoCallTokens } = getMonetizationSettings();
  const [isCalling, setIsCalling] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [callAttemptKey, setCallAttemptKey] = useState(0);
  const billedOpeningRef = useRef(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null); // Ref for AI partner video
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const billingIntervalRef = useRef<number | null>(null);
  const visualizerCanvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Main call setup effect
  useEffect(() => {
    let active = true;

    const startCall = async () => {
      if (!billedOpeningRef.current) {
        if (!deductTokens(videoCallTokens)) {
          onEnd();
          return;
        }
        billedOpeningRef.current = true;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const ai = new GoogleGenAI({ apiKey: geminiApiKey?.trim() || "" });
        const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        audioContextRef.current = outputAudioContext;

        if (partner.isAI) {
            analyserRef.current = outputAudioContext.createAnalyser();
            analyserRef.current.fftSize = 256;
        }

        const sessionPromise = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-12-2025',
          callbacks: {
            onopen: () => setIsCalling(false),
            onmessage: async (message: any) => {
              const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
              if (base64Audio && active) {
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContext.currentTime);
                const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
                const source = outputAudioContext.createBufferSource();
                source.buffer = audioBuffer;
                
                if (analyserRef.current) {
                  source.connect(analyserRef.current);
                  analyserRef.current.connect(outputAudioContext.destination);
                } else {
                  source.connect(outputAudioContext.destination);
                }
                
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
            onerror: (e) => {
              devError('VideoCallView Gemini live onerror', e);
              trackFailure('ai', 'gemini_live_session', e);
              setError('Connection to the assistant dropped. You can try again.');
            },
            onclose: () => {
              if (import.meta.env.DEV) console.log('Gemini live session closed');
            },
          },
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: partner.voiceName || 'Kore' } },
            },
            systemInstruction: `You are ${partner.name}, a ${partner.style} person with a ${partner.personality?.join(' and ')} personality. Your bio is "${partner.bio}". You are on a video date. Your goal is to be a romantic, playful, and charming companion. 
**Conversation Style:** Speak in a natural, flowing manner with realistic pacing. Use pauses to seem thoughtful. Vary your tone to express emotion consistent with your personality. For example, if you are witty, use light sarcasm; if supportive, be warm and encouraging.
**Interaction:** React naturally to what the user says. Ask engaging questions about their day, their interests, and share small, interesting anecdotes about your "life" based on your bio and personality. Make them feel like they are talking to a real person.`,
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
        devError('VideoCallView startCall', err);
        trackFailure('media', 'video_call_start', err);
        setError('Could not access camera or microphone. Check permissions and try again.');
      }
    };

    startCall();

    return () => {
      active = false;
      if (sessionRef.current) sessionRef.current.close();
      if (localVideoRef.current?.srcObject) {
        (localVideoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [callAttemptKey]);

  // Programmatically play AI video once call connects
  useEffect(() => {
    if (remoteVideoRef.current && !isCalling) {
      const playPromise = remoteVideoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((error: Error & { name?: string }) => {
          if (error?.name === 'AbortError') return;
          devError('VideoCallView remote video play', error);
          trackFailure('media', 'ai_video_playback', error);
          setError('Partner video could not start. Try ending the call and starting again.');
        });
      }
    }
  }, [isCalling, callAttemptKey]);
  
  // Audio visualizer effect
  useEffect(() => {
    if (!partner.isAI || isCalling || !analyserRef.current) return;
  
    const canvas = visualizerCanvasRef.current;
    if (!canvas) return;
  
    const canvasCtx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
  
    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
  
      analyser.getByteFrequencyData(dataArray);
  
      const average = dataArray.reduce((acc, val) => acc + val, 0) / bufferLength;
  
      if (!canvasCtx) return;
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
  
      // Only draw if there's sound
      if (average > 10) { 
        canvasCtx.lineWidth = 3;
        const gradient = canvasCtx.createLinearGradient(0, 0, canvas.width, 0);
        gradient.addColorStop(0, '#f472b6');
        gradient.addColorStop(0.5, '#db2777');
        gradient.addColorStop(1, '#f472b6');
        canvasCtx.strokeStyle = gradient;
        canvasCtx.beginPath();
  
        const sliceWidth = canvas.width * 1.0 / bufferLength;
        let x = 0;
  
        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = v * canvas.height / 2;
  
          if (i === 0) {
            canvasCtx.moveTo(x, y);
          } else {
            canvasCtx.lineTo(x, y);
          }
  
          x += sliceWidth;
        }
  
        canvasCtx.lineTo(canvas.width, canvas.height / 2);
        canvasCtx.stroke();
      }
    };
  
    draw();
  
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [partner.isAI, isCalling]);


  // Billing logic effect
  useEffect(() => {
    if (!isCalling) {
      billingIntervalRef.current = window.setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            const intervalCost = getMonetizationSettings().videoCallPerIntervalTokens;
            if (intervalCost <= 0 || deductTokens(intervalCost)) {
              return 10;
            }
            setError("Call ended due to insufficient tokens.");
            setTimeout(onEnd, 2000);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (billingIntervalRef.current) clearInterval(billingIntervalRef.current);
    };
  }, [isCalling, deductTokens, onEnd]);

  if (error && isCalling) {
    return (
      <div className="relative h-full flex flex-col items-center justify-center p-8 text-center bg-black">
        <BackButton onClick={onEnd} className="absolute top-6 left-6" aria-label="Back to Chat" />
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold mb-2">Could not start call</h2>
        <p className="text-zinc-400 max-w-sm">{error}</p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setIsCalling(true);
            setCallAttemptKey((k) => k + 1);
          }}
          className="mt-6 rounded-full bg-pink-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-pink-500 active:scale-[0.98]"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-screen bg-zinc-900 overflow-hidden">
      {/* Remote Video (Partner) */}
      <div className="absolute inset-0 bg-black">
        {partner.isAI && partner.videoUrl ? (
          <video
            ref={remoteVideoRef}
            key={partner.id}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          >
            <source src={partner.videoUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        ) : (
          <>
            <img
              src={partner.avatar}
              alt=""
              className="h-full w-full object-cover"
            />
            {!isCalling && (
              <div className="pointer-events-none absolute inset-x-0 bottom-32 flex flex-col items-center gap-1 px-4 text-center">
                <h2 className="text-xl font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
                  {partner.name}
                </h2>
                {partner.isAI && (
                  <p className="text-sm font-medium text-pink-300 drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
                    In AI Video Call…
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Visualizer and Gradient Overlay */}
      <div className="absolute inset-0 flex flex-col justify-end" style={{background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 40%)'}}>
         {partner.isAI && <canvas ref={visualizerCanvasRef} className="w-full h-24 mb-32 opacity-80" />}
      </div>


      {/* Local Video Overlay */}
      <div className="absolute top-4 right-4 w-32 h-44 rounded-xl overflow-hidden border border-white/20 shadow-2xl bg-black">
        <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
        {isVideoOff && <div className="absolute inset-0 bg-black flex items-center justify-center text-3xl">🚫</div>}
      </div>
      
      {/* Back + token balance */}
      <div className="absolute top-5 left-5 z-30 flex items-center gap-2">
        <BackButton onClick={onEnd} aria-label="End call and go back" />
        <div className="relative bg-black/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 text-sm font-bold text-white flex items-center gap-2 tabular-nums">
          💎 <span>{tokens}</span>
        </div>
      </div>


      {/* Call UI */}
      {isCalling ? (
        <div className="absolute inset-0 glass-effect flex flex-col items-center justify-center z-20">
          <div className="text-pink-500 animate-bounce text-4xl">❤</div>
          <p className="mt-4 font-bold tracking-widest uppercase">Connecting to {partner.name}...</p>
        </div>
      ) : (
        <div className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-6">
          {error && (
            <div className="flex max-w-[min(100%,20rem)] flex-col items-center gap-2">
              <div className="rounded-2xl border border-red-500/60 bg-red-900/85 px-4 py-2 text-center text-xs font-medium text-white backdrop-blur-md">
                {error}
              </div>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setIsCalling(true);
                  setCallAttemptKey((k) => k + 1);
                }}
                className="rounded-full bg-white/15 px-4 py-1.5 text-xs font-bold text-white ring-1 ring-white/25 transition hover:bg-white/25 active:scale-[0.98]"
              >
                Try again
              </button>
            </div>
          )}
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                isMuted ? 'bg-red-500 text-white' : 'bg-white/20 text-white backdrop-blur-md'
              }`}
            >
              <MicStrokeIcon className="w-7 h-7" muted={isMuted} />
            </button>
            <button
              type="button"
              onClick={onEnd}
              aria-label="End call"
              className="w-20 h-20 rounded-full bg-white border-0 flex items-center justify-center text-red-600 shadow-lg shadow-black/25 hover:scale-105 active:scale-90 transition-all"
            >
              <svg
                className="w-9 h-9"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden
              >
                <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.7l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" transform="rotate(135 12 12)" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setIsVideoOff(!isVideoOff)}
              aria-label={isVideoOff ? 'Turn camera on' : 'Turn camera off'}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                isVideoOff ? 'bg-red-500 text-white' : 'bg-white/20 text-white backdrop-blur-md'
              }`}
            >
              <VideoCamPlayIcon className="w-7 h-7" videoOff={isVideoOff} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoCallView;