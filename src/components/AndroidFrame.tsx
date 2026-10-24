import React from 'react';
import { Wifi, Signal, Battery, Smartphone, Monitor } from 'lucide-react';

interface AndroidFrameProps {
  isPhoneMode: boolean;
  onToggleMode: () => void;
  children: React.ReactNode;
}

export const AndroidFrame: React.FC<AndroidFrameProps> = ({
  isPhoneMode,
  onToggleMode,
  children,
}) => {
  const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (!isPhoneMode) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        {/* Floating Mode Switcher */}
        <div className="fixed bottom-4 right-4 z-50">
          <button
            onClick={onToggleMode}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-full shadow-2xl font-medium text-xs border border-teal-400/30 transition-all active:scale-95"
            title="Switch to Android Phone Preview"
          >
            <Smartphone className="w-4 h-4" />
            Switch to Android Phone View
          </button>
        </div>
        <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-6">{children}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 py-6 px-2 sm:px-4 flex flex-col items-center justify-center">
      {/* Mode Switcher Banner */}
      <div className="mb-4 flex items-center justify-between w-full max-w-md px-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-teal-400">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          Android 15 Native UI Simulator • Material 3
        </div>
        <button
          onClick={onToggleMode}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition-colors"
        >
          <Monitor className="w-3.5 h-3.5" />
          Full Width View
        </button>
      </div>

      {/* Android Device Shell */}
      <div className="relative w-full max-w-[430px] h-[890px] max-h-[94vh] bg-slate-900 rounded-[50px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_0_12px_#1e293b,0_0_0_14px_#334155] flex flex-col overflow-hidden border border-slate-700/60">
        {/* Android Status Bar */}
        <div className="h-10 w-full bg-slate-900/90 backdrop-blur-md text-slate-300 px-6 flex items-center justify-between text-xs z-40 select-none flex-shrink-0">
          <span className="font-semibold text-[13px]">{currentTime}</span>

          {/* Camera Punchhole */}
          <div className="w-4 h-4 bg-black rounded-full border border-slate-800 flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-slate-950 rounded-full" />
          </div>

          <div className="flex items-center gap-1.5">
            <Signal className="w-3.5 h-3.5" />
            <Wifi className="w-3.5 h-3.5" />
            <Battery className="w-4 h-4 text-emerald-400" />
          </div>
        </div>

        {/* Screen Content Scrollable Area */}
        <div className="flex-1 w-full overflow-y-auto bg-slate-950 text-slate-100 flex flex-col relative scrollbar-none">
          {children}
        </div>

        {/* Android Gesture Navigation Bar */}
        <div className="h-6 w-full bg-slate-900 flex items-center justify-center flex-shrink-0">
          <div className="w-32 h-1 bg-slate-400/60 rounded-full" />
        </div>
      </div>
    </div>
  );
};
