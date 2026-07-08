import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Network, Loader2, Building2, GitBranch } from 'lucide-react';
import { orgStructureAPI } from '../api/client';
import { OrgEmployee, OrgStructureResponse, OrgViewMode } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import OrgMobileTree from '../components/OrgMobileTree';
import OrgDepartmentChart from '../components/OrgDepartmentChart';
import CompanyOrgChart from '../components/CompanyOrgChart';
import {
  employeeMatchesSearch,
  getOrgEmployeeName,
} from '../components/OrgChart';
import { useAuth } from '../contexts/AuthContext';
import {
  buildDepartmentGroups,
  buildOrgTree,
  canAssignManager,
  countManagerLinks,
  getDirectReports,
} from '../utils/orgStructure';

const OrgStructure: React.FC = () => {
  const { isAdmin } = useAuth();
  const [data, setData] = useState<OrgStructureResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<OrgViewMode>('company');
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

    const timer = window.setTimeout(() => setActionMessage(null), 5000);
    return () => window.clearTimeout(timer);
  }, [actionMessage]);

  const hierarchyRoots = useMemo(
    () => (data ? buildOrgTree(data.employees) : []),
    [data]
  );

  const departmentGroups = useMemo(
    () => (data ? buildDepartmentGroups(data.employees) : []),
    [data]
  );

  const managerLinksCount = useMemo(
    () => (data ? countManagerLinks(data.employees) : 0),
    [data]
  );

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

    const validation = canAssignManager(employeeId, managerId, hierarchyRoots);
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

      setActionMessage({ type: 'success', text: 'Связь сохранена — схема обновлена' });
    } catch (err: any) {
      const validationError = err.response?.data?.errors?.[0]?.msg;
      setActionMessage({
        type: 'error',
        text: err.response?.data?.message || validationError || 'Не удалось сохранить связь',
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

    const validation = canAssignManager(draggingId, targetId, hierarchyRoots);
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

    await handleAssignManager(selectedEmployee.id, managerDraft || null);
  };

  const handleDetachManager = async () => {
    if (!selectedEmployee) {
      return;
    }

    setManagerDraft('');
    await handleAssignManager(selectedEmployee.id, null);
  };

  const handleAssignDepartmentHead = async (department: string, headId: string) => {
    if (!data || assigning || !headId) {
      return;
    }

    const deptEmployees = data.employees.filter(
      (employee) => (employee.department || 'Без отдела') === department && employee.id !== headId
    );

    if (deptEmployees.length === 0) {
      setActionMessage({ type: 'error', text: 'В отделе нет сотрудников для подчинения' });
      return;
    }

    setAssigning(true);
    setActionMessage(null);

    try {
      for (const employee of deptEmployees) {
        if (employee.managerId === headId) {
          continue;
        }

        await orgStructureAPI.updateManager(employee.id, headId);
      }

      await loadTree();
      setActionMessage({ type: 'success', text: `Отдел «${department}» подчинён выбранному руководителю` });
    } catch (err: any) {
      const validationError = err.response?.data?.errors?.[0]?.msg;
      setActionMessage({
        type: 'error',
        text: err.response?.data?.message || validationError || 'Не удалось настроить отдел',
      });
    } finally {
      setAssigning(false);
    }
  };

  const getDirectReportsCount = useCallback(
    (employeeId: string) => (data ? getDirectReports(data.employees, employeeId).length : 0),
    [data]
  );

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

  const chartProps = {
    searchQuery,
    selectedId: selectedEmployee?.id || null,
    isAdmin,
    draggingId,
    dropTargetId,
    dropInvalid,
    onSelect: setSelectedEmployee,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
  };

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
            {data.companyName} · {data.total} сотрудников · {departmentGroups.length} отделов · {managerLinksCount} связей
          </p>
          {isAdmin && (
            <p className="mt-2 text-xs text-pastel-500">
              Перетащите сотрудника на руководителя или выберите связь в панели справа.
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

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setViewMode('company')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition-colors ${
            viewMode === 'company'
              ? 'bg-primary-500 text-white'
              : 'bg-white/70 text-pastel-700 border border-pastel-200'
          }`}
        >
          <GitBranch className="h-4 w-4" />
          Общая структура
        </button>
        <button
          type="button"
          onClick={() => setViewMode('departments')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition-colors ${
            viewMode === 'departments'
              ? 'bg-primary-500 text-white'
              : 'bg-white/70 text-pastel-700 border border-pastel-200'
          }`}
        >
          <Building2 className="h-4 w-4" />
          По отделам
        </button>
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

      {viewMode === 'company' && managerLinksCount === 0 && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Общая иерархия ещё не настроена. Перейдите в «По отделам», назначьте руководителей отделов кнопкой «Подчинить отдел».
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <div className="hidden rounded-3xl border border-pastel-200 bg-white/80 p-6 md:block">
            {viewMode === 'company' ? (
              <CompanyOrgChart
                companyName={data.companyName}
                roots={hierarchyRoots}
                totalEmployees={data.total}
                managerLinksCount={managerLinksCount}
                getDirectReportsCount={getDirectReportsCount}
                {...chartProps}
              />
            ) : (
              <OrgDepartmentChart
                groups={departmentGroups}
                assigning={assigning}
                onAssignDepartmentHead={handleAssignDepartmentHead}
                {...chartProps}
              />
            )}
          </div>

          <div className="rounded-3xl border border-pastel-200 bg-white/80 p-4 md:hidden">
            {hierarchyRoots.length === 0 ? (
              <div className="py-8 text-center text-sm text-pastel-500">
                Нет данных для отображения иерархии
              </div>
            ) : (
              <OrgMobileTree
                roots={viewMode === 'departments' ? departmentGroups.flatMap((group) => group.roots) : hierarchyRoots}
                searchQuery={searchQuery}
                selectedId={selectedEmployee?.id || null}
                onSelect={setSelectedEmployee}
              />
            )}
          </div>
        </div>

        <aside className="self-start rounded-3xl border border-pastel-200 bg-white/90 p-5 xl:sticky xl:top-6 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
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
                    Назначить руководителя
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
                        {option.department ? ` (${option.department})` : ''}
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
                      Сохранить связь
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
              Выберите сотрудника на схеме, чтобы увидеть детали
              {isAdmin ? ' и назначить руководителя.' : '.'}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default OrgStructure;
