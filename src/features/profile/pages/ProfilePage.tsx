import React, { useEffect, useState } from 'react';
import { Cpu, Zap, Info, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import { useNavigation } from '../../../core/navigation';
import { VaultHeader } from '../../vault/components/VaultHeader';

interface AiServiceDetail {
  connected: boolean | null;
  model: string;
}

export const ProfilePage: React.FC = () => {
  const { navigate } = useNavigation();
  const [aiServices, setAiServices] = useState<{
    gemini: {
      connected: boolean | null;
      keysConfigured: number;
      hasBackupKey: boolean;
      model: string;
    };
    groq: AiServiceDetail;
  }>({
    gemini: { connected: null, keysConfigured: 0, hasBackupKey: false, model: 'gemini-3.6-flash' },
    groq: { connected: null, model: 'llama-3.3-70b-versatile' },
  });

  useEffect(() => {
    let isMounted = true;

    // Helper to safely get client env vars
    const getClientEnv = (key: string): string => {
      const metaEnv = (import.meta as any).env;
      if (metaEnv && metaEnv[key]) return metaEnv[key];
      if (typeof process !== 'undefined' && process.env && process.env[key]) {
        return process.env[key] || '';
      }
      return '';
    };

    // Check client-side env vars & local storage as fallback
    const hasClientGemini = Boolean(
      getClientEnv('VITE_GEMINI_API_KEY') ||
      getClientEnv('GEMINI_API_KEY') ||
      localStorage.getItem('noesis_gemini_api_key')
    );
    const hasClientGroq = Boolean(
      getClientEnv('VITE_GROQ_API_KEY') ||
      getClientEnv('GROQ_API_KEY') ||
      localStorage.getItem('noesis_groq_api_key')
    );

    fetch('/api/ai-status')
      .then((res) => {
        if (!res.ok) throw new Error('HTTP error');
        return res.json();
      })
      .then((data) => {
        if (isMounted && data) {
          const geminiConnected = data.gemini?.connected === true || hasClientGemini;
          const groqConnected = data.groq?.connected === true || hasClientGroq;

          setAiServices({
            gemini: {
              connected: geminiConnected,
              keysConfigured: data.gemini?.keysConfigured || (hasClientGemini ? 1 : 0),
              hasBackupKey: data.gemini?.hasBackupKey === true,
              model: data.gemini?.model || 'gemini-3.6-flash',
            },
            groq: {
              connected: groqConnected,
              model: data.groq?.model || 'llama-3.3-70b-versatile',
            },
          });
        }
      })
      .catch(() => {
        if (isMounted) {
          setAiServices({
            gemini: {
              connected: hasClientGemini,
              keysConfigured: hasClientGemini ? 1 : 0,
              hasBackupKey: false,
              model: 'gemini-3.6-flash',
            },
            groq: { connected: hasClientGroq, model: 'llama-3.3-70b-versatile' },
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const renderStatusBadge = (connected: boolean | null) => {
    if (connected === true) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#10B981]/15 text-[#34D399] border border-[#10B981]/30">
          <CheckCircle2 className="w-3 h-3 shrink-0" />
          Connected
        </span>
      );
    }
    if (connected === false) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#EF4444]/15 text-[#F87171] border border-[#EF4444]/30">
          <XCircle className="w-3 h-3 shrink-0" />
          Not Connected
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#2A2A2A] text-[#A3A3A3] border border-[#383838]">
        <HelpCircle className="w-3 h-3 shrink-0" />
        Unknown
      </span>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#131313] text-[#E5E5E5] animate-in fade-in duration-200">
      {/* Self-contained Header with Back button only */}
      <VaultHeader onBack={() => navigate({ tab: 'chat' })} />

      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto px-4 pt-8 pb-12 select-none">
        <div className="max-w-md mx-auto space-y-6">
        {/* 1. Noesis Identity Section */}
        <section className="text-center space-y-3">
          <img
            src="/logo-dark-kotak.webp"
            alt="Noesis Logo"
            className="w-14 h-14 mx-auto object-contain"
          />

          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-[#E5E5E5] tracking-tight">Noesis</h1>
            <p className="text-xs font-semibold text-[#A3A3A3] uppercase tracking-wider">
              Personal Knowledge System
            </p>
          </div>

          <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-2xl p-4 text-center my-3 space-y-1">
            <p className="text-xs font-medium italic text-[#E5E5E5] leading-snug">
              &quot;Organize knowledge.&quot;
            </p>
            <p className="text-xs font-medium italic text-[#E5E5E5] leading-snug">
              &quot;Build understanding.&quot;
            </p>
            <p className="text-xs font-medium italic text-[#E5E5E5] leading-snug">
              &quot;Create insights.&quot;
            </p>
          </div>
        </section>

        {/* 2. AI Services Status Section */}
        <section className="space-y-2.5">
          <h2 className="text-xs font-semibold text-[#A3A3A3] uppercase tracking-wider flex items-center gap-1.5 px-1">
            <Zap className="w-3.5 h-3.5 text-[#A3A3A3]" />
            Status Layanan AI
          </h2>

          <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-2xl p-4 space-y-4 shadow-sm">
            {/* Gemini */}
            <div className="space-y-3 pb-3 border-b border-[#2A2A2A]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#242424] border border-[#303030] flex items-center justify-center text-[#E5E5E5]">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-[#E5E5E5]">Gemini AI Service</h3>
                </div>
              </div>

              <div className="space-y-2 pl-9">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#A3A3A3]">🔑 Primary Key:</span>
                  {renderStatusBadge(aiServices.gemini.connected)}
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#A3A3A3]">🔑 Secondary Key (Backup):</span>
                  {aiServices.gemini.hasBackupKey ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#10B981]/15 text-[#34D399] border border-[#10B981]/30">
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                      Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#2A2A2A] text-[#8E8E93] border border-[#383838]">
                      Not Configured
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Groq */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#242424] border border-[#303030] flex items-center justify-center text-[#E5E5E5]">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-[#E5E5E5]">Groq</h3>
                  </div>
                </div>
                {renderStatusBadge(aiServices.groq.connected)}
              </div>
            </div>
          </div>
        </section>

        {/* 3. About Noesis Section */}
        <section className="space-y-2.5">
          <h2 className="text-xs font-semibold text-[#A3A3A3] uppercase tracking-wider flex items-center gap-1.5 px-1">
            <Info className="w-3.5 h-3.5 text-[#A3A3A3]" />
            Tentang Noesis
          </h2>

          <div className="bg-[#1C1C1C] border border-[#2A2A2A] rounded-2xl p-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#2A2A2A]">
              <span className="text-[#A3A3A3]">Name</span>
              <span className="font-semibold text-[#E5E5E5]">Noesis</span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-[#2A2A2A]">
              <span className="text-[#A3A3A3]">Category</span>
              <span className="font-medium text-[#E5E5E5]">Personal Knowledge System</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[#A3A3A3]">Version</span>
              <span className="font-mono text-[11px] text-[#CCCCCC] bg-[#242424] px-2 py-0.5 rounded-md border border-[#303030]">
                2.0.0
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
    </div>
  );
};
