// The words the library writes itself: the pending ring's name and a bottom
// sheet's drag handle. Each one stands behind a prop that names it otherwise,
// `pendingLabel` for the ring and `aria-label` for the handle.
//
// Copied from kanso-ui's src/i18n/messages.ts, one entry per locale React
// Aria ships, and kept in step with it by hand: the web library publishes no
// copy of its table, and a word that differs between the two would name the
// same ring two ways. The handle's name is this table's alone, since web's
// sheet draws its handle as decoration and names nothing. The translations
// were drafted for that table rather than taken from a translation service,
// and each one wants a native speaker's eye before it is trusted; a call site
// can always pass its own words through the prop.

type LibraryMessages = {
  /** What a bottom sheet's handle is called, where it is a control. */
  readonly dragHandle: string
  /** What a pending button's ring is called. */
  readonly loading: string
}

const MESSAGES: Readonly<Record<string, LibraryMessages>> = {
  'ar-AE': { dragHandle: 'مقبض السحب', loading: 'جارٍ التحميل' },
  'bg-BG': { dragHandle: 'Манипулатор за плъзгане', loading: 'Зареждане' },
  'cs-CZ': { dragHandle: 'Úchyt pro přetažení', loading: 'Načítání' },
  'da-DK': { dragHandle: 'Trækhåndtag', loading: 'Indlæser' },
  'de-DE': { dragHandle: 'Ziehpunkt', loading: 'Wird geladen' },
  'el-GR': { dragHandle: 'Λαβή μεταφοράς', loading: 'Φόρτωση' },
  'en-US': { dragHandle: 'Drag handle', loading: 'Loading' },
  'es-ES': { dragHandle: 'Control de arrastre', loading: 'Cargando' },
  'et-EE': { dragHandle: 'Lohistamispide', loading: 'Laadimine' },
  'fi-FI': { dragHandle: 'Vetokahva', loading: 'Ladataan' },
  'fr-FR': { dragHandle: 'Poignée de déplacement', loading: 'Chargement' },
  'he-IL': { dragHandle: 'ידית גרירה', loading: 'טוען' },
  'hr-HR': { dragHandle: 'Ručica za povlačenje', loading: 'Učitavanje' },
  'hu-HU': { dragHandle: 'Húzófogantyú', loading: 'Betöltés' },
  'it-IT': { dragHandle: 'Punto di trascinamento', loading: 'Caricamento' },
  'ja-JP': { dragHandle: 'ドラッグハンドル', loading: '読み込み中' },
  'ko-KR': { dragHandle: '드래그 핸들', loading: '로드 중' },
  'lt-LT': { dragHandle: 'Vilkimo rankenėlė', loading: 'Įkeliama' },
  'lv-LV': { dragHandle: 'Vilkšanas turis', loading: 'Notiek ielāde' },
  'nb-NO': { dragHandle: 'Drahåndtak', loading: 'Laster inn' },
  'nl-NL': { dragHandle: 'Sleepgreep', loading: 'Laden' },
  'pl-PL': { dragHandle: 'Uchwyt do przeciągania', loading: 'Ładowanie' },
  'pt-BR': { dragHandle: 'Alça de arrastar', loading: 'Carregando' },
  'pt-PT': { dragHandle: 'Pega para arrastar', loading: 'A carregar' },
  'ro-RO': { dragHandle: 'Mâner de tragere', loading: 'Se încarcă' },
  'ru-RU': { dragHandle: 'Маркер перемещения', loading: 'Загрузка' },
  'sk-SK': { dragHandle: 'Úchyt na presúvanie', loading: 'Načítava sa' },
  'sl-SI': { dragHandle: 'Ročica za vlečenje', loading: 'Nalaganje' },
  'sr-SP': { dragHandle: 'Ručica za prevlačenje', loading: 'Učitavanje' },
  'sv-SE': { dragHandle: 'Draghandtag', loading: 'Läser in' },
  'tr-TR': { dragHandle: 'Sürükleme tutamacı', loading: 'Yükleniyor' },
  'uk-UA': { dragHandle: 'Маркер переміщення', loading: 'Завантаження' },
  'zh-CN': { dragHandle: '拖动手柄', loading: '正在加载' },
  'zh-TW': { dragHandle: '拖曳控點', loading: '正在載入' },
}

export { MESSAGES }
export type { LibraryMessages }
