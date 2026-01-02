
import React from 'react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col items-center p-4 max-w-md mx-auto relative pb-24">
      <header className="w-full text-center mb-6 pt-4">
        <h1 className="text-2xl font-bold text-orange-600 drop-shadow-sm flex items-center justify-center gap-2 mb-1">
          <span>🥘</span> Maa Ki Rasoi
        </h1>
        <p className="text-gray-600 text-sm font-semibold">Cooking with Love, Step-by-Step</p>
      </header>
      <main className="w-full flex-1 flex flex-col">
        {children}
      </main>
    </div>
  );
};
