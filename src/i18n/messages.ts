// The words the library writes itself: the pending ring's name, a bottom
// sheet's drag handle, a collection's loading-more and empty rows, and what
// selecting a list's row is called. Each one stands behind a prop that names
// it otherwise: `pendingLabel` for the ring, `aria-label` for the handle,
// `label` for the loading-more row, `renderEmptyState` for the empty one and
// `selectLabel` for the selection.
//
// Copied from kanso-ui's src/i18n/messages.ts, one entry per locale React
// Aria ships, and kept in step with it by hand: the web library publishes no
// copy of its table, and a word that differs between the two would name the
// same ring two ways. The handle's name is this table's alone, since web's
// sheet draws its handle as decoration and names nothing. `select` is React
// Aria's own word for a grid list row's checkbox, which web's List takes
// from React Aria's tables rather than its own, copied here so the two read
// the same. The others were drafted for kanso-ui's table rather than taken
// from a translation service, and each one wants a native speaker's eye
// before it is trusted; a call site can always pass its own words through
// the prop.

type LibraryMessages = {
  /** What a bottom sheet's handle is called, where it is a control. */
  readonly dragHandle: string
  /** What a pending button's ring is called. */
  readonly loading: string
  /** What a collection's row says while more items are on their way. */
  readonly loadingMore: string
  /** What a collection with nothing in it says. */
  readonly noResults: string
  /** What selecting a list's row is called, beside its checkbox. */
  readonly select: string
}

