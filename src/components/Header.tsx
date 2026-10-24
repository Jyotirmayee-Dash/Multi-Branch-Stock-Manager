import React from 'react';
import {
  Building2,
  Bell,
  Shield,
  Smartphone,
  Monitor,
  RefreshCw,
  ShoppingCart,
  Database,
  ChevronDown,
  LogOut,
} from 'lucide-react';
import { Branch, UserProfile, UserRole } from '../types';

interface HeaderProps {
  branches: Branch[];
  selectedBranchId: string;
  onSelectBranch: (id: string) => void;
  currentUser: UserProfile;
  onChangeRole: (role: UserRole) => void;
  alertCount: number;
  isPhoneMode: boolean;
  onTogglePhoneMode: () => void;
  onOpenSaleModal: () => void;
  onReseedData: () => void;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onSignOut?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  branches,
  selectedBranchId,
  onSelectBranch,
  currentUser,
  onChangeRole,
  alertCount,
  isPhoneMode,
  onTogglePhoneMode,
  onOpenSaleModal,
  onReseedData,
  activeTab,
  onSelectTab,
  onSignOut,
}) => {
  return (
    <header className="bg-slate-900/90 border-b border-slate-800/80 sticky top-0 z-30 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Branding & Branch Selector */}
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          <div
            onClick={() => onSelectTab('dashboard')}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-400 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-teal-500/20 group-hover:scale-105 transition-transform">
              SP
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-base tracking-tight text-white">StockPulse</span>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 bg-teal-950 text-teal-400 rounded border border-teal-800/60">
                  Android M3
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium">Multi-Branch Manager</div>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-800 hidden sm:block" />

          {/* Branch Selector Dropdown (Requirement 1 & 2) */}
          <div className="relative flex items-center gap-1.5 bg-slate-950/80 border border-slate-700/80 rounded-2xl px-3 py-1.5">
            <Building2 className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
            <select
              value={selectedBranchId}
              onChange={(e) => onSelectBranch(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer pr-1"
            >
              <option value="all" className="bg-slate-900 text-teal-300 font-bold">
                Consolidated (All Branches)
              </option>
              {branches.map((b) => (
                <option key={b.id} value={b.id} className="bg-slate-900 text-slate-200">
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Role Switcher, Alerts, Actions */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Role Switcher (Test role permissions easily) */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-700/80 rounded-2xl px-2.5 py-1">
            <Shield className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-[11px] text-slate-400 hidden sm:inline">Role:</span>
            <select
              value={currentUser.role}
              onChange={(e) => onChangeRole(e.target.value as UserRole)}
              className="bg-transparent text-xs font-bold text-sky-300 focus:outline-none cursor-pointer"
            >
              <option value="owner" className="bg-slate-900">Owner (Global)</option>
              <option value="manager" className="bg-slate-900">Branch Manager</option>
              <option value="staff" className="bg-slate-900">Staff (Sales Only)</option>
            </select>
          </div>

          {/* Alert Bell */}
          <button
            onClick={() => onSelectTab('alerts')}
            className="relative p-2 text-slate-300 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            title="Stock Alerts"
          >
            <Bell className="w-4 h-4" />
            {alertCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse">
                {alertCount}
              </span>
            )}
          </button>

          {/* Device Viewport Mode Toggle */}
          <button
            onClick={onTogglePhoneMode}
            className="p-2 text-slate-300 hover:text-teal-400 rounded-xl hover:bg-slate-800 transition-colors hidden sm:flex items-center gap-1 text-xs font-medium"
            title={isPhoneMode ? 'Expand to Desktop View' : 'Simulate Android Phone'}
          >
            {isPhoneMode ? <Monitor className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
          </button>

          {/* Reset / Seed Button */}
          <button
            onClick={onReseedData}
            className="p-2 text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800 transition-colors"
            title="Reset to Sample Auto Parts Dataset"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Sign Out Button */}
          {onSignOut && (
            <button
              onClick={onSignOut}
              className="p-2 text-slate-400 hover:text-rose-400 rounded-xl hover:bg-slate-800 transition-colors"
              title="Sign Out of StockPulse"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Quick Record Sale Button */}
          <button
            onClick={onOpenSaleModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-900/30 transition-all active:scale-95"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Record Sale</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs (Material 3 Style) */}
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-2 overflow-x-auto pb-2 pt-1 border-t border-slate-800/40 scrollbar-none text-xs">
        {[
          { id: 'dashboard', label: 'Dashboard' },
          { id: 'inventory', label: 'Inventory & Search' },
          { id: 'alerts', label: `Alerts ${alertCount > 0 ? `(${alertCount})` : ''}` },
          { id: 'transactions', label: 'Transactions' },
          { id: 'branches', label: 'Branches & Users' },
          { id: 'code', label: 'Android Kotlin & Backend Code' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id)}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </header>
  );
};
