import React from 'react';
import Support from './Support';

/** Скрытый контур поддержки — доступ только оператору тени (Ветров). */
const SupportShadow: React.FC = () => (
  <Support queue="shadow" title="Служебная поддержка" />
);

export default SupportShadow;
