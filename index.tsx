
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  GoogleGenAI, 
  LiveServerMessage, 
  Modality,
} from '@google/genai';
import { 
  Mic, 
  MicOff, 
  Camera, 
  CameraOff, 
  BookOpen, 
  MessageSquare, 
  Sparkles, 
  History, 
  StopCircle,
  Play,
  Zap,
  ChevronRight,
  Maximize2,
  X,
  Minus,
  ExternalLink,
  Settings,
  MoreVertical,
  BrainCircuit
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Constants ---
const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-12-2025';
const AUDIO_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const FRAME_RATE = 1; 
const JPEG_QUALITY = 0.6;

// --- Helper Functions ---
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function blobToBase64(blob: globalThis.Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// --- App Component ---
const App: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [transcriptions, setTranscriptions] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [insights, setInsights] = useState<{ id: string, title: string, content: string, type: 'term' | 'summary' | 'action' }[]>([]);
  const [status, setStatus] = useState<string>('Ready');

  const aiRef = useRef<GoogleGenAI | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const audioContextsRef = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const currentTranscriptionRef = useRef({ user: '', model: '' });

  useEffect(() => {
    aiRef.current = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    return () => {
      stopSession();
    };
  }, []);

  const startSession = async () => {
    if (!aiRef.current) return;

    try {
      setStatus('Initializing...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: AUDIO_SAMPLE_RATE });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: OUTPUT_SAMPLE_RATE });
      audioContextsRef.current = { input: inputCtx, output: outputCtx };

      setStatus('Connecting...');
      const sessionPromise = aiRef.current.live.connect({
        model: MODEL_NAME,
        callbacks: {
          onopen: () => {
            setIsActive(true);
            setStatus('Listening');
            
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;
              
              sessionPromise.then(s => s.sendRealtimeInput({ 
                audio: { 
                  data: encode(new Uint8Array(int16.buffer)), 
                  mimeType: 'audio/pcm;rate=16000' 
                } 
              }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            const audioData = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData && audioContextsRef.current) {
              const { output } = audioContextsRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, output.currentTime);
              const buffer = await decodeAudioData(decode(audioData), output, OUTPUT_SAMPLE_RATE, 1);
              const source = output.createBufferSource();
              source.buffer = buffer;
              source.connect(output.destination);
              source.addEventListener('ended', () => sourcesRef.current.delete(source));
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buffer.duration;
              sourcesRef.current.add(source);
            }

            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => s.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }

            if (msg.serverContent?.inputTranscription) {
              currentTranscriptionRef.current.user += msg.serverContent.inputTranscription.text;
            }
            if (msg.serverContent?.outputTranscription) {
              currentTranscriptionRef.current.model += msg.serverContent.outputTranscription.text;
            }

            if (msg.serverContent?.turnComplete) {
              const userText = currentTranscriptionRef.current.user.trim();
              const modelText = currentTranscriptionRef.current.model.trim();
              
              if (userText) setTranscriptions(prev => [...prev, { role: 'user', text: userText }]);
              if (modelText) setTranscriptions(prev => [...prev, { role: 'model', text: modelText }]);
              
              currentTranscriptionRef.current = { user: '', model: '' };
            }
          },
          onerror: (e) => {
            console.error(e);
            setStatus('Error');
            stopSession();
          },
          onclose: () => {
            setIsActive(false);
            setStatus('Ready');
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction: `You are Lumen, a high-performance AI Lecture Assistant widget. 
          Your goal is to help students by:
          1. Transcribing the lecture clearly.
          2. Identifying and explaining complex terms.
          3. Summarizing key points as the lecture progresses.
          4. Answering questions about the current content or visuals provided via camera.
          Be concise, scholarly yet accessible, and helpful. You are running as a small widget, so keep responses brief unless asked for detail.`,
        }
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (err) {
      console.error(err);
      setStatus('Hardware Error');
    }
  };

  const stopSession = () => {
    sessionPromiseRef.current?.then(s => s.close());
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    setIsActive(false);
    setIsCameraActive(false);
    setStatus('Ready');
  };

  const toggleCamera = async () => {
    if (!isCameraActive) {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = videoStream;
          setIsCameraActive(true);

          frameIntervalRef.current = window.setInterval(() => {
            if (videoRef.current && canvasRef.current && isActive && sessionPromiseRef.current) {
              const ctx = canvasRef.current.getContext('2d');
              canvasRef.current.width = videoRef.current.videoWidth;
              canvasRef.current.height = videoRef.current.videoHeight;
              ctx?.drawImage(videoRef.current, 0, 0);
              canvasRef.current.toBlob(async (blob) => {
                if (blob) {
                  const data = await blobToBase64(blob);
                  sessionPromiseRef.current?.then(s => s.sendRealtimeInput({ 
                    video: { data, mimeType: 'image/jpeg' } 
                  }));
                }
              }, 'image/jpeg', JPEG_QUALITY);
            }
          }, 1000 / FRAME_RATE);
        }
      } catch (err) {
        console.error("Camera access failed", err);
      }
    } else {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      setIsCameraActive(false);
    }
  };

  const addInsight = (type: 'term' | 'summary' | 'action', title: string, content: string) => {
    setInsights(prev => [{ id: Date.now().toString(), type, title, content }, ...prev]);
  };

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcriptions]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex items-end justify-end p-6 font-sans">
      <AnimatePresence>
        {!isOpen ? (
          <motion.button
            key="launcher"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className="pointer-events-auto w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-2xl animate-float cursor-pointer relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-600 to-violet-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            <BrainCircuit size={32} className="relative z-10" />
            {isActive && (
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="absolute inset-0 bg-white rounded-full"
              />
            )}
          </motion.button>
        ) : (
          <motion.div
            key="widget"
            initial={{ y: 100, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 100, opacity: 0, scale: 0.9 }}
            className={cn(
              "pointer-events-auto bg-white rounded-[32px] shadow-2xl border border-slate-200 flex flex-col overflow-hidden transition-all duration-300",
              isMinimized ? "w-80 h-16" : "w-[400px] h-[600px]"
            )}
          >
            {/* Header */}
            <div className="h-16 px-6 flex items-center justify-between bg-slate-50/80 backdrop-blur-md border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center text-white transition-colors",
                  isActive ? "bg-indigo-600" : "bg-slate-400"
                )}>
                  <BrainCircuit size={18} />
                </div>
                <div>
                  <h1 className="text-sm font-bold text-slate-800 leading-none">Lumen AI</h1>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">{status}</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button onClick={() => setIsMinimized(!isMinimized)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors">
                  <Minus size={16} />
                </button>
                <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-rose-100 hover:text-rose-600 rounded-lg text-slate-400 transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Content Area */}
                <div className="flex-1 overflow-hidden flex flex-col">
                  {/* Tabs / Navigation */}
                  <div className="flex border-b border-slate-100">
                    <button className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-indigo-600 border-b-2 border-indigo-600">
                      Transcript
                    </button>
                    <button className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">
                      Insights
                    </button>
                  </div>

                  {/* Main Feed */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
                    {transcriptions.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 py-20">
                        <Mic size={40} strokeWidth={1.5} />
                        <p className="text-xs font-bold text-center px-12">Start the assistant to begin transcribing your lecture.</p>
                      </div>
                    ) : (
                      transcriptions.map((t, idx) => (
                        <motion.div 
                          key={idx} 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            "flex flex-col gap-1",
                            t.role === 'model' ? "items-end" : "items-start"
                          )}
                        >
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter px-1">
                            {t.role === 'user' ? 'Lecturer' : 'Lumen'}
                          </span>
                          <div className={cn(
                            "max-w-[90%] p-3 text-xs leading-relaxed rounded-2xl",
                            t.role === 'user' 
                              ? "bg-white border border-slate-100 text-slate-800 rounded-tl-none" 
                              : "bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-100"
                          )}>
                            {t.text}
                          </div>
                        </motion.div>
                      ))
                    )}
                    <div ref={transcriptEndRef} />
                  </div>
                </div>

                {/* Camera Overlay (Small) */}
                {isCameraActive && (
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute bottom-24 right-4 w-32 aspect-video bg-slate-900 rounded-xl overflow-hidden shadow-xl border-2 border-white"
                  >
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  </motion.div>
                )}

                {/* Footer Controls */}
                <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={toggleCamera}
                      className={cn(
                        "p-2.5 rounded-xl transition-all",
                        isCameraActive ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                      )}
                    >
                      {isCameraActive ? <Camera size={18} /> : <CameraOff size={18} />}
                    </button>
                    <button className="p-2.5 bg-slate-100 text-slate-400 hover:bg-slate-200 rounded-xl transition-all">
                      <Settings size={18} />
                    </button>
                  </div>

                  <button 
                    onClick={isActive ? stopSession : startSession}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-xs transition-all active:scale-95",
                      isActive 
                        ? "bg-rose-50 text-rose-600 border border-rose-100" 
                        : "bg-indigo-600 text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700"
                    )}
                  >
                    {isActive ? <StopCircle size={16} /> : <Play size={16} />}
                    {isActive ? 'Stop Session' : 'Start Assistant'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <canvas ref={canvasRef} className="hidden" />

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}} />
    </div>
  );
};

// Render App
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}

