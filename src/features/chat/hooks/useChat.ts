import { useState, useEffect, useCallback } from 'react';
import { Message, ChatThread, AISettings } from '../../../shared/types';
import { ragRouter } from '../../../core/rag/ragRouter';

const THREADS_STORAGE_KEY = 'noesis_v2_chat_threads';
const ACTIVE_THREAD_KEY = 'noesis_v2_active_thread';
const AI_SETTINGS_KEY = 'noesis_v2_ai_settings';

const DEFAULT_SETTINGS: AISettings = {
  model: 'gemini-3.6-flash',
  memoryEnabled: true,
  ragEnabled: true,
  ragMode: 'smart',
  searchMethod: 'hybrid',
  topKChunks: 5,
  similarityThreshold: 0,
  categoryFilter: 'all',
  tagFilter: 'all',
  contextSources: ['vault', 'workspace'],
  customInstructions: 'Jawab dengan bahasa Indonesia yang jelas, ringkas, dan terstruktur dengan rapi.',
};

export function useChat() {
  const [threads, setThreads] = useState<ChatThread[]>(() => {
    try {
      const saved = localStorage.getItem(THREADS_STORAGE_KEY);
      if (saved) {
        const parsed: ChatThread[] = JSON.parse(saved);
        // Filter out old sample/dummy threads if they exist in localStorage
        return parsed.filter((t) => t.id !== 'thread_1' && t.id !== 'thread_2');
      }
      return [];
    } catch (e) {
      console.error('Failed to parse saved chat threads', e);
      return [];
    }
  });

  const [activeThreadId, setActiveThreadId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_THREAD_KEY);
      if (saved && threads.some((t) => t.id === saved)) {
        return saved;
      }
      return threads[0]?.id || '';
    } catch (e) {
      return threads[0]?.id || '';
    }
  });

  const [aiSettings, setAiSettings] = useState<AISettings>(() => {
    try {
      const saved = localStorage.getItem(AI_SETTINGS_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync threads to storage
  useEffect(() => {
    try {
      localStorage.setItem(THREADS_STORAGE_KEY, JSON.stringify(threads));
    } catch (e) {
      console.error('Failed to save threads', e);
    }
  }, [threads]);

  // Sync active thread to storage
  useEffect(() => {
    try {
      if (activeThreadId) {
        localStorage.setItem(ACTIVE_THREAD_KEY, activeThreadId);
      }
    } catch (e) {
      console.error('Failed to save active thread ID', e);
    }
  }, [activeThreadId]);

  // Sync settings to storage
  useEffect(() => {
    try {
      localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(aiSettings));
    } catch (e) {
      console.error('Failed to save AI settings', e);
    }
  }, [aiSettings]);

  // Get current active thread
  const activeThread = threads.find((t) => t.id === activeThreadId) || threads[0];
  const messages = activeThread ? activeThread.messages : [];

  // Create a new thread
  const createNewThread = useCallback(() => {
    const newThreadId = `thread_${Date.now()}`;
    const newThread: ChatThread = {
      id: newThreadId,
      title: 'Obrolan Baru',
      createdAt: Date.now(),
      lastUpdated: Date.now(),
      messages: [],
    };

    setThreads((prev) => [newThread, ...prev]);
    setActiveThreadId(newThreadId);
    setError(null);
  }, []);

  // Send message in current thread
  const handleSendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      setError(null);
      let currentId = activeThreadId;

      // If no active thread or threads array is empty, create one
      if (!currentId || !threads.some((t) => t.id === currentId)) {
        const newId = `thread_${Date.now()}`;
        const newThread: ChatThread = {
          id: newId,
          title: trimmed.length > 25 ? trimmed.substring(0, 25) + '...' : trimmed,
          createdAt: Date.now(),
          lastUpdated: Date.now(),
          messages: [],
        };
        setThreads((prev) => [newThread, ...prev]);
        setActiveThreadId(newId);
        currentId = newId;
      }

      const userMsgId = `user_${Date.now()}`;
      const userMessage: Message = {
        id: userMsgId,
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
        status: 'sent',
      };

      const aiMsgId = `ai_${Date.now()}`;
      const aiMessagePlaceholder: Message = {
        id: aiMsgId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        status: 'sending',
      };

      // Append user message and empty AI placeholder to active thread
      setThreads((prev) =>
        prev.map((thread) => {
          if (thread.id === currentId) {
            const isFirstMsg = thread.messages.length === 0;
            const updatedTitle =
              isFirstMsg || thread.title === 'Percakapan Baru' || thread.title === 'Obrolan Baru'
                ? trimmed.length > 28
                  ? trimmed.substring(0, 28) + '...'
                  : trimmed
                : thread.title;

            return {
              ...thread,
              title: updatedTitle,
              lastUpdated: Date.now(),
              messages: [...thread.messages, userMessage, aiMessagePlaceholder],
            };
          }
          return thread;
        })
      );

      setIsLoading(true);
      setLoadingStatus(null);

      try {
        const currentThreadObj = threads.find((t) => t.id === currentId);
        const contextHistory = (currentThreadObj?.messages || []).slice(-10);

        let targetContent = '';
        let displayedContent = '';
        let isStreamDone = false;
        let streamError: string | null = null;

        // Adaptive speed helper for natural, progressive text reveal
        const getNextChunk = (fullText: string, currentIndex: number, isDone: boolean): string => {
          const remainingLen = fullText.length - currentIndex;
          if (remainingLen <= 0) return fullText;

          // Instant finish if stream is done and remaining text is very short
          if (isDone && remainingLen <= 40) {
            return fullText;
          }

          // Adaptive base step based on revealed position (smooth acceleration curve)
          // Start gentle at the beginning for readability -> Accelerate in middle -> Fast at end
          let adaptiveStep = 8;
          if (currentIndex < 80) {
            // Initial phase: 6 to 12 chars per tick
            adaptiveStep = 6 + Math.floor((currentIndex / 80) * 6);
          } else if (currentIndex < 350) {
            // Middle phase: 12 to 28 chars per tick
            const progress = (currentIndex - 80) / (350 - 80);
            adaptiveStep = 12 + Math.floor(progress * 16);
          } else {
            // End phase: 28 to 45 chars per tick
            const deepProgress = Math.min(1, (currentIndex - 350) / 500);
            adaptiveStep = 28 + Math.floor(deepProgress * 17);
          }

          // Backlog adjustment: Boost speed if buffer accumulates or stream is complete
          if (isDone) {
            adaptiveStep = Math.max(adaptiveStep, Math.ceil(remainingLen / 3));
          } else if (remainingLen > 150) {
            adaptiveStep = Math.max(adaptiveStep, 35);
          } else if (remainingLen > 80) {
            adaptiveStep = Math.max(adaptiveStep, 24);
          }

          const rawEndIndex = Math.min(fullText.length, currentIndex + adaptiveStep);
          if (rawEndIndex >= fullText.length) {
            return fullText;
          }

          // Snap to nearest word boundary (space/newline) so words reveal naturally
          let boundaryIndex = rawEndIndex;
          while (boundaryIndex < fullText.length && boundaryIndex < rawEndIndex + 15) {
            const char = fullText[boundaryIndex];
            if (char === ' ' || char === '\n' || char === '\t') {
              boundaryIndex++;
              break;
            }
            boundaryIndex++;
          }

          return fullText.slice(0, boundaryIndex);
        };

        const DRAIN_INTERVAL_MS = 16; // ~60 FPS reveal loop

        const drainPromise = new Promise<void>((resolve) => {
          const interval = setInterval(() => {
            if (displayedContent.length < targetContent.length) {
              displayedContent = getNextChunk(targetContent, displayedContent.length, isStreamDone);

              setThreads((prev) =>
                prev.map((thread) => {
                  if (thread.id === currentId) {
                    return {
                      ...thread,
                      lastUpdated: Date.now(),
                      messages: thread.messages.map((msg) =>
                        msg.id === aiMsgId
                          ? { ...msg, content: displayedContent }
                          : msg
                      ),
                    };
                  }
                  return thread;
                })
              );
            } else if (isStreamDone) {
              clearInterval(interval);
              resolve();
            }
          }, DRAIN_INTERVAL_MS);
        });

        try {
          const routeResult = await ragRouter.routeAndExecute({
            message: trimmed,
            history: contextHistory,
            ragMode: aiSettings.ragMode || 'smart',
            searchMethod: aiSettings.searchMethod || 'hybrid',
            topK: aiSettings.topKChunks || 5,
            similarityThreshold: aiSettings.similarityThreshold ?? 0,
            categoryFilter: aiSettings.categoryFilter || 'all',
            typeFilter: aiSettings.typeFilter || 'all',
            tagFilter: aiSettings.tagFilter || 'all',
            onChunk: (chunk) => {
              targetContent += chunk;
            },
            onMeta: (meta) => {
              setThreads((prev) =>
                prev.map((thread) => {
                  if (thread.id === currentId) {
                    return {
                      ...thread,
                      messages: thread.messages.map((msg) =>
                        msg.id === aiMsgId ? { ...msg, modelMeta: meta } : msg
                      ),
                    };
                  }
                  return thread;
                })
              );
            },
            onStatus: (status) => {
              setLoadingStatus(status);
            },
          });

          if (routeResult) {
            setThreads((prev) =>
              prev.map((thread) => {
                if (thread.id === currentId) {
                  return {
                    ...thread,
                    messages: thread.messages.map((msg) =>
                      msg.id === aiMsgId
                        ? {
                            ...msg,
                            modelMeta: routeResult.modelMeta || msg.modelMeta,
                            retrievedContexts: routeResult.retrievedContexts,
                            ragStatus: routeResult.ragStatus,
                          }
                        : msg
                    ),
                  };
                }
                return thread;
              })
            );
          }
        } catch (err: any) {
          streamError = err.message || 'Gagal mengirim pesan ke Gemini.';
          setError(streamError);
        } finally {
          isStreamDone = true;
        }

        // Wait until buffer drain animation finishes
        await drainPromise;

        // Mark message as sent or error after stream and animation finish
        setThreads((prev) =>
          prev.map((thread) => {
            if (thread.id === currentId) {
              return {
                ...thread,
                lastUpdated: Date.now(),
                messages: thread.messages.map((msg) => {
                  if (msg.id === aiMsgId) {
                    if (streamError) {
                      return {
                        ...msg,
                        content: displayedContent
                          ? `${displayedContent}\n\n⚠️ ${streamError}`
                          : `⚠️ ${streamError}`,
                        status: 'error',
                      };
                    }
                    return { ...msg, status: 'sent' };
                  }
                  return msg;
                }),
              };
            }
            return thread;
          })
        );
      } catch (err: any) {
        console.error('Error during chat send:', err);
      } finally {
        setIsLoading(false);
        setLoadingStatus(null);
      }
    },
    [activeThreadId, threads, isLoading, aiSettings]
  );

  const handleEditAndResendMessage = useCallback(
    async (messageId: string, newText: string) => {
      const trimmed = newText.trim();
      if (!trimmed || isLoading) return;

      setError(null);
      const currentId = activeThreadId;
      if (!currentId) return;

      const currentThreadObj = threads.find((t) => t.id === currentId);
      if (!currentThreadObj) return;

      const msgIndex = currentThreadObj.messages.findIndex((m) => m.id === messageId);
      if (msgIndex === -1) return;

      // Keep messages up to msgIndex, update user message content
      const existingMessages = currentThreadObj.messages.slice(0, msgIndex);
      const updatedUserMsg: Message = {
        ...currentThreadObj.messages[msgIndex],
        content: trimmed,
        timestamp: Date.now(),
        status: 'sent',
      };

      const aiMsgId = `ai_${Date.now()}`;
      const aiMessagePlaceholder: Message = {
        id: aiMsgId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        status: 'sending',
      };

      setThreads((prev) =>
        prev.map((thread) => {
          if (thread.id === currentId) {
            return {
              ...thread,
              lastUpdated: Date.now(),
              messages: [...existingMessages, updatedUserMsg, aiMessagePlaceholder],
            };
          }
          return thread;
        })
      );

      setIsLoading(true);
      setLoadingStatus(null);

      try {
        const contextHistory = existingMessages.slice(-10);

        let targetContent = '';
        let displayedContent = '';
        let isStreamDone = false;
        let streamError: string | null = null;

        const getNextChunk = (fullText: string, currentIndex: number, isDone: boolean): string => {
          const remainingLen = fullText.length - currentIndex;
          if (remainingLen <= 0) return fullText;
          if (isDone && remainingLen <= 40) return fullText;

          let adaptiveStep = 8;
          if (currentIndex < 80) {
            adaptiveStep = 6 + Math.floor((currentIndex / 80) * 6);
          } else if (currentIndex < 350) {
            const progress = (currentIndex - 80) / (350 - 80);
            adaptiveStep = 12 + Math.floor(progress * 16);
          } else {
            const deepProgress = Math.min(1, (currentIndex - 350) / 500);
            adaptiveStep = 28 + Math.floor(deepProgress * 17);
          }

          if (isDone) {
            adaptiveStep = Math.max(adaptiveStep, Math.ceil(remainingLen / 3));
          } else if (remainingLen > 150) {
            adaptiveStep = Math.max(adaptiveStep, 35);
          } else if (remainingLen > 80) {
            adaptiveStep = Math.max(adaptiveStep, 24);
          }

          const rawEndIndex = Math.min(fullText.length, currentIndex + adaptiveStep);
          if (rawEndIndex >= fullText.length) return fullText;

          let boundaryIndex = rawEndIndex;
          while (boundaryIndex < fullText.length && boundaryIndex < rawEndIndex + 15) {
            const char = fullText[boundaryIndex];
            if (char === ' ' || char === '\n' || char === '\t') {
              boundaryIndex++;
              break;
            }
            boundaryIndex++;
          }

          return fullText.slice(0, boundaryIndex);
        };

        const DRAIN_INTERVAL_MS = 16;
        const drainPromise = new Promise<void>((resolve) => {
          const interval = setInterval(() => {
            if (displayedContent.length < targetContent.length) {
              displayedContent = getNextChunk(targetContent, displayedContent.length, isStreamDone);

              setThreads((prev) =>
                prev.map((thread) => {
                  if (thread.id === currentId) {
                    return {
                      ...thread,
                      lastUpdated: Date.now(),
                      messages: thread.messages.map((msg) =>
                        msg.id === aiMsgId ? { ...msg, content: displayedContent } : msg
                      ),
                    };
                  }
                  return thread;
                })
              );
            } else if (isStreamDone) {
              clearInterval(interval);
              resolve();
            }
          }, DRAIN_INTERVAL_MS);
        });

        try {
          const routeResult = await ragRouter.routeAndExecute({
            message: trimmed,
            history: contextHistory,
            ragMode: aiSettings.ragMode || 'smart',
            searchMethod: aiSettings.searchMethod || 'hybrid',
            topK: aiSettings.topKChunks || 5,
            similarityThreshold: aiSettings.similarityThreshold ?? 0,
            categoryFilter: aiSettings.categoryFilter || 'all',
            typeFilter: aiSettings.typeFilter || 'all',
            tagFilter: aiSettings.tagFilter || 'all',
            onChunk: (chunk) => {
              targetContent += chunk;
            },
            onMeta: (meta) => {
              setThreads((prev) =>
                prev.map((thread) => {
                  if (thread.id === currentId) {
                    return {
                      ...thread,
                      messages: thread.messages.map((msg) =>
                        msg.id === aiMsgId ? { ...msg, modelMeta: meta } : msg
                      ),
                    };
                  }
                  return thread;
                })
              );
            },
            onStatus: (status) => {
              setLoadingStatus(status);
            },
          });

          if (routeResult) {
            setThreads((prev) =>
              prev.map((thread) => {
                if (thread.id === currentId) {
                  return {
                    ...thread,
                    messages: thread.messages.map((msg) =>
                      msg.id === aiMsgId
                        ? {
                            ...msg,
                            modelMeta: routeResult.modelMeta || msg.modelMeta,
                            retrievedContexts: routeResult.retrievedContexts,
                            ragStatus: routeResult.ragStatus,
                          }
                        : msg
                    ),
                  };
                }
                return thread;
              })
            );
          }
        } catch (err: any) {
          streamError = err.message || 'Gagal mengirim pesan ke Gemini.';
          setError(streamError);
        } finally {
          isStreamDone = true;
        }

        await drainPromise;

        setThreads((prev) =>
          prev.map((thread) => {
            if (thread.id === currentId) {
              return {
                ...thread,
                lastUpdated: Date.now(),
                messages: thread.messages.map((msg) => {
                  if (msg.id === aiMsgId) {
                    if (streamError) {
                      return {
                        ...msg,
                        content: displayedContent
                          ? `${displayedContent}\n\n⚠️ ${streamError}`
                          : `⚠️ ${streamError}`,
                        status: 'error',
                      };
                    }
                    return { ...msg, status: 'sent' };
                  }
                  return msg;
                }),
              };
            }
            return thread;
          })
        );
      } catch (err: any) {
        console.error('Error during chat edit send:', err);
      } finally {
        setIsLoading(false);
        setLoadingStatus(null);
      }
    },
    [activeThreadId, threads, isLoading, aiSettings]
  );

  const selectThread = useCallback((threadId: string) => {
    setActiveThreadId(threadId);
    setError(null);
  }, []);

  const deleteThread = useCallback(
    (threadId: string) => {
      setThreads((prev) => {
        const filtered = prev.filter((t) => t.id !== threadId);
        if (activeThreadId === threadId) {
          if (filtered.length > 0) {
            setActiveThreadId(filtered[0].id);
          } else {
            setActiveThreadId('');
            return [];
          }
        }
        return filtered;
      });
    },
    [activeThreadId]
  );

  const clearChat = useCallback(() => {
    if (activeThreadId) {
      setThreads((prev) =>
        prev.map((thread) => {
          if (thread.id === activeThreadId) {
            return {
              ...thread,
              messages: [],
            };
          }
          return thread;
        })
      );
    }
  }, [activeThreadId]);

  const renameThread = useCallback((threadId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === threadId ? { ...thread, title: trimmed } : thread
      )
    );
  }, []);

  const togglePinThread = useCallback((threadId: string) => {
    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === threadId ? { ...thread, pinned: !thread.pinned } : thread
      )
    );
  }, []);

  return {
    threads,
    activeThreadId,
    activeThreadTitle: activeThread?.title || 'Obrolan Baru',
    messages,
    isLoading,
    loadingStatus,
    error,
    aiSettings,
    setAiSettings,
    createNewThread,
    selectThread,
    deleteThread,
    renameThread,
    togglePinThread,
    sendMessage: handleSendMessage,
    editAndResendMessage: handleEditAndResendMessage,
    clearChat,
  };
}
