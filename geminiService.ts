
import { GoogleGenAI, Type, Modality, LiveServerMessage } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "./constants";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

// Global Audio Management
let globalAudioCtx: AudioContext | null = null;
const activeSources = new Set<AudioBufferSourceNode>();

function getAudioContext() {
  if (!globalAudioCtx || globalAudioCtx.state === 'closed') {
    globalAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return globalAudioCtx;
}

export async function stopAllSpeech() {
  activeSources.forEach(source => {
    try {
      source.stop();
    } catch (e) {
      // Source might already be stopped
    }
  });
  activeSources.clear();
}

export async function chatWithGemini(messages: { role: string; text: string }[], systemInstructionOverride?: string) {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: messages.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
    config: {
      systemInstruction: systemInstructionOverride || SYSTEM_INSTRUCTION,
      temperature: 0.7,
    }
  });
  return response.text;
}

export async function analyzeIngredientsImage(base64Image: string) {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
        { text: "Identify all the cooking ingredients in this image. List them as a comma-separated string." }
      ]
    },
    config: {
      systemInstruction: "You are a helpful kitchen assistant identifying ingredients.",
    }
  });
  return response.text;
}

export async function speakText(text: string) {
  // Clear any existing audio before starting new TTS
  await stopAllSpeech();
  
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      const audioData = decode(base64Audio);
      const ctx = getAudioContext();
      const audioBuffer = await decodeAudioData(audioData, ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      
      source.onended = () => activeSources.delete(source);
      activeSources.add(source);
      
      source.start();
      return true;
    }
  } catch (error) {
    console.error("TTS Error:", error);
  }
  return false;
}

// LIVE API Implementation
export async function connectLiveSession(callbacks: {
  onMessagePart: (text: string, isModel: boolean) => void;
  onTurnComplete: (fullText: string) => void;
  onAudioStart: () => void;
  onClose: () => void;
}) {
  // Stop any existing TTS or other audio before starting Live session
  await stopAllSpeech();
  
  const ai = getAI();
  let nextStartTime = 0;
  const audioCtx = getAudioContext();
  let accumulatedModelText = '';

  const sessionPromise = ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    callbacks: {
      onopen: () => console.log("Live session opened"),
      onmessage: async (message: LiveServerMessage) => {
        // Handle Audio
        const audioBase64 = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
        if (audioBase64) {
          nextStartTime = Math.max(nextStartTime, audioCtx.currentTime);
          const buffer = await decodeAudioData(decode(audioBase64), audioCtx, 24000, 1);
          const source = audioCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(audioCtx.destination);
          
          source.onended = () => activeSources.delete(source);
          activeSources.add(source);

          source.start(nextStartTime);
          nextStartTime += buffer.duration;
          callbacks.onAudioStart();
        }

        // Handle Transcriptions
        if (message.serverContent?.outputTranscription) {
          const text = message.serverContent.outputTranscription.text;
          accumulatedModelText += text;
          callbacks.onMessagePart(text, true);
        } else if (message.serverContent?.inputTranscription) {
          callbacks.onMessagePart(message.serverContent.inputTranscription.text, false);
        }

        const partText = message.serverContent?.modelTurn?.parts[0]?.text;
        if (partText) {
          accumulatedModelText += partText;
          callbacks.onMessagePart(partText, true);
        }

        if (message.serverContent?.turnComplete) {
          callbacks.onTurnComplete(accumulatedModelText);
          accumulatedModelText = '';
        }

        if (message.serverContent?.interrupted) {
          await stopAllSpeech();
          nextStartTime = 0;
          accumulatedModelText = '';
        }
      },
      onclose: () => {
        stopAllSpeech();
        callbacks.onClose();
      },
      onerror: (e) => {
        console.error("Live error", e);
        stopAllSpeech();
      },
    },
    config: {
      responseModalities: [Modality.AUDIO],
      systemInstruction: SYSTEM_INSTRUCTION,
      outputAudioTranscription: {},
      inputAudioTranscription: {},
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
      }
    }
  });

  // Microphone stream
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const inputCtx = new AudioContext({ sampleRate: 16000 });
  const source = inputCtx.createMediaStreamSource(stream);
  const processor = inputCtx.createScriptProcessor(4096, 1, 1);
  
  processor.onaudioprocess = (e) => {
    const inputData = e.inputBuffer.getChannelData(0);
    const pcm = new Int16Array(inputData.length);
    for (let i = 0; i < inputData.length; i++) pcm[i] = inputData[i] * 32768;
    sessionPromise.then(s => s.sendRealtimeInput({ 
      media: { data: encode(new Uint8Array(pcm.buffer)), mimeType: 'audio/pcm;rate=16000' } 
    }));
  };

  source.connect(processor);
  processor.connect(inputCtx.destination);

  return {
    close: () => {
      stream.getTracks().forEach(t => t.stop());
      inputCtx.close();
      sessionPromise.then(s => {
        try { s.close(); } catch(e) {}
      });
      stopAllSpeech();
    }
  };
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
}
