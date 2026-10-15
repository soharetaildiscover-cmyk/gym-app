import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';

import { emptyProgram, type DraftProgram } from '@/lib/programs';

type Builder = {
  draft: DraftProgram;
  setDraft: Dispatch<SetStateAction<DraftProgram>>;
  loadedFor: string | null;
  setLoadedFor: (id: string | null) => void;
  dirty: boolean;
  setDirty: (d: boolean) => void;
};

const BuilderContext = createContext<Builder | null>(null);

/** The program builder's screens share one draft until it is saved. */
export function BuilderProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<DraftProgram>(emptyProgram);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  return (
    <BuilderContext.Provider value={{ draft, setDraft, loadedFor, setLoadedFor, dirty, setDirty }}>{children}</BuilderContext.Provider>
  );
}

export function useBuilder() {
  const b = useContext(BuilderContext);
  if (!b) throw new Error('useBuilder must be used inside the program builder');
  return b;
}
