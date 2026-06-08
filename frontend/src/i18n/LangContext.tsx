import { createContext, useContext, useState } from 'react'
import { T, type Lang, type TranslationKey } from './translations'

interface LangContextType {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: TranslationKey) => string
}

const LangContext = createContext<LangContextType>({
  lang: 'ru',
  setLang: () => {},
  t: (k) => T.ru[k],
})

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(
    () => (localStorage.getItem('lang') as Lang) ?? 'ru'
  )

  const setLang = (l: Lang) => {
    localStorage.setItem('lang', l)
    setLangState(l)
  }

  const t = (key: TranslationKey): string => T[lang][key]

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}
