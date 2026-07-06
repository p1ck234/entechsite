import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Network, Users, Loader2 } from 'lucide-react';
import { orgStructureAPI } from '../api/client';
import { OrgEmployee, OrgStructureResponse } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import OrgMobileTree from '../components/OrgMobileTree';
import {
  OrgChartNode,
  employeeMatchesSearch,
  getOrgEmployeeName,
} from '../components/OrgChart';
import { useAuth } from '../contexts/AuthContext';
import { canAssignManager } from '../utils/orgStructure';

const OrgStructure: React.FC = () => {
  const { isAdmin } = useAuth();
  const [data, setData] = useState<OrgStructureResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<OrgEmployee | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropInvalid, setDropInvalid] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [managerDraft, setManagerDraft] = useState('');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadTree = useCallback(async () => {
    const response = await orgStructureAPI.getTree();
    setData(response);
    return response;
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        setError('');
        await loadTree();
      } catch (err: any) {
        setError(err.response?.data?.message || 'Не удалось загрузить структуру');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [loadTree]);

  useEffect(() => {
    if (!selectedEmployee) {
      setManagerDraft('');
      return;
    }
    setManagerDraft(selectedEmployee.managerId || '');
  }, [selectedEmployee]);

  useEffect(() => {
    if (!actionMessage) {
      return;
    }

    const timer = window.setTimeout(() => setActionMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [actionMessage]);

  const managerOptions = useMemo(() => {
    if (!data) {
      return [];
    }

    return data.employees.filter((employee) => employee.id !== selectedEmployee?.id);
  }, [data, selectedEmployee?.id]);

  const filteredEmployeeIds = useMemo(() => {
    if (!data || !searchQuery.trim()) {
      return new Set<string>();
    }

    return new Set(
      data.employees
        .filter((employee) => employeeMatchesSearch(employee, searchQuery))
        .map((employee) => employee.id)
    );
  }, [data, searchQuery]);

  useEffect(() => {
    if (!searchQuery.trim() || filteredEmployeeIds.size === 0) {
      return;
    }

    const firstId = Array.from(filteredEmployeeIds)[0];
    const element = document.querySelector(`[data-employee-id="${firstId}"]`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }, [searchQuery, filteredEmployeeIds]);

  const handleAssignManager = async (employeeId: string, managerId: string | null) => {
    if (!data || assigning) {
      return;
    }

    const validation = canAssignManager(employeeId, managerId, data.roots);
    if (!validation.valid) {
      setActionMessage({ type: 'error', text: validation.reason || 'Недопустимое назначение' });
      return;
    }

    setAssigning(true);
    setActionMessage(null);

    try {
      await orgStructureAPI.updateManager(employeeId, managerId);
      const response = await loadTree();

      const updatedEmployee = response.employees.find((employee) => employee.id === employeeId);
      if (updatedEmployee) {
        setSelectedEmployee(updatedEmployee);
      }

      setActionMessage({ type: 'success', text: 'Структура обновлена' });
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.response?.data?.message || 'Не удалось обновить руководителя',
      });
    } finally {
      setAssigning(false);
    }
  };

  const handleDragStart = (employeeId: string) => {
    setDraggingId(employeeId);
    setDropTargetId(null);
    setDropInvalid(false);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDropTargetId(null);
    setDropInvalid(false);
  };

  const handleDragOver = (event: React.DragEvent, targetId: string) => {
    event.preventDefault();
    if (!draggingId || !data) {
      return;
    }

    const validation = canAssignManager(draggingId, targetId, data.roots);
    setDropTargetId(targetId);
    setDropInvalid(!validation.valid);
    event.dataTransfer.dropEffect = validation.valid ? 'move' : 'none';
  };

  const handleDragLeave = (targetId: string) => {
    if (dropTargetId === targetId) {
      setDropTargetId(null);
      setDropInvalid(false);
    }
  };

  const handleDrop = async (event: React.DragEvent, targetId: string) => {
    event.preventDefault();
    if (!draggingId) {
      return;
    }

    await handleAssignManager(draggingId, targetId);
    handleDragEnd();
  };

  const handleSaveManagerFromPanel = async () => {
    if (!selectedEmployee) {
      return;
    }

    await handleAssignManager(
      selectedEmployee.id,
      managerDraft || null
    );
  };

  const handleDetachManager = async () => {
    if (!selectedEmployee) {
      return;
    }

    setManagerDraft('');
    await handleAssignManager(selectedEmployee.id, null);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-primary-600">
            <Network className="h-5 w-5" />
            <span className="text-sm font-medium">Организационная структура</span>
          </div>
          <h1 className="text-3xl font-bold text-pastel-900">Структура компании</h1>
          <p className="mt-1 text-sm text-pastel-600">
            {data.companyName} · {data.total} сотрудников в схеме
          </p>
          {isAdmin && (
            <p className="mt-2 text-xs text-pastel-500">
              Перетащите сотрудника на карточку руководителя или измените связь в панели справа.
            </p>
          )}
        </div>

        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pastel-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Поиск по ФИО, должности или отделу"
            className="input-field pl-10"
          />
        </div>
      </div>

      {actionMessage && (
        <div
          className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${
            actionMessage.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {actionMessage.text}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <div className="hidden overflow-x-auto rounded-3xl border border-pastel-200 bg-white/80 p-6 md:block">
            {data.roots.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-pastel-600">
                <Users className="mb-3 h-10 w-10 text-pastel-400" />
                <p className="font-medium">Пока нет иерархии</p>
                <p className="mt-1 max-w-md text-sm">
                  Назначьте руководителей в адресной книге — сотрудники без руководителя появятся на верхнем уровне.
                </p>
              </div>
            ) : (
              <div className="flex min-w-max flex-wrap justify-center gap-10 pl-4">
                {data.roots.map((root) => (
                  <OrgChartNode
                    key={root.employee.id}
                    node={root}
                    searchQuery={searchQuery}
                    selectedId={selectedEmployee?.id || null}
                    isAdmin={isAdmin}
                    draggingId={draggingId}
                    dropTargetId={dropTargetId}
                    dropInvalid={dropInvalid}
                    onSelect={setSelectedEmployee}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-pastel-200 bg-white/80 p-4 md:hidden">
            {data.roots.length === 0 ? (
              <div className="py-8 text-center text-sm text-pastel-500">
                Нет данных для отображения иерархии
              </div>
            ) : (
              <OrgMobileTree
                roots={data.roots}
                searchQuery={searchQuery}
                selectedId={selectedEmployee?.id || null}
                onSelect={setSelectedEmployee}
              />
            )}
          </div>
        </div>

        <aside className="rounded-3xl border border-pastel-200 bg-white/90 p-5 h-fit">
          {selectedEmployee ? (
            <div>
              <div className="text-sm text-pastel-500">Выбран сотрудник</div>
              <h2 className="mt-1 text-xl font-bold text-pastel-900">
                {getOrgEmployeeName(selectedEmployee)}
              </h2>
              <dl className="mt-4 space-y-3 text-sm">
                <div>
                  <dt className="text-pastel-500">Должность</dt>
                  <dd className="font-medium text-pastel-800">{selectedEmployee.position}</dd>
                </div>
                <div>
                  <dt className="text-pastel-500">Отдел</dt>
                  <dd className="font-medium text-pastel-800">{selectedEmployee.department}</dd>
                </div>
                <div>
                  <dt className="text-pastel-500">Руководитель</dt>
                  <dd className="font-medium text-pastel-800">
                    {selectedEmployee.managerId
                      ? getOrgEmployeeName(
                          data.employees.find((employee) => employee.id === selectedEmployee.managerId) ||
                            selectedEmployee
                        )
                      : 'Верхний уровень'}
                  </dd>
                </div>
              </dl>

              {isAdmin && (
                <div className="mt-5 space-y-3 border-t border-pastel-200 pt-4">
                  <label htmlFor="managerDraft" className="block text-sm font-medium text-pastel-700">
                    Изменить руководителя
                  </label>
                  <select
                    id="managerDraft"
                    value={managerDraft}
                    onChange={(event) => setManagerDraft(event.target.value)}
                    className="input-field"
                    disabled={assigning}
                  >
                    <option value="">Без руководителя (верхний уровень)</option>
                    {managerOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {getOrgEmployeeName(option)}
                        {option.position ? ` — ${option.position}` : ''}
                      </option>
                    ))}
                  </select>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={handleSaveManagerFromPanel}
                      disabled={assigning}
                      className="btn-primary flex items-center justify-center gap-2"
                    >
                      {assigning && <Loader2 className="h-4 w-4 animate-spin" />}
                      Сохранить
                    </button>
                    {selectedEmployee.managerId && (
                      <button
                        type="button"
                        onClick={handleDetachManager}
                        disabled={assigning}
                        className="rounded-xl border border-pastel-300 px-4 py-2 text-sm text-pastel-700 hover:bg-pastel-50"
                      >
                        Отвязать
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-pastel-600">
              Выберите сотрудника на схеме или в списке, чтобы увидеть детали
              {isAdmin ? ' и изменить подчинение.' : '.'}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default OrgStructure;
