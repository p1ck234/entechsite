import React, { useState, useEffect } from 'react';
import { Bot, Copy, Check, Plus, Edit, Trash2, MessageCircle } from 'lucide-react';
import { TelegramBot } from '../types';
import { botsAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useTelegram } from '../contexts/TelegramContext';
import BotModal from '../components/BotModal';

const Bots: React.FC = () => {
  const { isAdmin } = useAuth();
  const { isTelegram, webApp } = useTelegram();
  const [bots, setBots] = useState<TelegramBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingBot, setEditingBot] = useState<TelegramBot | null>(null);

  const fetchBots = async () => {
    try {
      setLoading(true);
      const response = await botsAPI.getBots();
      setBots(response.bots);
    } catch (error) {
      console.error('Error fetching bots:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBots();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Вы уверены, что хотите удалить этого бота?')) {
      return;
    }

    try {
      await botsAPI.deleteBot(id);
      fetchBots();
    } catch (error) {
      console.error('Error deleting bot:', error);
      alert('Ошибка при удалении бота');
    }
  };

  const handleCopy = async (text: string, fieldId: string) => {
    const textToCopy = text.startsWith('@') ? text : `@${text}`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedField(fieldId);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
      // Fallback для старых браузеров
      const textArea = document.createElement('textarea');
      textArea.value = textToCopy;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopiedField(fieldId);
        setTimeout(() => setCopiedField(null), 2000);
      } catch (err) {
        console.error('Fallback copy failed:', err);
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-pastel-800">Боты</h1>
          <p className="text-pastel-600 mt-1 text-sm sm:text-base">Telegram боты компании</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => {
              setEditingBot(null);
              setShowModal(true);
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Добавить бота</span>
          </button>
        )}
      </div>

      {/* Bots Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bots.length > 0 ? (
            bots.map((bot) => (
              <div 
                key={bot.id} 
                className="card p-6 hover:scale-105 transition-transform"
              >
                <div className="flex items-start space-x-4">
                  <div className="w-16 h-16 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <Bot className="w-8 h-8 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-pastel-800 mb-2">
                      {bot.name}
                    </h3>
                    {bot.description && (
                      <p className="text-pastel-600 text-sm mb-3">{bot.description}</p>
                    )}
                    
                    <div className="flex items-center justify-between group">
                      <div className="flex items-center space-x-2 text-sm text-pastel-600 flex-1 min-w-0">
                        <MessageCircle className="w-4 h-4 flex-shrink-0" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const telegramUsername = bot.username.replace('@', '');
                            if (telegramUsername) {
                              if (isTelegram && webApp) {
                                // В Telegram Mini App используем openTelegramLink
                                try {
                                  webApp.openTelegramLink(`https://t.me/${telegramUsername}`);
                                } catch (error) {
                                  console.error('Error opening Telegram link:', error);
                                  // Fallback: используем openLink
                                  webApp.openLink(`https://t.me/${telegramUsername}`);
                                }
                              } else {
                                // В обычном браузере используем window.open
                                window.open(`https://t.me/${telegramUsername}`, '_blank');
                              }
                            }
                          }}
                          className="text-primary-600 hover:text-primary-700 hover:underline transition-colors text-left font-medium"
                        >
                          @{bot.username}
                        </button>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const telegramToCopy = bot.username.startsWith('@') 
                              ? bot.username 
                              : `@${bot.username}`;
                            handleCopy(telegramToCopy, `bot-${bot.id}`);
                          }}
                          className="p-1 text-pastel-400 hover:text-primary-600 transition-colors opacity-0 group-hover:opacity-100"
                          title="Скопировать тег бота"
                        >
                          {copiedField === `bot-${bot.id}` ? (
                            <Check className="w-3.5 h-3.5 text-green-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {isAdmin && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingBot(bot);
                                setShowModal(true);
                              }}
                              className="p-1 text-pastel-400 hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100"
                              title="Редактировать бота"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(bot.id);
                              }}
                              className="p-1 text-pastel-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                              title="Удалить бота"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full">
              <p className="text-pastel-500 text-center py-8">Нет ботов</p>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <BotModal
          bot={editingBot}
          onClose={() => {
            setShowModal(false);
            setEditingBot(null);
          }}
          onSuccess={() => {
            fetchBots();
          }}
        />
      )}
    </div>
  );
};

export default Bots;

