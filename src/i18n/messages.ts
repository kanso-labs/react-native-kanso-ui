// The words the library writes itself: the pending ring's name, a bottom
// sheet's drag handle, a collection's loading-more and empty rows, what
// selecting a list's row is called, and how many rows a search leaves. Each
// but the last stands behind a prop that names it otherwise: `pendingLabel`
// for the ring, `aria-label` for the handle, `label` for the loading-more
// row, `renderEmptyState` for the empty one and `selectLabel` for the
// selection.
//
// Copied from kanso-ui's src/i18n/messages.ts, one entry per locale React
// Aria ships, and kept in step with it by hand: the web library publishes no
// copy of its table, and a word that differs between the two would name the
// same ring two ways. The handle's name is this table's alone, since web's
// sheet draws its handle as decoration and names nothing. `select` is React
// Aria's own word for a grid list row's checkbox, which web's List takes
// from React Aria's tables rather than its own, copied here so the two read
// the same. `results` is React Aria's too, the count its ComboBox announces,
// which Autocomplete announces as a search narrows a list. The others were
// drafted for kanso-ui's table rather than taken from a translation service,
// and each one wants a native speaker's eye before it is trusted; a call
// site can always pass its own words through the prop.

type LibraryMessages = {
  /** What a bottom sheet's handle is called, where it is a control. */
  readonly dragHandle: string
  /** What a pending button's ring is called. */
  readonly loading: string
  /** What a collection's row says while more items are on their way. */
  readonly loadingMore: string
  /** What a collection with nothing in it says. */
  readonly noResults: string
  /**
   * How many rows a search leaves, for a screen reader, in the plural
   * forms React Aria's table gives the locale; `{count}` is the number.
   */
  readonly results: {
    readonly one: string
    readonly other: string
  }
  /** What selecting a list's row is called, beside its checkbox. */
  readonly select: string
}

