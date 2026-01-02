
import React from 'react';

export const RecipeDisplay: React.FC<{ text: string }> = ({ text }) => {
  const sections = text.split(/(?=🍽️|⏱️|🧺|🔥|👩‍🍳|⚠️|🍛|🧊|🥗|YouTube search text:)/g);

  const formatSection = (title: string, content: string) => {
    const lines = content.trim().split('\n').filter(l => l.trim() !== '');
    
    if (title.toLowerCase().includes('youtube search text:')) {
      const searchQuery = content.split(':')[1]?.trim().replace(/"/g, '');
      const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
      return (
        <div className="my-6 bg-red-50 rounded-2xl p-6 shadow-md flex flex-col items-center text-center gap-4 border-2 border-red-200">
          <div className="text-4xl text-red-600">📺</div>
          <div className="space-y-1">
            <h4 className="text-lg font-black text-red-800 uppercase tracking-wide">Watch Step-by-Step Video</h4>
            <p className="text-red-700 text-sm font-medium">Follow along with a helpful video guide!</p>
          </div>
          <a 
            href={youtubeUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-red-600 text-white w-full py-3 rounded-full font-bold text-base shadow-lg hover:bg-red-700 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            <span>▶️</span> OPEN VIDEO ON YOUTUBE
          </a>
        </div>
      );
    }

    if (title.includes('🧺')) {
      return (
        <div className="bg-orange-50 rounded-2xl p-6 border-2 border-orange-100 shadow-inner my-6">
          <h4 className="text-xl font-bold text-orange-950 mb-4 flex items-center gap-2">
            <span>🧺</span> Ingredients
          </h4>
          <ul className="space-y-3">
            {lines.slice(1).map((l, i) => {
              const parts = l.split(/(?=💡|Substitute:)/i);
              const mainIngredient = parts[0].replace(/^[•\-\d.]+\s*/, '').trim();
              const substitute = parts.slice(1).join(' ').trim();
              
              return (
                <li key={i} className="flex flex-col gap-2 bg-white p-4 rounded-xl shadow-sm border border-orange-100">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" className="w-5 h-5 accent-orange-600 rounded cursor-pointer" />
                    <span className="text-base font-bold text-gray-800">{mainIngredient}</span>
                  </div>
                  {substitute && (
                    <div className="ml-8 p-2 bg-yellow-50 rounded-lg border border-yellow-100">
                      <p className="text-xs font-bold text-orange-900 flex items-start gap-2">
                        <span className="text-sm">💡</span>
                        <span>{substitute.replace(/Substitute:/i, '').trim()}</span>
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      );
    }

    if (title.includes('🔥')) {
      return (
        <div className="my-8">
          <h4 className="text-xl font-bold text-orange-950 mb-6 flex items-center gap-2">
            <span>🔥</span> Steps
          </h4>
          <div className="space-y-4">
            {lines.slice(1).map((l, i) => {
              const cleanStep = l.replace(/^[•\-\d.]+\s*/, '');
              const isWarning = cleanStep.toLowerCase().includes('caution') || 
                               cleanStep.toLowerCase().includes('careful') || 
                               cleanStep.toLowerCase().includes('cooker') ||
                               cleanStep.toLowerCase().includes('hot oil');
              return (
                <div key={i} className={`p-5 rounded-2xl border-l-8 shadow-sm ${isWarning ? 'bg-red-50 border-red-500' : 'bg-white border-orange-500'}`}>
                  <div className="flex items-start gap-4">
                    <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm text-white shadow-sm ${isWarning ? 'bg-red-500' : 'bg-orange-500'}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      {isWarning && <p className="text-red-600 font-bold text-xs mb-1">⚠️ Safety Warning</p>}
                      <p className="text-base font-medium leading-relaxed text-gray-900">{cleanStep}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (title.includes('🍽️')) {
      return (
        <div className="text-center mb-8 bg-orange-600 text-white p-6 rounded-2xl shadow-lg">
          <h2 className="text-2xl font-black leading-tight tracking-tight">{content.replace('🍽️', '').trim()}</h2>
        </div>
      );
    }

    const cleanTitle = title.replace(/[0-9.]/g, '').trim();

    return (
      <div className="mb-6 p-5 rounded-2xl border border-orange-50 bg-white shadow-sm">
        <h4 className="text-lg font-bold text-orange-800 mb-3 flex items-center gap-2">
          {cleanTitle}
        </h4>
        <ul className="space-y-2">
          {lines.slice(1).map((line, idx) => (
            <li key={idx} className="flex items-start gap-2 text-sm font-medium text-gray-700 leading-snug">
              <span className="text-orange-400 font-bold">•</span>
              <span>{line.replace(/^[•\-\d.]+\s*/, '').trim()}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="recipe-container animate-fadeIn w-full overflow-hidden p-1">
      {sections.map((sec, idx) => {
        const titleMatch = sec.match(/^(🍽️|⏱️|🧺|🔥|👩‍🍳|⚠️|🍛|🧊|🥗|YouTube search text:)/i);
        if (!titleMatch) return null;
        return <div key={idx}>{formatSection(titleMatch[0], sec)}</div>;
      })}
    </div>
  );
};