const MESSAGES: Readonly<Record<string, LibraryMessages>> = {
  'ar-AE': {
    dragHandle: 'مقبض السحب',
    loading: 'جارٍ التحميل',
    loadingMore: 'جارٍ تحميل المزيد',
    noResults: 'لا توجد نتائج',
    select: 'تحديد',
  },
  'bg-BG': {
    dragHandle: 'Манипулатор за плъзгане',
    loading: 'Зареждане',
    loadingMore: 'Зареждане на още',
    noResults: 'Няма резултати',
    select: 'Изберете',
  },
  'cs-CZ': {
    dragHandle: 'Úchyt pro přetažení',
    loading: 'Načítání',
    loadingMore: 'Načítání dalších',
    noResults: 'Žádné výsledky',
    select: 'Vybrat',
  },
  'da-DK': {
    dragHandle: 'Trækhåndtag',
    loading: 'Indlæser',
    loadingMore: 'Indlæser flere',
    noResults: 'Ingen resultater',
    select: 'Vælg',
  },
  'de-DE': {
    dragHandle: 'Ziehpunkt',
    loading: 'Wird geladen',
    loadingMore: 'Weitere werden geladen',
    noResults: 'Keine Ergebnisse',
    select: 'Auswählen',
  },
  'el-GR': {
    dragHandle: 'Λαβή μεταφοράς',
    loading: 'Φόρτωση',
    loadingMore: 'Φόρτωση περισσότερων',
    noResults: 'Δεν υπάρχουν αποτελέσματα',
    select: 'Επιλογή',
  },
  'en-US': {
    dragHandle: 'Drag handle',
    loading: 'Loading',
    loadingMore: 'Loading more',
    noResults: 'No results',
    select: 'Select',
  },
  'es-ES': {
    dragHandle: 'Control de arrastre',
    loading: 'Cargando',
    loadingMore: 'Cargando más',
    noResults: 'No hay resultados',
    select: 'Seleccionar',
  },
  'et-EE': {
    dragHandle: 'Lohistamispide',
    loading: 'Laadimine',
    loadingMore: 'Laaditakse veel',
    noResults: 'Tulemusi pole',
    select: 'Vali',
  },
  'fi-FI': {
    dragHandle: 'Vetokahva',
    loading: 'Ladataan',
    loadingMore: 'Ladataan lisää',
    noResults: 'Ei tuloksia',
    select: 'Valitse',
  },
  'fr-FR': {
    dragHandle: 'Poignée de déplacement',
    loading: 'Chargement',
    loadingMore: 'Chargement de la suite',
    noResults: 'Aucun résultat',
    select: 'Sélectionner',
  },
  'he-IL': {
    dragHandle: 'ידית גרירה',
    loading: 'טוען',
    loadingMore: 'טוען עוד',
    noResults: 'אין תוצאות',
    select: 'בחר',
  },
  'hr-HR': {
    dragHandle: 'Ručica za povlačenje',
    loading: 'Učitavanje',
    loadingMore: 'Učitava se još',
    noResults: 'Nema rezultata',
    select: 'Odaberite',
  },
  'hu-HU': {
    dragHandle: 'Húzófogantyú',
    loading: 'Betöltés',
    loadingMore: 'Továbbiak betöltése',
    noResults: 'Nincs találat',
    select: 'Kijelölés',
  },
  'it-IT': {
    dragHandle: 'Punto di trascinamento',
    loading: 'Caricamento',
    loadingMore: 'Caricamento di altri elementi',
    noResults: 'Nessun risultato',
    select: 'Seleziona',
  },
  'ja-JP': {
    dragHandle: 'ドラッグハンドル',
    loading: '読み込み中',
    loadingMore: 'さらに読み込み中',
    noResults: '結果がありません',
    select: '選択',
  },
  'ko-KR': {
    dragHandle: '드래그 핸들',
    loading: '로드 중',
    loadingMore: '더 로드하는 중',
    noResults: '결과 없음',
    select: '선택',
  },
  'lt-LT': {
    dragHandle: 'Vilkimo rankenėlė',
    loading: 'Įkeliama',
    loadingMore: 'Įkeliama daugiau',
    noResults: 'Rezultatų nėra',
    select: 'Pasirinkti',
  },
  'lv-LV': {
    dragHandle: 'Vilkšanas turis',
    loading: 'Notiek ielāde',
    loadingMore: 'Notiek papildu ielāde',
    noResults: 'Nav rezultātu',
    select: 'Atlasīt',
  },
  'nb-NO': {
    dragHandle: 'Drahåndtak',
    loading: 'Laster inn',
    loadingMore: 'Laster inn flere',
    noResults: 'Ingen resultater',
    select: 'Velg',
  },
  'nl-NL': {
    dragHandle: 'Sleepgreep',
    loading: 'Laden',
    loadingMore: 'Meer laden',
    noResults: 'Geen resultaten',
    select: 'Selecteren',
  },
  'pl-PL': {
    dragHandle: 'Uchwyt do przeciągania',
    loading: 'Ładowanie',
    loadingMore: 'Ładowanie kolejnych',
    noResults: 'Brak wyników',
    select: 'Zaznacz',
  },
  'pt-BR': {
    dragHandle: 'Alça de arrastar',
    loading: 'Carregando',
    loadingMore: 'Carregando mais',
    noResults: 'Nenhum resultado',
    select: 'Selecionar',
  },
  'pt-PT': {
    dragHandle: 'Pega para arrastar',
    loading: 'A carregar',
    loadingMore: 'A carregar mais',
    noResults: 'Nenhum resultado',
    select: 'Selecionar',
  },
  'ro-RO': {
    dragHandle: 'Mâner de tragere',
    loading: 'Se încarcă',
    loadingMore: 'Se încarcă mai multe',
    noResults: 'Niciun rezultat',
    select: 'Selectare',
  },
  'ru-RU': {
    dragHandle: 'Маркер перемещения',
    loading: 'Загрузка',
    loadingMore: 'Загрузка ещё',
    noResults: 'Нет результатов',
    select: 'Выбрать',
  },
  'sk-SK': {
    dragHandle: 'Úchyt na presúvanie',
    loading: 'Načítava sa',
    loadingMore: 'Načítavajú sa ďalšie',
    noResults: 'Žiadne výsledky',
    select: 'Vybrať',
  },
  'sl-SI': {
    dragHandle: 'Ročica za vlečenje',
    loading: 'Nalaganje',
    loadingMore: 'Nalaganje več',
    noResults: 'Ni rezultatov',
    select: 'Izberite',
  },
  'sr-SP': {
    dragHandle: 'Ručica za prevlačenje',
    loading: 'Učitavanje',
    loadingMore: 'Učitavanje još',
    noResults: 'Nema rezultata',
    select: 'Izaberite',
  },
  'sv-SE': {
    dragHandle: 'Draghandtag',
    loading: 'Läser in',
    loadingMore: 'Läser in fler',
    noResults: 'Inga resultat',
    select: 'Markera',
  },
  'tr-TR': {
    dragHandle: 'Sürükleme tutamacı',
    loading: 'Yükleniyor',
    loadingMore: 'Daha fazlası yükleniyor',
    noResults: 'Sonuç yok',
    select: 'Seç',
  },
  'uk-UA': {
    dragHandle: 'Маркер переміщення',
    loading: 'Завантаження',
    loadingMore: 'Завантаження ще',
    noResults: 'Немає результатів',
    select: 'Вибрати',
  },
  'zh-CN': {
    dragHandle: '拖动手柄',
    loading: '正在加载',
    loadingMore: '正在加载更多',
    noResults: '没有结果',
    select: '选择',
  },
  'zh-TW': {
    dragHandle: '拖曳控點',
    loading: '正在載入',
    loadingMore: '正在載入更多',
    noResults: '沒有結果',
    select: '選取',
  },
}

export { MESSAGES }
export type { LibraryMessages }
