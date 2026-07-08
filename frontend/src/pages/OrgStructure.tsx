import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Network, Loader2, Building2, GitBranch, ListTree, LayoutGrid, Plus } from 'lucide-react';
import { orgStructureAPI } from '../api/client';
import { OrgEmployee, OrgStructureResponse, OrgViewMode } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import OrgMobileTree from '../components/OrgMobileTree';
import OrgDepartmentChart from '../components/OrgDepartmentChart';
import CompanyOrgChart from '../components/CompanyOrgChart';
import {
  employeeMatchesSearch,
} from '../components/OrgChart';
import { useAuth } from '../contexts/AuthContext';
import {
  buildDepartmentGroups,
  buildOrgTree,
  canAssignManager,
  collectAllExpandableIds,
  collectExpandedIdsUpToDepth,
  countManagerLinks,
  getDirectReports,
  getOrgNodeLabel,
  isOrgRoleNode,
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
  const [dropTargetCompany, setDropTargetCompany] = useState(false);
  const [dropInvalid, setDropInvalid] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [managerDraft, setManagerDraft] = useState('');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [desktopLayout, setDesktopLayout] = useState<'chart' | 'list'>('list');
  const [chartScale, setChartScale] = useState(0.75);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showAddRole, setShowAddRole] = useState(false);
  const [roleForm, setRoleForm] = useState({ position: '', department: '', managerId: '' });

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

  const listRoots = useMemo(
    () => (viewMode === 'departments' ? departmentGroups.flatMap((group) => group.roots) : hierarchyRoots),
    [viewMode, departmentGroups, hierarchyRoots]
  );

  useEffect(() => {
    if (listRoots.length === 0) {
      setExpandedIds(new Set());
      return;
    }

    setExpandedIds(collectExpandedIdsUpToDepth(listRoots, 2));
  }, [listRoots]);

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
        text: err.message || err.response?.data?.message || validationError || 'Не удалось сохранить связь',
      });
    } finally {
      setAssigning(false);
    }
  };

  const handleDragStart = (employeeId: string) => {
    setDraggingId(employeeId);
    setDropTargetId(null);
    setDropTargetCompany(false);
    setDropInvalid(false);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDropTargetId(null);
    setDropTargetCompany(false);
    setDropInvalid(false);
  };

  const handleDragOver = (event: React.DragEvent, targetId: string) => {
    event.preventDefault();
    if (!draggingId || !data) {
      return;
    }

    setDropTargetCompany(false);
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

  const handleDragOverCompany = (event: React.DragEvent) => {
    event.preventDefault();
    if (!draggingId) {
      return;
    }

    setDropTargetId(null);
    setDropInvalid(false);
    setDropTargetCompany(true);
    event.dataTransfer.dropEffect = 'move';
  };

  const handleDragLeaveCompany = () => {
    setDropTargetCompany(false);
  };

  const handleDropOnCompany = async (event: React.DragEvent) => {
    event.preventDefault();
    if (!draggingId) {
      return;
    }

    await handleAssignManager(draggingId, null);
    handleDragEnd();
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
        text: err.message || err.response?.data?.message || validationError || 'Не удалось настроить отдел',
      });
    } finally {
      setAssigning(false);
    }
  };

  const getDirectReportsCount = useCallback(
    (employeeId: string) => (data ? getDirectReports(data.employees, employeeId).length : 0),
    [data]
  );

  const handleToggleExpand = useCallback((employeeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(employeeId)) {
        next.delete(employeeId);
      } else {
        next.add(employeeId);
      }
      return next;
    });
  }, []);

  const handleExpandAll = useCallback(() => {
    setExpandedIds(collectAllExpandableIds(listRoots));
  }, [listRoots]);

  const handleCollapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  const handleZoomIn = useCallback(() => {
    setChartScale((prev) => Math.min(1.25, Number((prev + 0.1).toFixed(2))));
  }, []);

  const handleZoomOut = useCallback(() => {
    setChartScale((prev) => Math.max(0.5, Number((prev - 0.1).toFixed(2))));
  }, []);

  const handleToggleDisplayMode = async () => {
    if (!selectedEmployee || assigning) {
      return;
    }

    const nextMode = isOrgRoleNode(selectedEmployee) ? 'person' : 'role';
    setAssigning(true);
    setActionMessage(null);

    try {
      const response = await orgStructureAPI.updateDisplayMode(selectedEmployee.id, nextMode);
      await loadTree();
      setSelectedEmployee(response.employee);
      setActionMessage({
        type: 'success',
        text: nextMode === 'role' ? 'На схеме показывается только должность' : 'На схеме показывается сотрудник',
      });
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.message || err.response?.data?.message || 'Не удалось изменить режим отображения',
      });
    } finally {
      setAssigning(false);
    }
  };

  const handleCreateRole = async () => {
    if (!roleForm.position.trim() || !roleForm.department.trim() || assigning) {
      return;
    }

    setAssigning(true);
    setActionMessage(null);

    try {
      const response = await orgStructureAPI.createRole({
        position: roleForm.position.trim(),
        department: roleForm.department.trim(),
        managerId: roleForm.managerId || selectedEmployee?.id || null,
      });
      await loadTree();
      setSelectedEmployee(response.employee);
      setRoleForm({ position: '', department: '', managerId: '' });
      setShowAddRole(false);
      setActionMessage({ type: 'success', text: 'Роль добавлена на схему' });
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.message || err.response?.data?.message || 'Не удалось добавить роль',
      });
    } finally {
      setAssigning(false);
    }
  };

  const departmentOptions = useMemo(
    () => [...new Set(data?.employees.map((employee) => employee.department).filter(Boolean) || [])].sort((a, b) =>
      a.localeCompare(b, 'ru')
    ),
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
    expandedIds,
    onToggleExpand: handleToggleExpand,
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
              Перетащите на блок «Компания» — верхний уровень (гендиректор). На карточку руководителя — подчинение.
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

      <div className="mb-4 flex flex-wrap items-center gap-2">
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

        <span className="hidden h-6 w-px bg-pastel-200 sm:block" />

        <button
          type="button"
          onClick={() => setDesktopLayout('list')}
          className={`hidden items-center gap-2 rounded-xl px-3 py-2 text-sm md:inline-flex ${
            desktopLayout === 'list'
              ? 'bg-pastel-800 text-white'
              : 'border border-pastel-200 bg-white text-pastel-700'
          }`}
        >
          <ListTree className="h-4 w-4" />
          Список
        </button>
        <button
          type="button"
          onClick={() => setDesktopLayout('chart')}
          className={`hidden items-center gap-2 rounded-xl px-3 py-2 text-sm md:inline-flex ${
            desktopLayout === 'chart'
              ? 'bg-pastel-800 text-white'
              : 'border border-pastel-200 bg-white text-pastel-700'
          }`}
        >
          <LayoutGrid className="h-4 w-4" />
          Схема
        </button>

        {desktopLayout === 'chart' && (
          <>
            <button
              type="button"
              onClick={handleExpandAll}
              className="hidden rounded-xl border border-pastel-200 px-3 py-2 text-xs text-pastel-600 hover:bg-pastel-50 md:inline-block"
            >
              Развернуть всё
            </button>
            <button
              type="button"
              onClick={handleCollapseAll}
              className="hidden rounded-xl border border-pastel-200 px-3 py-2 text-xs text-pastel-600 hover:bg-pastel-50 md:inline-block"
            >
              Свернуть
            </button>
          </>
        )}
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
          <div className={`rounded-2xl border border-pastel-200 bg-white p-2 ${desktopLayout === 'chart' ? 'hidden md:block' : 'hidden'}`}>
            {viewMode === 'company' ? (
              <CompanyOrgChart
                companyName={data.companyName}
                roots={hierarchyRoots}
                totalEmployees={data.total}
                managerLinksCount={managerLinksCount}
                dropTargetCompany={dropTargetCompany}
                chartScale={chartScale}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                getDirectReportsCount={getDirectReportsCount}
                onDragOverCompany={handleDragOverCompany}
                onDragLeaveCompany={handleDragLeaveCompany}
                onDropOnCompany={handleDropOnCompany}
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

          <div className={`rounded-2xl border border-pastel-200 bg-white p-4 block ${desktopLayout === 'chart' ? 'md:hidden' : ''}`}>
            {listRoots.length === 0 ? (
              <div className="py-8 text-center text-sm text-pastel-500">
                Нет данных для отображения иерархии
              </div>
            ) : (
              <OrgMobileTree
                roots={listRoots}
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
              <div className="text-sm text-pastel-500">
                {isOrgRoleNode(selectedEmployee) ? 'Роль на схеме' : 'Выбран сотрудник'}
              </div>
              <h2 className="mt-1 text-xl font-bold text-pastel-900">
                {getOrgNodeLabel(selectedEmployee)}
              </h2>
              {isOrgRoleNode(selectedEmployee) && (
                <p className="mt-1 text-xs text-pastel-500">Без привязки к аккаунту в портале</p>
              )}
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
                      ? getOrgNodeLabel(
                          data.employees.find((employee) => employee.id === selectedEmployee.managerId) ||
                            selectedEmployee
                        )
                      : 'Прикреплён к компании'}
                  </dd>
                </div>
              </dl>

              {isAdmin && (
                <div className="mt-5 space-y-3 border-t border-pastel-200 pt-4">
                  <button
                    type="button"
                    onClick={handleToggleDisplayMode}
                    disabled={assigning}
                    className="w-full rounded-xl border border-pastel-200 px-4 py-2 text-sm text-pastel-700 hover:bg-pastel-50"
                  >
                    {isOrgRoleNode(selectedEmployee)
                      ? 'Показывать как сотрудника'
                      : 'Показывать только должность'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAddRole((prev) => !prev);
                      setRoleForm((prev) => ({
                        ...prev,
                        managerId: selectedEmployee.id,
                        department: selectedEmployee.department || prev.department,
                      }));
                    }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-pastel-200 px-4 py-2 text-sm text-pastel-700 hover:bg-pastel-50"
                  >
                    <Plus className="h-4 w-4" />
                    Добавить роль подчинения
                  </button>

                  {showAddRole && (
                    <div className="space-y-2 rounded-xl border border-pastel-200 bg-pastel-50/60 p-3">
                      <input
                        type="text"
                        value={roleForm.position}
                        onChange={(event) => setRoleForm((prev) => ({ ...prev, position: event.target.value }))}
                        placeholder="Должность, напр. электромонтажник"
                        className="input-field"
                      />
                      <select
                        value={roleForm.department}
                        onChange={(event) => setRoleForm((prev) => ({ ...prev, department: event.target.value }))}
                        className="input-field"
                      >
                        <option value="">Отдел</option>
                        {departmentOptions.map((department) => (
                          <option key={department} value={department}>
                            {department}
                          </option>
                        ))}
                      </select>
                      <select
                        value={roleForm.managerId}
                        onChange={(event) => setRoleForm((prev) => ({ ...prev, managerId: event.target.value }))}
                        className="input-field"
                      >
                        <option value="">Руководитель</option>
                        {managerOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {getOrgNodeLabel(option)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleCreateRole}
                        disabled={assigning || !roleForm.position.trim() || !roleForm.department.trim()}
                        className="btn-primary w-full"
                      >
                        Сохранить роль
                      </button>
                    </div>
                  )}

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
                    <option value="">К компании (верхний уровень)</option>
                    {managerOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {getOrgNodeLabel(option)}
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
                        К компании
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
