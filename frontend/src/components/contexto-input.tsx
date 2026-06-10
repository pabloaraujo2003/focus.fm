'use client';

import { useEffect, useState } from 'react';
import { obterContextosRecentes } from '@/services/sessao-api';

interface ContextoInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function ContextoInput({ value, onChange, disabled }: ContextoInputProps) {
  const [contextos, setContextos] = useState<string[]>([]);

  useEffect(() => {
    obterContextosRecentes(10).then(setContextos).catch(console.error);
  }, []);

  return (
    <div className="contexto-input">
      <input
        type="text"
        list="contextos-lista"
        placeholder="No que você vai focar?"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="input"
      />
      <datalist id="contextos-lista">
        {contextos.map((ctx) => (
          <option key={ctx} value={ctx} />
        ))}
      </datalist>
    </div>
  );
}
