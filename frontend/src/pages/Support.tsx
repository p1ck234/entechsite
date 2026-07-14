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
  UserPlus,
  Settings,
} from 'lucide-react';
import { supportAPI, usersAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type {
  SupportAgent,
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

type TabId = 'mine' | 'queue' | 'kpi' | 'settings';

const STATUS_LABEL: Record<SupportStatus, string> = {
  new: 'Новая',
  acknowledged: 'Подтверждена',
  in_progress: 'В работе',
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
  const { isAdmin } = useAuth();
  const [flags, setFlags] = useState<SupportMeFlags | null>(null);
  const [tab, setTab] = useState<TabId>('mine');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [kpi, setKpi] = useState<SupportKpi | null>(null);
  const [agents, setAgents] = useState<SupportAgent[]>([]);
  const [users, setUsers] = useState<Array<{ id: string; email: string }>>([]);
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
    subject: '',
    body: '',
    category: 'other',
    priority: 'P3' as SupportPriority,
  });
  const [agentUserId, setAgentUserId] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const canAgent = queue === 'shadow' ? Boolean(flags?.canShadow) : Boolean(flags?.canAgentPublic);
  const canSettings = queue === 'public' && (Boolean(flags?.canManageAgents) || isAdmin);

  const tabs = useMemo(() => {
    const items: Array<{ id: TabId; label: string; show: boolean }> = [
      { id: 'mine', label: 'Мои заявки', show: true },
      { id: 'queue', label: 'Очередь', show: canAgent },
      { id: 'kpi', label: 'KPI', show: canAgent },
      { id: 'settings', label: 'Настройки', show: canSettings },
    ];
    return items.filter((item) => item.show);
  }, [canAgent, canSettings]);

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
      const canSettingsNow = queue === 'public' && (me.canManageAgents || isAdmin);
      const effectiveTab =
        (tab === 'queue' || tab === 'kpi') && !canAgentNow
          ? 'mine'
          : tab === 'settings' && !canSettingsNow
            ? 'mine'
            : tab;

      if (effectiveTab !== tab) {
        setTab(effectiveTab);
      }

      if (effectiveTab === 'kpi') {
        setKpi(await supportAPI.getKpi(queue));
      } else if (effectiveTab === 'settings') {
        const [agentsRes, usersRes] = await Promise.all([
          supportAPI.listAgents(),
          usersAPI.getUsers().catch(() => ({ users: [] as any[] })),
        ]);
        setAgents(agentsRes.agents);
        setUsers(
          (usersRes.users || []).map((u: any) => ({
            id: String(u.id),
            email: u.email,
          }))
        );
      } else {
        await loadTickets(effectiveTab === 'queue' ? 'queue' : 'mine');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Не удалось загрузить');
    } finally {
      setLoading(false);
    }
  }, [loadFlags, loadTickets, queue, tab, isAdmin]);

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
      await supportAPI.createTicket({
        ...form,
        queue,
      });
      setForm({ subject: '', body: '', category: 'other', priority: 'P3' });
      setTab('mine');
      await loadTickets('mine');
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Не удалось создать заявку');
    } finally {
      setCreating(false);
    }
  };

  const runTransition = async (id: string, action: 'ack' | 'start' | 'done') => {
    try {
      setBusyId(id);
      setActionError('');
      if (action === 'ack') {
        await supportAPI.acknowledge(id);
      } else if (action === 'start') {
        await supportAPI.start(id);
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

  const handleAddAgent = async () => {
    if (!agentUserId) {
      return;
    }
    try {
      setActionError('');
      await supportAPI.addAgent(agentUserId);
      setAgentUserId('');
      const agentsRes = await supportAPI.listAgents();
      setAgents(agentsRes.agents);
    } catch (err: any) {
      setActionError(err.response?.data?.message || 'Не удалось назначить агента');
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
            {canAgent || canSettings
              ? 'Заявка → подтверждение → в работе → готово. SLA по приоритету P1–P3.'
              : 'Создайте обращение и следите за статусом в «Мои заявки».'}
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
          <input
            className="input-field md:col-span-2"
            placeholder="Тема"
            value={form.subject}
            onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
            required
            minLength={3}
          />
          <textarea
            className="input-field md:col-span-2 min-h-[100px]"
            placeholder="Описание проблемы"
            value={form.body}
            onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
            required
            minLength={3}
          />
          <select
            className="input-field"
            value={form.category}
            onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
          >
            <option value="other">Другое</option>
            <option value="access">Доступ / учётка</option>
            <option value="hardware">Оборудование</option>
            <option value="software">ПО / портал</option>
            <option value="network">Сеть</option>
          </select>
          <select
            className="input-field"
            value={form.priority}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, priority: e.target.value as SupportPriority }))
            }
          >
            <option value="P1">P1 — критично (1ч / 4ч)</option>
            <option value="P2">P2 — важно (4ч / 1д)</option>
            <option value="P3">P3 — обычно (1д / 3д)</option>
          </select>
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
              <span>Готово: {kpi.byStatus.done}</span>
              <span>SLA ответа: {formatPercent(kpi.responseSlaCompliance)}</span>
            </div>
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className="space-y-4">
          <div className="rounded-3xl border border-pastel-200 bg-white p-5 space-y-4">
            <div className="flex items-center gap-2 text-base font-semibold text-pastel-900">
              <Settings className="h-5 w-5 text-primary-600" />
              Кто обрабатывает заявки
            </div>
            <p className="text-sm text-pastel-600">
              Назначьте сотрудников — только они увидят вкладки «Очередь» и «KPI» и смогут
              подтверждать / брать в работу / закрывать заявки. Обычные пользователи видят только
              свои обращения. Админ без назначения в обработчики очередь не видит.
            </p>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="mb-1 block text-xs text-pastel-500">Пользователь портала</label>
                <select
                  className="input-field"
                  value={agentUserId}
                  onChange={(e) => setAgentUserId(e.target.value)}
                >
                  <option value="">Выберите</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.email}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="btn-primary inline-flex items-center gap-2"
                onClick={() => void handleAddAgent()}
              >
                <UserPlus className="h-4 w-4" />
                Назначить обработчика
              </button>
            </div>
            <ul className="divide-y divide-pastel-100">
              {agents.map((agent) => (
                <li key={agent.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <div className="font-medium text-pastel-900">{agent.name}</div>
                    <div className="text-pastel-500">{agent.email}</div>
                  </div>
                  {agent.isActive ? (
                    <button
                      type="button"
                      className="text-red-600 hover:underline"
                      onClick={() =>
                        void supportAPI.removeAgent(agent.userId).then(() =>
                          supportAPI.listAgents().then((r) => setAgents(r.agents))
                        )
                      }
                    >
                      Отключить
                    </button>
                  ) : (
                    <span className="text-pastel-400">отключён</span>
                  )}
                </li>
              ))}
              {agents.length === 0 && (
                <li className="py-4 text-sm text-pastel-500">
                  Обработчики ещё не назначены — назначьте хотя бы одного сотрудника (можно и себя).
                </li>
              )}
            </ul>
          </div>

          <div className="rounded-3xl border border-pastel-200 bg-white p-5 space-y-3">
            <div className="text-base font-semibold text-pastel-900">Todoist</div>
            <p className="text-sm text-pastel-600">
              Новые публичные заявки создаются в проекте Todoist «💰 HQ/ЭГ/C». Закрытие задачи в
              Todoist закрывает заявку на портале (проверка раз в минуту). Обработчикам приходит
              уведомление в Telegram.
            </p>
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                void supportAPI
                  .syncTodoist()
                  .then((r) =>
                    setActionError(
                      r.closed > 0
                        ? `Todoist: проверено ${r.checked}, закрыто на портале ${r.closed}`
                        : `Todoist: проверено ${r.checked}, новых закрытий нет`
                    )
                  )
                  .catch((err: any) =>
                    setActionError(err.response?.data?.message || 'Ошибка синхронизации Todoist')
                  )
              }
            >
              Синхронизировать Todoist сейчас
            </button>
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
                          #{ticket.id} · {ticket.subject}
                        </span>
                        <span className="text-xs rounded-full bg-pastel-100 px-2 py-0.5 text-pastel-700">
                          {ticket.priority}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-pastel-500">
                        <span>{STATUS_LABEL[ticket.status]}</span>
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
                  <h2 className="text-lg font-bold text-pastel-900">
                    #{detail.ticket.id} · {detail.ticket.subject}
                  </h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-pastel-700">{detail.ticket.body}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-pastel-600">
                  <div>Статус: {STATUS_LABEL[detail.ticket.status]}</div>
                  <div>Приоритет: {detail.ticket.priority}</div>
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
                      <button
                        type="button"
                        className="btn-primary inline-flex items-center gap-1"
                        disabled={busyId === detail.ticket.id}
                        onClick={() => void runTransition(detail.ticket.id, 'start')}
                      >
                        <Play className="h-4 w-4" />
                        В работу
                      </button>
                    )}
                    {detail.ticket.status === 'in_progress' && (
                      <button
                        type="button"
                        className="btn-primary inline-flex items-center gap-1"
                        disabled={busyId === detail.ticket.id}
                        onClick={() => void runTransition(detail.ticket.id, 'done')}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Готово
                      </button>
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
