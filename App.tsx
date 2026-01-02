
import React, { useState, useEffect, useRef } from 'react';
import { Layout } from './components/Layout';
import { StepCard } from './components/StepCard';
import { RecipeDisplay } from './components/RecipeDisplay';
import { AppState, OnboardingData, Message } from './types';
import { LANGUAGES, INTERACTION_MODES, EXPERIENCE_LEVELS } from './constants';
import { chatWithGemini, analyzeIngredientsImage, speakText, connectLiveSession, stopAllSpeech } from './geminiService';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(AppState.ONBOARDING);
  const [onboarding, setOnboarding] = useState<OnboardingData>({
    language: '',
    interactionMode: 'Both' as any,
    experience: 'Beginner' as any,
  });
  const [currentOnboardingStep, setCurrentOnboardingStep] = useState(0);
  const [history, setHistory] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [liveUserText, setLiveUserText] = useState('');
  const [liveModelText, setLiveModelText] = useState('');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const liveSessionRef = useRef<any>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, liveUserText, liveModelText]);

  const toggleVoiceChat = async () => {
    if (isVoiceActive) {
      if (liveSessionRef.current) {
        liveSessionRef.current.close();
      }
      stopAllSpeech();
      setIsVoiceActive(false);
      setState(AppState.FLOW_1_TYPE);
    } else {
      await stopAllSpeech();
      setIsVoiceActive(true);
      setState(AppState.VOICE_MODE);
      setLiveUserText('');
      setLiveModelText('');
      try {
        liveSessionRef.current = await connectLiveSession({
          onMessagePart: (text, isModel) => {
            if (isModel) setLiveModelText(prev => prev + text);
            else setLiveUserText(prev => prev + text);
          },
          onTurnComplete: (fullModelText) => {
            if (fullModelText.trim()) {
              addModelMessage(fullModelText, true);
              setLiveModelText('');
              setLiveUserText('');
            }
          },
          onAudioStart: () => {},
          onClose: () => setIsVoiceActive(false)
        });
      } catch (err) {
        console.error("Mic error:", err);
        setIsVoiceActive(false);
        setState(AppState.CHOOSING_FLOW);
        alert("Please allow microphone access to use voice chat.");
      }
    }
  };

  const handleOnboardingSelect = (field: keyof OnboardingData, value: string) => {
    setOnboarding(prev => ({ ...prev, [field]: value }));
    if (currentOnboardingStep < 2) {
      setCurrentOnboardingStep(s => s + 1);
    } else {
      setState(AppState.CHOOSING_FLOW);
    }
  };

  const startFlow = (choice: 1 | 2) => {
    stopAllSpeech();
    if (choice === 1) {
      setState(AppState.FLOW_1_TYPE);
      addModelMessage("Wonderful! What kind of food do you want to make today? \n\n• Sweet \n• Spicy \n• Healthy \n• Quick \n• Kids-friendly \n• Festival Special \n• Comfort Food");
    } else {
      setState(AppState.FLOW_2_PREFERENCES);
      addModelMessage("I'd love to suggest something! First, how much time do you have? \n\n• 10 minutes \n• 20 minutes \n• 30+ minutes");
    }
  };

  const addModelMessage = (text: string, skipSpeech: boolean = false) => {
    const isRecipe = text.includes('🍽️') && text.includes('🧺');
    setHistory(prev => [...prev, { role: 'model', text, isRecipe }]);
    if (!skipSpeech && !isVoiceActive && onboarding.interactionMode !== 'Text' && !isRecipe) {
      speakText(text);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const userText = inputText;
    setInputText('');
    setHistory(prev => [...prev, { role: 'user', text: userText }]);
    setLoading(true);

    try {
      const response = await chatWithGemini([
        ...history,
        { role: 'user', text: userText }
      ]);
      addModelMessage(response || "I'm sorry, I didn't quite catch that. Can you say it again?");
    } catch (err) {
      addModelMessage("Oh dear, something went wrong. Let's try that again.");
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1];
      setHistory(prev => [...prev, { role: 'user', text: "Mummy, please check these items for me!", image: reader.result as string }]);
      try {
        const ingredients = await analyzeIngredientsImage(base64);
        addModelMessage(`I found these in your kitchen: \n• ${ingredients.split(',').join('\n• ')} \n\nShall we use these to cook something tasty?`);
      } catch (err) {
        addModelMessage("I couldn't quite see the ingredients. Could you try a clearer photo, Mummy?");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const renderOnboardingStep = () => {
    switch (currentOnboardingStep) {
      case 0: return <StepCard title="1️⃣ Preferred Language" options={LANGUAGES} onSelect={(v) => handleOnboardingSelect('language', v)} />;
      case 1: return <StepCard title="2️⃣ Interaction Mode" options={INTERACTION_MODES} onSelect={(v) => handleOnboardingSelect('interactionMode', v as any)} />;
      case 2: return <StepCard title="3️⃣ Your Cooking Skill" options={EXPERIENCE_LEVELS} onSelect={(v) => handleOnboardingSelect('experience', v as any)} />;
      default: return null;
    }
  };

  const renderMessageContent = (msg: Message) => {
    if (msg.isRecipe) {
      return <RecipeDisplay text={msg.text} />;
    }
    
    const lines = msg.text.split('\n');
    return (
      <div className="space-y-3">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} className="h-1" />;
          const isBullet = trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.match(/^\d+\./);
          return (
            <div key={idx} className={`text-base font-bold leading-relaxed ${isBullet ? 'flex items-start gap-3 pl-2' : ''}`}>
              {isBullet && <span className="text-orange-500 select-none">•</span>}
              <span className="flex-1">{trimmed.replace(/^[•\-\d.]+\s*/, '')}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Layout>
      {state === AppState.ONBOARDING && (
        <div className="flex flex-col items-center animate-fadeIn">
          <div className="bg-orange-100 border-2 border-orange-200 p-6 rounded-2xl mb-8 text-gray-900 text-center font-bold text-lg shadow-md">
            "Namaste Mummy! Let's start cooking!" 🍲✨
          </div>
          {renderOnboardingStep()}
        </div>
      )}

      {state === AppState.CHOOSING_FLOW && (
        <div className="flex flex-col gap-6 animate-fadeIn mt-6">
          <h2 className="text-xl font-bold text-gray-900 text-center">What are we cooking, Mum?</h2>
          <button onClick={() => startFlow(1)} className="bg-white border-4 border-orange-500 p-8 rounded-3xl shadow-lg hover:scale-[1.02] transition-all flex flex-col items-center gap-4 group active:scale-95 border-b-8 active:border-b-4">
            <span className="text-6xl group-hover:rotate-6 transition-transform">🥘</span>
            <span className="text-lg font-black text-orange-950 uppercase">I Know The Dish</span>
          </button>
          <button onClick={() => startFlow(2)} className="bg-orange-600 p-8 rounded-3xl shadow-lg hover:scale-[1.02] transition-all text-white flex flex-col items-center gap-4 group active:scale-95 border-b-8 border-orange-800 active:border-b-4">
            <span className="text-6xl group-hover:scale-110 transition-transform">🪄</span>
            <span className="text-lg font-black uppercase">Suggest For Me</span>
          </button>
        </div>
      )}

      {state === AppState.VOICE_MODE && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 animate-fadeIn bg-orange-50/50 rounded-3xl p-6 my-4 border-2 border-orange-100">
          <div className="relative">
            <div className="absolute inset-0 bg-orange-500 rounded-full animate-ping opacity-20"></div>
            <div className="bg-orange-600 p-12 rounded-full shadow-lg relative border-4 border-white">
              <span className="text-5xl">🎙️</span>
            </div>
          </div>
          
          <div className="w-full space-y-4">
            <div className="bg-white p-4 rounded-xl border border-orange-100 shadow-sm min-h-[80px]">
              <span className="text-[10px] font-black text-orange-600 uppercase mb-1 block">You Said:</span>
              <p className="text-base font-bold text-gray-800 italic leading-tight">{liveUserText || "..."}</p>
            </div>
            <div className="bg-orange-600 p-5 rounded-2xl shadow-md min-h-[140px] overflow-y-auto">
              <span className="text-[10px] font-black text-white/70 uppercase mb-1 block">Replying:</span>
              <p className="text-lg font-bold text-white leading-tight">{liveModelText || "I'm listening, Mummy..."}</p>
            </div>
          </div>

          <button 
            onClick={toggleVoiceChat} 
            className="bg-red-600 text-white w-full py-4 rounded-2xl font-bold text-lg shadow-lg hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center gap-3 border-2 border-white"
          >
            <span>🛑</span> STOP VOICE CHAT
          </button>
        </div>
      )}

      {(state !== AppState.ONBOARDING && state !== AppState.CHOOSING_FLOW && state !== AppState.VOICE_MODE) && (
        <div className="flex-1 flex flex-col w-full h-[calc(100vh-200px)] mt-4">
          <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-8 px-2 pb-8 custom-scrollbar">
            {history.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slideUp`}>
                <div className={`max-w-[95%] rounded-2xl shadow-md overflow-hidden ${
                  msg.role === 'user' 
                    ? 'bg-orange-600 text-white p-5 rounded-tr-none border-b-4 border-orange-800' 
                    : 'bg-white border-2 border-orange-50 text-gray-900 rounded-tl-none border-b-4 border-gray-100'
                }`}>
                  {msg.image && <img src={msg.image} className="w-full h-48 object-cover rounded-xl mb-4 border border-orange-100 shadow-sm" />}
                  <div className={msg.role === 'model' ? 'p-1' : ''}>
                    {renderMessageContent(msg)}
                    {msg.role === 'model' && !msg.isRecipe && (
                      <button 
                        onClick={() => speakText(msg.text)} 
                        className="mt-4 py-2 px-6 bg-orange-100 rounded-full text-sm font-bold text-orange-800 flex items-center gap-2 hover:bg-orange-200 transition-all border border-orange-300 active:scale-95"
                      >
                        <span className="text-base">🔊</span> Read Aloud
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border-2 border-orange-50 p-4 rounded-2xl flex items-center gap-3 shadow-md">
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce delay-100"></div>
                  <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce delay-200"></div>
                  <span className="text-orange-950 font-bold text-sm italic">Just a moment...</span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-auto flex flex-col gap-4 pt-2">
            <div className="bg-white rounded-3xl shadow-xl p-2 border-2 border-orange-100 flex items-center gap-2">
              <label className="p-3 text-orange-600 hover:bg-orange-50 rounded-full cursor-pointer transition-colors text-2xl shadow-inner border border-orange-50" title="Show ingredients">
                📸
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
              <input 
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Ask your helper Mummy..."
                className="flex-1 bg-transparent py-2 focus:outline-none text-gray-800 font-bold text-base placeholder:text-gray-300"
              />
              <button 
                onClick={toggleVoiceChat} 
                className="p-3 bg-orange-600 text-white rounded-full hover:bg-orange-700 transition-all text-2xl shadow-md border-2 border-white active:scale-95" 
                title="Speak to me"
              >
                🎙️
              </button>
              <button 
                onClick={handleSend} 
                disabled={loading || !inputText.trim()} 
                className="bg-orange-600 text-white p-3 rounded-2xl hover:bg-orange-700 disabled:opacity-50 transition-all shadow-md active:scale-95 border-b-4 border-orange-800"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <button 
              onClick={() => { if(confirm("Mummy, want to clear and start new?")) { stopAllSpeech(); setHistory([]); setState(AppState.CHOOSING_FLOW); } }} 
              className="text-[10px] font-black text-gray-400 hover:text-orange-600 uppercase tracking-widest bg-white px-4 py-2 rounded-full border border-gray-100 shadow-sm mx-auto transition-all active:scale-95"
            >
              🔄 RESET
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
