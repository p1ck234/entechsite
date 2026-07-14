import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Headphones,
  Plus,
  RefreshCw,
  Clock,
  CheckCircle2,
  Play,
  Inbox,
  BarChart3,
} from 'lucide-react';
import { supportAPI } from '../api/client';
import type {
  SupportKpi,
  SupportMeFlags,
  SupportPriority,
  SupportQueue,
  SupportStatus,
  SupportTicket,
  SupportTicketEvent,
  SupportTicketReply,
} from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  SUPPORT_PRIORITY_OPTIONS,
  SUPPORT_THEMES,
  buildTicketSubject,
  formatTicketCode,
  getPriorityLabel,
  getThemeLabel,
  type SupportThemeId,
} from '../utils/supportLabels';

const PRIORITY_BADGE: Record<SupportPriority, string> = {
  P1: 'bg-rose-100 text-rose-800',
  P2: 'bg-amber-100 text-amber-800',
  P3: 'bg-pastel-100 text-pastel-700',
};

type TabId = 'mine' | 'queue' | 'kpi';

const STATUS_LABEL: Record<SupportStatus, string> = {
  new: 'Новая',
  acknowledged: 'Подтверждена',
  in_progress: 'В работе',
  waiting: 'Ожидание',
  done: 'Готово',
};

const formatDuration = (ms: number | null | undefined): string => {
  if (ms == null || Number.isNaN(ms)) {
    return '—';
  }
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 60) {
    return `${totalMinutes} мин`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 48) {
    return minutes ? `${hours} ч ${minutes} мин` : `${hours} ч`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours ? `${days} д ${remHours} ч` : `${days} д`;
};

const formatPercent = (value: number | null | undefined): string => {
  if (value == null) {
    return '—';
  }
  return `${Math.round(value * 100)}%`;
};