const MESSAGES: Readonly<Record<string, LibraryMessages>> = {
  'ar-AE': {
    dragHandle: 'مقبض السحب',
    loading: 'جارٍ التحميل',
    loadingMore: 'جارٍ تحميل المزيد',
    noResults: 'لا توجد نتائج',
    results: {
      one: '{count} خيار متاحة.',
      other: '{count} خيارات متاحة.',
    },
    select: 'تحديد',
  },
  'bg-BG': {
    dragHandle: 'Манипулатор за плъзгане',
    loading: 'Зареждане',
    loadingMore: 'Зареждане на още',
    noResults: 'Няма резултати',
    results: {
      one: '{count} опция на разположение.',
      other: '{count} опции на разположение.',
    },
    select: 'Изберете',
  },
  'cs-CZ': {
    dragHandle: 'Úchyt pro přetažení',
    loading: 'Načítání',
    loadingMore: 'Načítání dalších',
    noResults: 'Žádné výsledky',
    results: {
      one: 'K dispozici je {count} možnost.',
      other: 'K dispozici jsou/je {count} možnosti/-í.',
    },
    select: 'Vybrat',
  },
  'da-DK': {
    dragHandle: 'Trækhåndtag',
    loading: 'Indlæser',
    loadingMore: 'Indlæser flere',
    noResults: 'Ingen resultater',
    results: {
      one: '{count} mulighed tilgængelig.',
      other: '{count} muligheder tilgængelige.',
    },
    select: 'Vælg',
  },
  'de-DE': {
    dragHandle: 'Ziehpunkt',
    loading: 'Wird geladen',
    loadingMore: 'Weitere werden geladen',
    noResults: 'Keine Ergebnisse',
    results: {
      one: '{count} Option verfügbar.',
      other: '{count} Optionen verfügbar.',
    },
    select: 'Auswählen',
  },
  'el-GR': {
    dragHandle: 'Λαβή μεταφοράς',
    loading: 'Φόρτωση',
    loadingMore: 'Φόρτωση περισσότερων',
    noResults: 'Δεν υπάρχουν αποτελέσματα',
    results: {
      one: '{count} επιλογή διαθέσιμες.',
      other: '{count} επιλογές  διαθέσιμες.',
    },
    select: 'Επιλογή',
  },
  'en-US': {
    dragHandle: 'Drag handle',
    loading: 'Loading',
    loadingMore: 'Loading more',
    noResults: 'No results',
    results: {
      one: '{count} option available.',
      other: '{count} options available.',
    },
    select: 'Select',
  },
  'es-ES': {
    dragHandle: 'Control de arrastre',
    loading: 'Cargando',
    loadingMore: 'Cargando más',
    noResults: 'No hay resultados',
    results: {
      one: '{count} opción disponible(s).',
      other: '{count} opciones disponible(s).',
    },
    select: 'Seleccionar',
  },
  'et-EE': {
    dragHandle: 'Lohistamispide',
    loading: 'Laadimine',
    loadingMore: 'Laaditakse veel',
    noResults: 'Tulemusi pole',
    results: {
      one: '{count} valik saadaval.',
      other: '{count} valikud saadaval.',
    },
    select: 'Vali',
  },
  'fi-FI': {
    dragHandle: 'Vetokahva',
    loading: 'Ladataan',
    loadingMore: 'Ladataan lisää',
    noResults: 'Ei tuloksia',
    results: {
      one: '{count} vaihtoehto saatavilla.',
      other: '{count} vaihtoehtoa saatavilla.',
    },
    select: 'Valitse',
  },
  'fr-FR': {
    dragHandle: 'Poignée de déplacement',
    loading: 'Chargement',
    loadingMore: 'Chargement de la suite',
    noResults: 'Aucun résultat',
    results: {
      one: '{count} option disponible(s).',
      other: '{count} options disponible(s).',
    },
    select: 'Sélectionner',
  },
  'he-IL': {
    dragHandle: 'ידית גרירה',
    loading: 'טוען',
    loadingMore: 'טוען עוד',
    noResults: 'אין תוצאות',
    results: {
      one: 'אפשרות {count} במצב זמין.',
      other: '{count} אפשרויות במצב זמין.',
    },
    select: 'בחר',
  },
  'hr-HR': {
    dragHandle: 'Ručica za povlačenje',
    loading: 'Učitavanje',
    loadingMore: 'Učitava se još',
    noResults: 'Nema rezultata',
    results: {
      one: 'Dostupno još: {count} opcija.',
      other: 'Dostupno još: {count} opcije/a.',
    },
    select: 'Odaberite',
  },
  'hu-HU': {
    dragHandle: 'Húzófogantyú',
    loading: 'Betöltés',
    loadingMore: 'Továbbiak betöltése',
    noResults: 'Nincs találat',
    results: {
      one: '{count} lehetőség áll rendelkezésre.',
      other: '{count} lehetőség áll rendelkezésre.',
    },
    select: 'Kijelölés',
  },
  'it-IT': {
    dragHandle: 'Punto di trascinamento',
    loading: 'Caricamento',
    loadingMore: 'Caricamento di altri elementi',
    noResults: 'Nessun risultato',
    results: {
      one: '{count} opzione disponibile.',
      other: '{count} opzioni disponibili.',
    },
    select: 'Seleziona',
  },
  'ja-JP': {
    dragHandle: 'ドラッグハンドル',
    loading: '読み込み中',
    loadingMore: 'さらに読み込み中',
    noResults: '結果がありません',
    results: {
      one: '{count} 個のオプションを利用できます。',
      other: '{count} 個のオプションを利用できます。',
    },
    select: '選択',
  },
  'ko-KR': {
    dragHandle: '드래그 핸들',
    loading: '로드 중',
    loadingMore: '더 로드하는 중',
    noResults: '결과 없음',
    results: {
      one: '{count}개 옵션을 사용할 수 있습니다.',
      other: '{count}개 옵션을 사용할 수 있습니다.',
    },
    select: '선택',
  },
  'lt-LT': {
    dragHandle: 'Vilkimo rankenėlė',
    loading: 'Įkeliama',
    loadingMore: 'Įkeliama daugiau',
    noResults: 'Rezultatų nėra',
    results: {
      one: 'Yra {count} parinktis.',
      other: 'Yra {count} parinktys (-ių).',
    },
    select: 'Pasirinkti',
  },
  'lv-LV': {
    dragHandle: 'Vilkšanas turis',
    loading: 'Notiek ielāde',
    loadingMore: 'Notiek papildu ielāde',
    noResults: 'Nav rezultātu',
    results: {
      one: 'Pieejamo opciju skaits: {count} opcija.',
      other: 'Pieejamo opciju skaits: {count} opcijas.',
    },
    select: 'Atlasīt',
  },
  'nb-NO': {
    dragHandle: 'Drahåndtak',
    loading: 'Laster inn',
    loadingMore: 'Laster inn flere',
    noResults: 'Ingen resultater',
    results: {
      one: '{count} alternativ finnes.',
      other: '{count} alternativer finnes.',
    },
    select: 'Velg',
  },
  'nl-NL': {
    dragHandle: 'Sleepgreep',
    loading: 'Laden',
    loadingMore: 'Meer laden',
    noResults: 'Geen resultaten',
    results: {
      one: '{count} optie beschikbaar.',
      other: '{count} opties beschikbaar.',
    },
    select: 'Selecteren',
  },
  'pl-PL': {
    dragHandle: 'Uchwyt do przeciągania',
    loading: 'Ładowanie',
    loadingMore: 'Ładowanie kolejnych',
    noResults: 'Brak wyników',
    results: {
      one: 'dostępna/dostępne(-nych) {count} opcja.',
      other: 'dostępna/dostępne(-nych) {count} opcje(-i).',
    },
    select: 'Zaznacz',
  },
  'pt-BR': {
    dragHandle: 'Alça de arrastar',
    loading: 'Carregando',
    loadingMore: 'Carregando mais',
    noResults: 'Nenhum resultado',
    results: {
      one: '{count} opção disponível.',
      other: '{count} opções disponível.',
    },
    select: 'Selecionar',
  },
  'pt-PT': {
    dragHandle: 'Pega para arrastar',
    loading: 'A carregar',
    loadingMore: 'A carregar mais',
    noResults: 'Nenhum resultado',
    results: {
      one: '{count} opção disponível.',
      other: '{count} opções disponível.',
    },
    select: 'Selecionar',
  },
  'ro-RO': {
    dragHandle: 'Mâner de tragere',
    loading: 'Se încarcă',
    loadingMore: 'Se încarcă mai multe',
    noResults: 'Niciun rezultat',
    results: {
      one: '{count} opțiune disponibile.',
      other: '{count} opțiuni disponibile.',
    },
    select: 'Selectare',
  },
  'ru-RU': {
    dragHandle: 'Маркер перемещения',
    loading: 'Загрузка',
    loadingMore: 'Загрузка ещё',
    noResults: 'Нет результатов',
    results: {
      one: '{count} параметр доступно.',
      other: '{count} параметров доступно.',
    },
    select: 'Выбрать',
  },
  'sk-SK': {
    dragHandle: 'Úchyt na presúvanie',
    loading: 'Načítava sa',
    loadingMore: 'Načítavajú sa ďalšie',
    noResults: 'Žiadne výsledky',
    results: {
      one: '{count} možnosť k dispozícii.',
      other: '{count} možnosti/-í k dispozícii.',
    },
    select: 'Vybrať',
  },
  'sl-SI': {
    dragHandle: 'Ročica za vlečenje',
    loading: 'Nalaganje',
    loadingMore: 'Nalaganje več',
    noResults: 'Ni rezultatov',
    results: {
      one: 'Na voljo je {count} opcija.',
      other: 'Na voljo je {count} opcije.',
    },
    select: 'Izberite',
  },
  'sr-SP': {
    dragHandle: 'Ručica za prevlačenje',
    loading: 'Učitavanje',
    loadingMore: 'Učitavanje još',
    noResults: 'Nema rezultata',
    results: {
      one: 'Dostupno još: {count} opcija.',
      other: 'Dostupno još: {count} opcije/a.',
    },
    select: 'Izaberite',
  },
  'sv-SE': {
    dragHandle: 'Draghandtag',
    loading: 'Läser in',
    loadingMore: 'Läser in fler',
    noResults: 'Inga resultat',
    results: {
      one: '{count} alternativ tillgängliga.',
      other: '{count} alternativ tillgängliga.',
    },
    select: 'Markera',
  },
  'tr-TR': {
    dragHandle: 'Sürükleme tutamacı',
    loading: 'Yükleniyor',
    loadingMore: 'Daha fazlası yükleniyor',
    noResults: 'Sonuç yok',
    results: {
      one: '{count} seçenek kullanılabilir.',
      other: '{count} seçenekler kullanılabilir.',
    },
    select: 'Seç',
  },
  'uk-UA': {
    dragHandle: 'Маркер переміщення',
    loading: 'Завантаження',
    loadingMore: 'Завантаження ще',
    noResults: 'Немає результатів',
    results: {
      one: '{count} параметр доступно.',
      other: '{count} параметри(-ів) доступно.',
    },
    select: 'Вибрати',
  },
  'zh-CN': {
    dragHandle: '拖动手柄',
    loading: '正在加载',
    loadingMore: '正在加载更多',
    noResults: '没有结果',
    results: {
      one: '有 {count} 个选项可用。',
      other: '有 {count} 个选项可用。',
    },
    select: '选择',
  },
  'zh-TW': {
    dragHandle: '拖曳控點',
    loading: '正在載入',
    loadingMore: '正在載入更多',
    noResults: '沒有結果',
    results: {
      one: '{count} 選項 可用。',
      other: '{count} 選項 可用。',
    },
    select: '選取',
  },
}

export { MESSAGES }
export type { LibraryMessages }
