// The words the library writes itself: the pending ring's name, a bottom
// sheet's drag handle, and a collection's loading-more and empty rows. Each
// one stands behind a prop that names it otherwise: `pendingLabel` for the
// ring, `aria-label` for the handle, `label` for the loading-more row and
// `renderEmptyState` for the empty one.
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
  /** What a collection's row says while more items are on their way. */
  readonly loadingMore: string
  /** What a collection with nothing in it says. */
  readonly noResults: string
}

const MESSAGES: Readonly<Record<string, LibraryMessages>> = {
  'ar-AE': {
    dragHandle: 'مقبض السحب',
    loading: 'جارٍ التحميل',
    loadingMore: 'جارٍ تحميل المزيد',
    noResults: 'لا توجد نتائج',
  },
  'bg-BG': {
    dragHandle: 'Манипулатор за плъзгане',
    loading: 'Зареждане',
    loadingMore: 'Зареждане на още',
    noResults: 'Няма резултати',
  },
  'cs-CZ': {
    dragHandle: 'Úchyt pro přetažení',
    loading: 'Načítání',
    loadingMore: 'Načítání dalších',
    noResults: 'Žádné výsledky',
  },
  'da-DK': {
    dragHandle: 'Trækhåndtag',
    loading: 'Indlæser',
    loadingMore: 'Indlæser flere',
    noResults: 'Ingen resultater',
  },
  'de-DE': {
    dragHandle: 'Ziehpunkt',
    loading: 'Wird geladen',
    loadingMore: 'Weitere werden geladen',
    noResults: 'Keine Ergebnisse',
  },
  'el-GR': {
    dragHandle: 'Λαβή μεταφοράς',
    loading: 'Φόρτωση',
    loadingMore: 'Φόρτωση περισσότερων',
    noResults: 'Δεν υπάρχουν αποτελέσματα',
  },
  'en-US': {
    dragHandle: 'Drag handle',
    loading: 'Loading',
    loadingMore: 'Loading more',
    noResults: 'No results',
  },
  'es-ES': {
    dragHandle: 'Control de arrastre',
    loading: 'Cargando',
    loadingMore: 'Cargando más',
    noResults: 'No hay resultados',
  },
  'et-EE': {
    dragHandle: 'Lohistamispide',
    loading: 'Laadimine',
    loadingMore: 'Laaditakse veel',
    noResults: 'Tulemusi pole',
  },
  'fi-FI': {
    dragHandle: 'Vetokahva',
    loading: 'Ladataan',
    loadingMore: 'Ladataan lisää',
    noResults: 'Ei tuloksia',
  },
  'fr-FR': {
    dragHandle: 'Poignée de déplacement',
    loading: 'Chargement',
    loadingMore: 'Chargement de la suite',
    noResults: 'Aucun résultat',
  },
  'he-IL': {
    dragHandle: 'ידית גרירה',
    loading: 'טוען',
    loadingMore: 'טוען עוד',
    noResults: 'אין תוצאות',
  },
  'hr-HR': {
    dragHandle: 'Ručica za povlačenje',
    loading: 'Učitavanje',
    loadingMore: 'Učitava se još',
    noResults: 'Nema rezultata',
  },
  'hu-HU': {
    dragHandle: 'Húzófogantyú',
    loading: 'Betöltés',
    loadingMore: 'Továbbiak betöltése',
    noResults: 'Nincs találat',
  },
  'it-IT': {
    dragHandle: 'Punto di trascinamento',
    loading: 'Caricamento',
    loadingMore: 'Caricamento di altri elementi',
    noResults: 'Nessun risultato',
  },
  'ja-JP': {
    dragHandle: 'ドラッグハンドル',
    loading: '読み込み中',
    loadingMore: 'さらに読み込み中',
    noResults: '結果がありません',
  },
  'ko-KR': {
    dragHandle: '드래그 핸들',
    loading: '로드 중',
    loadingMore: '더 로드하는 중',
    noResults: '결과 없음',
  },
  'lt-LT': {
    dragHandle: 'Vilkimo rankenėlė',
    loading: 'Įkeliama',
    loadingMore: 'Įkeliama daugiau',
    noResults: 'Rezultatų nėra',
  },
  'lv-LV': {
    dragHandle: 'Vilkšanas turis',
    loading: 'Notiek ielāde',
    loadingMore: 'Notiek papildu ielāde',
    noResults: 'Nav rezultātu',
  },
  'nb-NO': {
    dragHandle: 'Drahåndtak',
    loading: 'Laster inn',
    loadingMore: 'Laster inn flere',
    noResults: 'Ingen resultater',
  },
  'nl-NL': {
    dragHandle: 'Sleepgreep',
    loading: 'Laden',
    loadingMore: 'Meer laden',
    noResults: 'Geen resultaten',
  },
  'pl-PL': {
    dragHandle: 'Uchwyt do przeciągania',
    loading: 'Ładowanie',
    loadingMore: 'Ładowanie kolejnych',
    noResults: 'Brak wyników',
  },
  'pt-BR': {
    dragHandle: 'Alça de arrastar',
    loading: 'Carregando',
    loadingMore: 'Carregando mais',
    noResults: 'Nenhum resultado',
  },
  'pt-PT': {
    dragHandle: 'Pega para arrastar',
    loading: 'A carregar',
    loadingMore: 'A carregar mais',
    noResults: 'Nenhum resultado',
  },
  'ro-RO': {
    dragHandle: 'Mâner de tragere',
    loading: 'Se încarcă',
    loadingMore: 'Se încarcă mai multe',
    noResults: 'Niciun rezultat',
  },
  'ru-RU': {
    dragHandle: 'Маркер перемещения',
    loading: 'Загрузка',
    loadingMore: 'Загрузка ещё',
    noResults: 'Нет результатов',
  },
  'sk-SK': {
    dragHandle: 'Úchyt na presúvanie',
    loading: 'Načítava sa',
    loadingMore: 'Načítavajú sa ďalšie',
    noResults: 'Žiadne výsledky',
  },
  'sl-SI': {
    dragHandle: 'Ročica za vlečenje',
    loading: 'Nalaganje',
    loadingMore: 'Nalaganje več',
    noResults: 'Ni rezultatov',
  },
  'sr-SP': {
    dragHandle: 'Ručica za prevlačenje',
    loading: 'Učitavanje',
    loadingMore: 'Učitavanje još',
    noResults: 'Nema rezultata',
  },
  'sv-SE': {
    dragHandle: 'Draghandtag',
    loading: 'Läser in',
    loadingMore: 'Läser in fler',
    noResults: 'Inga resultat',
  },
  'tr-TR': {
    dragHandle: 'Sürükleme tutamacı',
    loading: 'Yükleniyor',
    loadingMore: 'Daha fazlası yükleniyor',
    noResults: 'Sonuç yok',
  },
  'uk-UA': {
    dragHandle: 'Маркер переміщення',
    loading: 'Завантаження',
    loadingMore: 'Завантаження ще',
    noResults: 'Немає результатів',
  },
  'zh-CN': {
    dragHandle: '拖动手柄',
    loading: '正在加载',
    loadingMore: '正在加载更多',
    noResults: '没有结果',
  },
  'zh-TW': {
    dragHandle: '拖曳控點',
    loading: '正在載入',
    loadingMore: '正在載入更多',
    noResults: '沒有結果',
  },
}

export { MESSAGES }
export type { LibraryMessages }
