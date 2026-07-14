import React, { useCallback, useEffect, useState } from 'react';
import { Headphones, RefreshCw, Shield, UserPlus, Users } from 'lucide-react';
import { supportAPI, usersAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import type { SupportAgent, User } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

const AdminSettings: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [agents, setAgents] = useState<SupportAgent[]>([]);
  const [agentUserId, setAgentUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [roleBusyId, setRoleBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [usersRes, agentsRes] = await Promise.all([
        usersAPI.getUsers(),
        supportAPI.listAgents().catch(() => ({ agents: [] as SupportAgent[] })),
      ]);
      setUsers(usersRes.users || []);
      setAgents(agentsRes.agents || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Не удалось загрузить настройки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleRoleChange = async (userId: string, role: 'ADMIN' | 'USER') => {
    try {
      setRoleBusyId(userId);
      setError('');
      setMessage('');
      await usersAPI.updateUserRole(userId, role);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
      setMessage('Роль обновлена');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Не удалось изменить роль');
    } finally {
      setRoleBusyId(null);
    }
  };

  const handleAddAgent = async () => {
    if (!agentUserId) {
      return;
    }
    try {
      setError('');
      setMessage('');
      await supportAPI.addAgent(agentUserId);
      setAgentUserId('');
      const agentsRes = await supportAPI.listAgents();
      setAgents(agentsRes.agents);
      setMessage('Обработчик назначен');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Не удалось назначить обработчика');
    }
  };

  const handleSyncTodoist = async () => {
    try {
      setError('');
      const result = await supportAPI.syncTodoist();
      setMessage(
        `Todoist: проверено ${result.checked}, закрыто ${result.closed || 0}, сдвинуто по доске ${result.moved || 0}`
      );
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ошибка синхронизации Todoist');
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-pastel-900">Общие настройки</h2>
          <p className="mt-1 text-sm text-pastel-600">
            Доступы сотрудников, роли и настройки техподдержки. Раздел виден только администраторам.
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary inline-flex items-center gap-2 shrink-0"
          onClick={() => void refresh()}
        >
          <RefreshCw className="h-4 w-4" />
          Обновить
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </div>
      )}

      <section className="rounded-3xl border border-pastel-200 bg-white p-5 space-y-4">
        <div className="flex items-center gap-2 text-base font-semibold text-pastel-900">
          <Shield className="h-5 w-5 text-primary-600" />
          Роли и доступы
        </div>
        <p className="text-sm text-pastel-600">
          <strong>Администратор</strong> — структура, расписание, общие настройки, управление доступами.
          <strong> Пользователь</strong> — обычный доступ к порталу без админ-разделов. Свою роль изменить
          нельзя.
        </p>
        <ul className="divide-y divide-pastel-100">
          {users.map((u) => {
            const isSelf = String(currentUser?.id) === String(u.id);
            return (
              <li key={u.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="font-medium text-pastel-900 truncate">{u.email}</div>
                  {isSelf && <div className="text-xs text-pastel-500">это вы</div>}
                </div>
                <select
                  className="input-field sm:w-44"
                  value={u.role}
                  disabled={isSelf || roleBusyId === u.id}
                  onChange={(e) => void handleRoleChange(u.id, e.target.value as 'ADMIN' | 'USER')}
                >
                  <option value="USER">Пользователь</option>
                  <option value="ADMIN">Администратор</option>
                </select>
              </li>
            );
          })}
          {users.length === 0 && (
            <li className="py-4 text-sm text-pastel-500">Пользователи не найдены</li>
          )}
        </ul>
        <p className="text-xs text-pastel-500">
          Заявки на регистрацию новых сотрудников по-прежнему одобряются во вкладке «Адресная книга».
        </p>
      </section>

      <section className="rounded-3xl border border-pastel-200 bg-white p-5 space-y-4">
        <div className="flex items-center gap-2 text-base font-semibold text-pastel-900">
          <Headphones className="h-5 w-5 text-primary-600" />
          Кто обрабатывает заявки
        </div>
        <p className="text-sm text-pastel-600">
          Только назначенные обработчики видят очередь и KPI поддержки и могут менять статусы заявок.
          Админ без назначения в обработчики очередь не видит.
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
            Назначить
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
              Обработчики ещё не назначены — назначьте хотя бы одного сотрудника.
            </li>
          )}
        </ul>
      </section>

      <section className="rounded-3xl border border-pastel-200 bg-white p-5 space-y-3">
        <div className="flex items-center gap-2 text-base font-semibold text-pastel-900">
          <Users className="h-5 w-5 text-primary-600" />
          Todoist
        </div>
        <p className="text-sm text-pastel-600">
          Новые заявки (публичные и служебные) → проект «💰 HQ/ЭГ/C», служебные с «🛡». Колонки:
          BackLog→новая, Неделя/Ждун→подтверждена, Сегодня→в работе; закрытие задачи→готово.
          Ответственный в Todoist пишется в заявку, если задан TODOIST_USER_MAP
          (todoistUserId:email) на backend.
        </p>
        <button type="button" className="btn-secondary" onClick={() => void handleSyncTodoist()}>
          Синхронизировать Todoist сейчас
        </button>
      </section>
    </div>
  );
};

export default AdminSettings;
