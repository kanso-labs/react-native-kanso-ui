// The words the library writes itself: the pending ring's name. Each one
// stands behind a prop that names it otherwise, `pendingLabel` for this one.
//
// Copied from kanso-ui's src/i18n/messages.ts, one entry per locale React
// Aria ships, and kept in step with it by hand: the web library publishes no
// copy of its table, and a word that differs between the two would name the
// same ring two ways. The translations were drafted for that table rather
// than taken from a translation service, and each one wants a native
// speaker's eye before it is trusted; a call site can always pass its own
// words through the prop.

type LibraryMessages = {
  /** What a pending button's ring is called. */
  readonly loading: string
}

const MESSAGES: Readonly<Record<string, LibraryMessages>> = {
  'ar-AE': { loading: 'جارٍ التحميل' },
  'bg-BG': { loading: 'Зареждане' },
  'cs-CZ': { loading: 'Načítání' },
  'da-DK': { loading: 'Indlæser' },
  'de-DE': { loading: 'Wird geladen' },
  'el-GR': { loading: 'Φόρτωση' },
  'en-US': { loading: 'Loading' },
  'es-ES': { loading: 'Cargando' },
  'et-EE': { loading: 'Laadimine' },
  'fi-FI': { loading: 'Ladataan' },
  'fr-FR': { loading: 'Chargement' },
  'he-IL': { loading: 'טוען' },
  'hr-HR': { loading: 'Učitavanje' },
  'hu-HU': { loading: 'Betöltés' },
  'it-IT': { loading: 'Caricamento' },
  'ja-JP': { loading: '読み込み中' },
  'ko-KR': { loading: '로드 중' },
  'lt-LT': { loading: 'Įkeliama' },
  'lv-LV': { loading: 'Notiek ielāde' },
  'nb-NO': { loading: 'Laster inn' },
  'nl-NL': { loading: 'Laden' },
  'pl-PL': { loading: 'Ładowanie' },
  'pt-BR': { loading: 'Carregando' },
  'pt-PT': { loading: 'A carregar' },
  'ro-RO': { loading: 'Se încarcă' },
  'ru-RU': { loading: 'Загрузка' },
  'sk-SK': { loading: 'Načítava sa' },
  'sl-SI': { loading: 'Nalaganje' },
  'sr-SP': { loading: 'Učitavanje' },
  'sv-SE': { loading: 'Läser in' },
  'tr-TR': { loading: 'Yükleniyor' },
  'uk-UA': { loading: 'Завантаження' },
  'zh-CN': { loading: '正在加载' },
  'zh-TW': { loading: '正在載入' },
}

export { MESSAGES }
export type { LibraryMessages }