const Support: React.FC<{ queue?: SupportQueue; title?: string }> = ({
  queue = 'public',
  title = 'Техподдержка',
}) => {
  const [flags, setFlags] = useState<SupportMeFlags | null>(null);
  const [tab, setTab] = useState<TabId>('mine');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [kpi, setKpi] = useState<SupportKpi | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    ticket: SupportTicket;
    events: SupportTicketEvent[];
    replies: SupportTicketReply[];
  } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    themeId: 'other' as SupportThemeId,
    detail: '',
    body: '',
    priority: 'P3' as SupportPriority,
  });
  const [busyId, setBusyId] = useState<string | null>(null);

  const canAgent = queue === 'shadow' ? Boolean(flags?.canShadow) : Boolean(flags?.canAgentPublic);
  // Тему при создании выбирают агенты/операторы; у сотрудника — только текст
  const canPickThemeOnCreate = canAgent || queue === 'shadow';

  const tabs = useMemo(() => {
    const items: Array<{ id: TabId; label: string; show: boolean }> = [
      { id: 'mine', label: 'Мои заявки', show: true },
      { id: 'queue', label: 'Очередь', show: canAgent },
      { id: 'kpi', label: 'KPI', show: canAgent },
    ];
    return items.filter((item) => item.show);
  }, [canAgent]);

  const loadFlags = useCallback(async () => {
    const me = await supportAPI.getMe();
    setFlags(me);
    if (queue === 'shadow' && !me.canShadow) {
      throw new Error('Нет доступа');
    }
    return me;
  }, [queue]);

  const loadTickets = useCallback(
    async (scope: 'mine' | 'queue') => {
      const response = await supportAPI.listTickets({ scope, queue });
      setTickets(response.tickets);
    },
    [queue]
  );

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const me = await loadFlags();
      const canAgentNow = queue === 'shadow' ? me.canShadow : me.canAgentPublic;
      const effectiveTab =
        (tab === 'queue' || tab === 'kpi') && !canAgentNow ? 'mine' : tab;

      if (effectiveTab !== tab) {
        setTab(effectiveTab);
      }

      if (effectiveTab === 'kpi') {
        setKpi(await supportAPI.getKpi(queue));
      } else {
        await loadTickets(effectiveTab === 'queue' ? 'queue' : 'mine');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Не удалось загрузить');
    } finally {
      setLoading(false);
    }
  }, [loadFlags, loadTickets, queue, tab]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setReplyText('');
      return;
    }

    let cancelled = false;
    supportAPI
      .getTicket(selectedId)
      .then((data) => {
        if (!cancelled) {
          setDetail(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDetail(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const handleReply = async () => {
    if (!selectedId || !replyText.trim()) {
      return;
    }
    try {
      setReplySending(true);
      setActionError('');
      await supportAPI.reply(selectedId, replyText.trim());
      setReplyText('');
      setDetail(await supportAPI.getTicket(selectedId));
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Не удалось отправить ответ');
    } finally {
      setReplySending(false);
    }
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setActionError('');
      setCreating(true);
      const subject = canPickThemeOnCreate
        ? buildTicketSubject(form.themeId, form.detail)
        : form.detail.trim() || form.body.trim().slice(0, 180);
      await supportAPI.createTicket({
        subject,
        body: form.body,
        category: canPickThemeOnCreate ? form.themeId : 'other',
        priority: form.priority,
        queue,
      });
      setForm({ themeId: 'other', detail: '', body: '', priority: 'P3' });
      setTab('mine');
      await loadTickets('mine');
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Не удалось создать заявку');
    } finally {
      setCreating(false);
    }
  };

  const handleCategoryChange = async (category: SupportThemeId) => {
    if (!detail) {
      return;
    }
    try {
      setBusyId(detail.ticket.id);
      setActionError('');
      const { ticket } = await supportAPI.updateCategory(detail.ticket.id, category);
      setDetail((prev) => (prev ? { ...prev, ticket } : prev));
      setTickets((prev) => prev.map((item) => (item.id === ticket.id ? { ...item, ...ticket } : item)));
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Не удалось обновить тему');
    } finally {
      setBusyId(null);
    }
  };

  const runTransition = async (id: string, action: 'ack' | 'start' | 'wait' | 'done') => {
    try {
      setBusyId(id);
      setActionError('');
      if (action === 'ack') {
        await supportAPI.acknowledge(id);
      } else if (action === 'start') {
        await supportAPI.start(id);
      } else if (action === 'wait') {
        await supportAPI.wait(id);
      } else {
        await supportAPI.resolve(id);
      }
      await loadTickets(tab === 'queue' ? 'queue' : 'mine');
      if (selectedId === id) {
        setDetail(await supportAPI.getTicket(id));
      }
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Не удалось обновить статус');
    } finally {
      setBusyId(null);
    }
  };

  if (loading && !flags) {
    return <LoadingSpinner />;
  }

  if (error && queue === 'shadow') {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">
          Раздел недоступен
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-pastel-900">
            <Headphones className="h-7 w-7 text-primary-600" />
            {title}
          </h1>
          <p className="mt-1 text-sm text-pastel-500">
            {canAgent
              ? 'Заявка → подтверждение → в работе → готово. Срочность: критично / важно / обычная.'
              : 'Выберите тему, опишите проблему и следите за статусом в «Мои заявки».'}
          </p>
        </div>
        <button type="button" onClick={() => void refresh()} className="btn-secondary inline-flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Обновить
        </button>
      </div>

      {(error || actionError) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {actionError || error}
        </div>
      )}

      <form
        onSubmit={handleCreate}
        className="rounded-3xl border border-pastel-200 bg-white p-5 shadow-sm"
      >
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-pastel-800">
          <Plus className="h-4 w-4" />
          Новая заявка
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {canPickThemeOnCreate && (
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-pastel-500">Тема</label>
              <select
                className="input-field"
                value={form.themeId}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, themeId: e.target.value as SupportThemeId }))
                }
                required
              >
                {SUPPORT_THEMES.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-pastel-500">
              {canPickThemeOnCreate ? 'Кратко (необязательно)' : 'Кратко'}
            </label>
            <input
              className="input-field"
              placeholder="Например: не печатает на 3 этаже"
              value={form.detail}
              onChange={(e) => setForm((prev) => ({ ...prev, detail: e.target.value }))}
              maxLength={180}
            />
            {!canPickThemeOnCreate && (
              <p className="mt-1 text-xs text-pastel-500">
                Тему назначит поддержка. Отдел подставится из вашего профиля на портале.
              </p>
            )}
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-pastel-500">Описание</label>
            <textarea
              className="input-field min-h-[100px]"
              placeholder="Что случилось, когда началось, что уже пробовали"
              value={form.body}
              onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
              required
              minLength={3}
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs text-pastel-500">Срочность</label>
            <select
              className="input-field"
              value={form.priority}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, priority: e.target.value as SupportPriority }))
              }
            >
              {SUPPORT_PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} — {option.hint}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3">
          <button type="submit" className="btn-primary" disabled={creating}>
            {creating ? 'Создание…' : 'Отправить заявку'}
          </button>
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              tab === item.id
                ? 'bg-primary-500 text-white'
                : 'bg-white text-pastel-700 border border-pastel-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'kpi' && kpi && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={Inbox} label="Всего" value={String(kpi.total)} />
          <KpiCard
            icon={Clock}
            label="Средний первый ответ"
            value={formatDuration(kpi.avgFirstResponseMs)}
          />
          <KpiCard
            icon={CheckCircle2}
            label="Среднее закрытие"
            value={formatDuration(kpi.avgResolveMs)}
          />
          <KpiCard
            icon={BarChart3}
            label="SLA закрытия"
            value={formatPercent(kpi.resolveSlaCompliance)}
          />
          <div className="md:col-span-2 lg:col-span-4 rounded-2xl border border-pastel-200 bg-white p-4">
            <div className="text-sm font-semibold text-pastel-800 mb-2">По статусам</div>
            <div className="flex flex-wrap gap-3 text-sm text-pastel-600">
              <span>Новые: {kpi.byStatus.new}</span>
              <span>Подтверждены: {kpi.byStatus.acknowledged}</span>
              <span>В работе: {kpi.byStatus.inProgress}</span>
              <span>Ожидание: {kpi.byStatus.waiting}</span>
              <span>Готово: {kpi.byStatus.done}</span>
              <span>SLA ответа: {formatPercent(kpi.responseSlaCompliance)}</span>
            </div>
          </div>
        </div>
      )}

      {(tab === 'mine' || tab === 'queue') && (
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-3xl border border-pastel-200 bg-white overflow-hidden">
            {loading ? (
              <div className="p-8">
                <LoadingSpinner />
              </div>
            ) : tickets.length === 0 ? (
              <div className="p-8 text-sm text-pastel-500">Заявок нет</div>
            ) : (
              <ul className="divide-y divide-pastel-100">
                {tickets.map((ticket) => (
                  <li key={ticket.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(ticket.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-pastel-50 transition ${
                        selectedId === ticket.id ? 'bg-primary-50' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-pastel-900">
                          <span className="text-primary-600">{formatTicketCode(ticket.id)}</span>
                          <span className="mx-1.5 text-pastel-300">·</span>
                          {ticket.subject}
                        </span>
                        <span
                          className={`shrink-0 text-xs rounded-full px-2 py-0.5 ${
                            PRIORITY_BADGE[ticket.priority] || PRIORITY_BADGE.P3
                          }`}
                        >
                          {getPriorityLabel(ticket.priority)}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-pastel-500">
                        <span>{STATUS_LABEL[ticket.status]}</span>
                        <span>{getThemeLabel(ticket.category)}</span>
                        <span>{ticket.requesterName}</span>
                        <span>{new Date(ticket.createdAt).toLocaleString('ru-RU')}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-3xl border border-pastel-200 bg-white p-5 min-h-[240px]">
            {!detail ? (
              <div className="text-sm text-pastel-500">Выберите заявку</div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-primary-600">
                    {formatTicketCode(detail.ticket.id)}
                  </div>
                  <h2 className="mt-1 text-lg font-bold text-pastel-900">{detail.ticket.subject}</h2>
                </div>

                <dl className="rounded-2xl bg-pastel-50 px-3 py-3 space-y-2 text-sm text-pastel-800">
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-pastel-500">👤 Заявитель</dt>
                    <dd className="font-medium">{detail.ticket.requesterName}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-pastel-500">🏢 Отдел</dt>
                    <dd>{detail.ticket.department || '—'}</dd>
                  </div>
                  <div className="flex gap-2 items-center">
                    <dt className="shrink-0 text-pastel-500">📁 Тема</dt>
                    <dd className="min-w-0 flex-1">
                      {canAgent && detail.ticket.status !== 'done' ? (
                        <select
                          className="input-field py-1 text-sm"
                          value={
                            SUPPORT_THEMES.some((t) => t.id === detail.ticket.category)
                              ? detail.ticket.category
                              : 'other'
                          }
                          disabled={busyId === detail.ticket.id}
                          onChange={(e) =>
                            void handleCategoryChange(e.target.value as SupportThemeId)
                          }
                        >
                          {SUPPORT_THEMES.map((theme) => (
                            <option key={theme.id} value={theme.id}>
                              {theme.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        getThemeLabel(detail.ticket.category)
                      )}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-pastel-500">⚠️ Срочность</dt>
                    <dd>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          PRIORITY_BADGE[detail.ticket.priority] || PRIORITY_BADGE.P3
                        }`}
                      >
                        {getPriorityLabel(detail.ticket.priority)}
                      </span>
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-pastel-500">📌 Статус</dt>
                    <dd>{STATUS_LABEL[detail.ticket.status]}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="shrink-0 text-pastel-500">🕒 Создано</dt>
                    <dd>{new Date(detail.ticket.createdAt).toLocaleString('ru-RU')}</dd>
                  </div>
                </dl>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-pastel-400 mb-1">
                    Описание
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-pastel-700 rounded-2xl border border-pastel-100 px-3 py-2">
                    {detail.ticket.body}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-pastel-600">
                  <div>Первый ответ: {formatDuration(detail.ticket.firstResponseMs)}</div>
                  <div>Закрытие: {formatDuration(detail.ticket.resolveMs)}</div>
                  <div>
                    SLA ответа:{' '}
                    {detail.ticket.responseSlaMet == null
                      ? '—'
                      : detail.ticket.responseSlaMet
                        ? 'OK'
                        : 'просрочен'}
                  </div>
                  <div>
                    SLA закрытия:{' '}
                    {detail.ticket.resolveSlaMet == null
                      ? '—'
                      : detail.ticket.resolveSlaMet
                        ? 'OK'
                        : 'просрочен'}
                  </div>
                </div>

                {canAgent && detail.ticket.status !== 'done' && (
                  <div className="flex flex-wrap gap-2">
                    {detail.ticket.status === 'new' && (
                      <button
                        type="button"
                        className="btn-primary inline-flex items-center gap-1"
                        disabled={busyId === detail.ticket.id}
                        onClick={() => void runTransition(detail.ticket.id, 'ack')}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Подтвердить
                      </button>
                    )}
                    {detail.ticket.status === 'acknowledged' && (
                      <>
                        <button
                          type="button"
                          className="btn-primary inline-flex items-center gap-1"
                          disabled={busyId === detail.ticket.id}
                          onClick={() => void runTransition(detail.ticket.id, 'start')}
                        >
                          <Play className="h-4 w-4" />
                          В работу
                        </button>
                        <button
                          type="button"
                          className="btn-secondary inline-flex items-center gap-1"
                          disabled={busyId === detail.ticket.id}
                          onClick={() => void runTransition(detail.ticket.id, 'wait')}
                        >
                          <Clock className="h-4 w-4" />
                          Ожидание
                        </button>
                      </>
                    )}
                    {detail.ticket.status === 'in_progress' && (
                      <>
                        <button
                          type="button"
                          className="btn-secondary inline-flex items-center gap-1"
                          disabled={busyId === detail.ticket.id}
                          onClick={() => void runTransition(detail.ticket.id, 'wait')}
                        >
                          <Clock className="h-4 w-4" />
                          Ожидание
                        </button>
                        <button
                          type="button"
                          className="btn-primary inline-flex items-center gap-1"
                          disabled={busyId === detail.ticket.id}
                          onClick={() => void runTransition(detail.ticket.id, 'done')}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Готово
                        </button>
                      </>
                    )}
                    {detail.ticket.status === 'waiting' && (
                      <>
                        <button
                          type="button"
                          className="btn-primary inline-flex items-center gap-1"
                          disabled={busyId === detail.ticket.id}
                          onClick={() => void runTransition(detail.ticket.id, 'start')}
                        >
                          <Play className="h-4 w-4" />
                          В работу
                        </button>
                        <button
                          type="button"
                          className="btn-primary inline-flex items-center gap-1"
                          disabled={busyId === detail.ticket.id}
                          onClick={() => void runTransition(detail.ticket.id, 'done')}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Готово
                        </button>
                      </>
                    )}
                  </div>
                )}

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-pastel-400 mb-2">
                    Переписка
                  </div>
                  <ul className="space-y-2 mb-3">
                    {(detail.replies || []).length === 0 && (
                      <li className="text-xs text-pastel-500">Ответов пока нет</li>
                    )}
                    {(detail.replies || []).map((reply) => (
                      <li
                        key={reply.id}
                        className={`rounded-xl px-3 py-2 text-sm ${
                          reply.isAgent
                            ? 'bg-primary-50 text-pastel-800'
                            : 'bg-pastel-50 text-pastel-800'
                        }`}
                      >
                        <div className="text-[11px] text-pastel-500 mb-1">
                          {reply.authorName}
                          {reply.isAgent ? ' · поддержка' : ''} ·{' '}
                          {new Date(reply.createdAt).toLocaleString('ru-RU')}
                        </div>
                        <div className="whitespace-pre-wrap">{reply.body}</div>
                      </li>
                    ))}
                  </ul>
                  {detail.ticket.status !== 'done' && (
                    <div className="space-y-2">
                      <textarea
                        className="input-field min-h-[80px] text-sm"
                        placeholder="Написать ответ…"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn-primary text-sm"
                        disabled={replySending || !replyText.trim()}
                        onClick={() => void handleReply()}
                      >
                        {replySending ? 'Отправка…' : 'Ответить'}
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-pastel-400 mb-2">
                    История
                  </div>
                  <ul className="space-y-1 text-xs text-pastel-600">
                    {detail.events.map((event) => (
                      <li key={event.id}>
                        {new Date(event.createdAt).toLocaleString('ru-RU')} — {event.eventType}
                        {event.toStatus ? ` → ${event.toStatus}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const KpiCard: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}> = ({ icon: Icon, label, value }) => (
  <div className="rounded-2xl border border-pastel-200 bg-white p-4">
    <div className="flex items-center gap-2 text-xs text-pastel-500">
      <Icon className="h-4 w-4" />
      {label}
    </div>
    <div className="mt-2 text-xl font-bold text-pastel-900">{value}</div>
  </div>
);

export default Support;
