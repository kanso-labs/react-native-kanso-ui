// The words the library writes itself: the pending ring's name, a bottom
// sheet's drag handle, a collection's loading-more and empty rows, what
// selecting a list's row is called, how many rows a search leaves, and a
// calendar's. Each of the first five stands behind a prop that names it
// otherwise: `pendingLabel` for the ring, `aria-label` for the handle,
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
// the same. `results` is React Aria's too, the count its ComboBox announces,
// which Autocomplete announces as a search narrows a list. `calendar` is
// React Aria's calendar dictionary, which web's Calendar reads, beside the
// names of the month and year fields that web reads from the browser's
// `Intl.DisplayNames` and Hermes lacks, written here from the same CLDR
// data. The others were drafted for kanso-ui's table rather than taken from
// a translation service, and each one wants a native speaker's eye before it
// is trusted; a call site can always pass its own words through the prop.

type LibraryMessages = {
  /**
   * The words a calendar writes: its two chevrons, the names its dates
   * take, where `{date}` is the date written out in full, and the fields
   * its month and year menus are named by.
   */
  readonly calendar: {
    /** A date the calendar holds. */
    readonly dateSelected: string
    /** Added after the latest date `maxValue` allows. */
    readonly maximumDate: string
    /** Added after the earliest date `minValue` allows. */
    readonly minimumDate: string
    /** What the month is called, after the month a menu button shows. */
    readonly month: string
    /** The chevron that moves to the next month. */
    readonly next: string
    /** The chevron that moves to the previous month. */
    readonly previous: string
    /** Today, when the calendar does not hold it. */
    readonly todayDate: string
    /** Today, when the calendar holds it. */
    readonly todayDateSelected: string
    /** What the year is called, after the year a menu button shows. */
    readonly year: string
  }
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
    calendar: {
      dateSelected: '{date} المحدد',
      maximumDate: 'آخر تاريخ متاح',
      minimumDate: 'أول تاريخ متاح',
      month: 'الشهر',
      next: 'التالي',
      previous: 'السابق',
      todayDate: 'اليوم، {date}',
      todayDateSelected: 'اليوم، {date} محدد',
      year: 'السنة',
    },
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
    calendar: {
      dateSelected: 'Избрано е {date}',
      maximumDate: 'Последна налична дата',
      minimumDate: 'Първа налична дата',
      month: 'месец',
      next: 'Напред',
      previous: 'Назад',
      todayDate: 'Днес, {date}',
      todayDateSelected: 'Днес, {date} са избрани',
      year: 'година',
    },
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
    calendar: {
      dateSelected: 'Vybráno {date}',
      maximumDate: 'Poslední dostupné datum',
      minimumDate: 'První dostupné datum',
      month: 'měsíc',
      next: 'Další',
      previous: 'Předchozí',
      todayDate: 'Dnes, {date}',
      todayDateSelected: 'Dnes, vybráno {date}',
      year: 'rok',
    },
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
    calendar: {
      dateSelected: '{date} valgt',
      maximumDate: 'Sidste ledige dato',
      minimumDate: 'Første ledige dato',
      month: 'måned',
      next: 'Næste',
      previous: 'Forrige',
      todayDate: 'I dag, {date}',
      todayDateSelected: 'I dag, {date} valgt',
      year: 'år',
    },
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
    calendar: {
      dateSelected: '{date} ausgewählt',
      maximumDate: 'Letztes verfügbares Datum',
      minimumDate: 'Erstes verfügbares Datum',
      month: 'Monat',
      next: 'Weiter',
      previous: 'Zurück',
      todayDate: 'Heute, {date}',
      todayDateSelected: 'Heute, {date} ausgewählt',
      year: 'Jahr',
    },
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
    calendar: {
      dateSelected: 'Επιλέχθηκε {date}',
      maximumDate: 'Τελευταία διαθέσιμη ημερομηνία',
      minimumDate: 'Πρώτη διαθέσιμη ημερομηνία',
      month: 'μήνας',
      next: 'Επόμενο',
      previous: 'Προηγούμενο',
      todayDate: 'Σήμερα, {date}',
      todayDateSelected: 'Σήμερα, επιλέχτηκε {date}',
      year: 'έτος',
    },
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
    calendar: {
      dateSelected: '{date} selected',
      maximumDate: 'Last available date',
      minimumDate: 'First available date',
      month: 'month',
      next: 'Next',
      previous: 'Previous',
      todayDate: 'Today, {date}',
      todayDateSelected: 'Today, {date} selected',
      year: 'year',
    },
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
    calendar: {
      dateSelected: '{date} seleccionado',
      maximumDate: 'Última fecha disponible',
      minimumDate: 'Primera fecha disponible',
      month: 'mes',
      next: 'Siguiente',
      previous: 'Anterior',
      todayDate: 'Hoy, {date}',
      todayDateSelected: 'Hoy, {date} seleccionado',
      year: 'año',
    },
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
    calendar: {
      dateSelected: '{date} valitud',
      maximumDate: 'Viimane saadaolev kuupäev',
      minimumDate: 'Esimene saadaolev kuupäev',
      month: 'kuu',
      next: 'Järgmine',
      previous: 'Eelmine',
      todayDate: 'Täna, {date}',
      todayDateSelected: 'Täna, {date} valitud',
      year: 'aasta',
    },
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
    calendar: {
      dateSelected: '{date} valittu',
      maximumDate: 'Viimeinen varattavissa oleva päivämäärä',
      minimumDate: 'Ensimmäinen varattavissa oleva päivämäärä',
      month: 'kuukausi',
      next: 'Seuraava',
      previous: 'Edellinen',
      todayDate: 'Tänään, {date}',
      todayDateSelected: 'Tänään, {date} valittu',
      year: 'vuosi',
    },
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
    calendar: {
      dateSelected: '{date} sélectionné',
      maximumDate: 'Dernière date disponible',
      minimumDate: 'Première date disponible',
      month: 'mois',
      next: 'Suivant',
      previous: 'Précédent',
      todayDate: "Aujourd'hui, {date}",
      todayDateSelected: 'Aujourd’hui, {date} sélectionné',
      year: 'année',
    },
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
    calendar: {
      dateSelected: '{date} נבחר',
      maximumDate: 'תאריך פנוי אחרון',
      minimumDate: 'תאריך פנוי ראשון',
      month: 'חודש',
      next: 'הבא',
      previous: 'הקודם',
      todayDate: 'היום, {date}',
      todayDateSelected: 'היום, {date} נבחר',
      year: 'שנה',
    },
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
    calendar: {
      dateSelected: '{date} odabran',
      maximumDate: 'Posljednji raspoloživi datum',
      minimumDate: 'Prvi raspoloživi datum',
      month: 'mjesec',
      next: 'Sljedeći',
      previous: 'Prethodni',
      todayDate: 'Danas, {date}',
      todayDateSelected: 'Danas, odabran {date}',
      year: 'godina',
    },
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
    calendar: {
      dateSelected: '{date} kiválasztva',
      maximumDate: 'Utolsó elérhető dátum',
      minimumDate: 'Az első elérhető dátum',
      month: 'hónap',
      next: 'Következő',
      previous: 'Előző',
      todayDate: 'Ma, {date}',
      todayDateSelected: 'Ma, {date} kijelölve',
      year: 'év',
    },
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
    calendar: {
      dateSelected: '{date} selezionata',
      maximumDate: 'Ultima data disponibile',
      minimumDate: 'Prima data disponibile',
      month: 'mese',
      next: 'Successivo',
      previous: 'Precedente',
      todayDate: 'Oggi, {date}',
      todayDateSelected: 'Oggi, {date} selezionata',
      year: 'anno',
    },
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
    calendar: {
      dateSelected: '{date} を選択',
      maximumDate: '最終利用可能日',
      minimumDate: '最初の利用可能日',
      month: '月',
      next: '次へ',
      previous: '前へ',
      todayDate: '本日、{date}',
      todayDateSelected: '本日、{date} を選択',
      year: '年',
    },
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
    calendar: {
      dateSelected: '{date} 선택됨',
      maximumDate: '마지막으로 사용 가능한 일자',
      minimumDate: '처음으로 사용 가능한 일자',
      month: '월',
      next: '다음',
      previous: '이전',
      todayDate: '오늘, {date}',
      todayDateSelected: '오늘, {date} 선택됨',
      year: '년',
    },
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
    calendar: {
      dateSelected: 'Pasirinkta {date}',
      maximumDate: 'Paskutinė galima data',
      minimumDate: 'Pirmoji galima data',
      month: 'mėnuo',
      next: 'Paskesnis',
      previous: 'Ankstesnis',
      todayDate: 'Šiandien, {date}',
      todayDateSelected: 'Šiandien, pasirinkta {date}',
      year: 'metai',
    },
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
    calendar: {
      dateSelected: 'Atlasīts: {date}',
      maximumDate: 'Pēdējais pieejamais datums',
      minimumDate: 'Pirmais pieejamais datums',
      month: 'mēnesis',
      next: 'Tālāk',
      previous: 'Atpakaļ',
      todayDate: 'Šodien, {date}',
      todayDateSelected: 'Atlasīta šodiena, {date}',
      year: 'gads',
    },
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
    calendar: {
      dateSelected: '{date} valgt',
      maximumDate: 'Siste tilgjengelige dato',
      minimumDate: 'Første tilgjengelige dato',
      month: 'måned',
      next: 'Neste',
      previous: 'Forrige',
      todayDate: 'I dag, {date}',
      todayDateSelected: 'I dag, {date} valgt',
      year: 'år',
    },
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
    calendar: {
      dateSelected: '{date} geselecteerd',
      maximumDate: 'Laatste beschikbare datum',
      minimumDate: 'Eerste beschikbare datum',
      month: 'maand',
      next: 'Volgende',
      previous: 'Vorige',
      todayDate: 'Vandaag, {date}',
      todayDateSelected: 'Vandaag, {date} geselecteerd',
      year: 'jaar',
    },
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
    calendar: {
      dateSelected: 'Wybrano {date}',
      maximumDate: 'Ostatnia dostępna data',
      minimumDate: 'Pierwsza dostępna data',
      month: 'miesiąc',
      next: 'Dalej',
      previous: 'Wstecz',
      todayDate: 'Dzisiaj, {date}',
      todayDateSelected: 'Dzisiaj wybrano {date}',
      year: 'rok',
    },
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
    calendar: {
      dateSelected: '{date} selecionado',
      maximumDate: 'Última data disponível',
      minimumDate: 'Primeira data disponível',
      month: 'mês',
      next: 'Próximo',
      previous: 'Anterior',
      todayDate: 'Hoje, {date}',
      todayDateSelected: 'Hoje, {date} selecionado',
      year: 'ano',
    },
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
    calendar: {
      dateSelected: '{date} selecionado',
      maximumDate: 'Última data disponível',
      minimumDate: 'Primeira data disponível',
      month: 'mês',
      next: 'Próximo',
      previous: 'Anterior',
      todayDate: 'Hoje, {date}',
      todayDateSelected: 'Hoje, {date} selecionado',
      year: 'ano',
    },
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
    calendar: {
      dateSelected: '{date} selectată',
      maximumDate: 'Ultima dată disponibilă',
      minimumDate: 'Prima dată disponibilă',
      month: 'lună',
      next: 'Următorul',
      previous: 'Înainte',
      todayDate: 'Astăzi, {date}',
      todayDateSelected: 'Azi, {date} selectată',
      year: 'an',
    },
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
    calendar: {
      dateSelected: 'Выбрано {date}',
      maximumDate: 'Последняя доступная дата',
      minimumDate: 'Первая доступная дата',
      month: 'месяц',
      next: 'Далее',
      previous: 'Назад',
      todayDate: 'Сегодня, {date}',
      todayDateSelected: 'Сегодня, выбрано {date}',
      year: 'год',
    },
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
    calendar: {
      dateSelected: 'Vybratý dátum {date}',
      maximumDate: 'Posledný dostupný dátum',
      minimumDate: 'Prvý dostupný dátum',
      month: 'mesiac',
      next: 'Nasledujúce',
      previous: 'Predchádzajúce',
      todayDate: 'Dnes {date}',
      todayDateSelected: 'Vybratý dnešný dátum {date}',
      year: 'rok',
    },
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
    calendar: {
      dateSelected: '{date} izbrano',
      maximumDate: 'Zadnji razpoložljivi datum',
      minimumDate: 'Prvi razpoložljivi datum',
      month: 'mesec',
      next: 'Naprej',
      previous: 'Nazaj',
      todayDate: 'Danes, {date}',
      todayDateSelected: 'Danes, {date} izbrano',
      year: 'leto',
    },
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
    calendar: {
      dateSelected: '{date} izabran',
      maximumDate: 'Zadnji raspoloživi datum',
      minimumDate: 'Prvi raspoloživi datum',
      month: 'месец',
      next: 'Sledeći',
      previous: 'Prethodni',
      todayDate: 'Danas, {date}',
      todayDateSelected: 'Danas, izabran {date}',
      year: 'година',
    },
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
    calendar: {
      dateSelected: '{date} har valts',
      maximumDate: 'Sista tillgängliga datum',
      minimumDate: 'Första tillgängliga datum',
      month: 'månad',
      next: 'Nästa',
      previous: 'Föregående',
      todayDate: 'Idag, {date}',
      todayDateSelected: 'Idag, {date} har valts',
      year: 'år',
    },
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
    calendar: {
      dateSelected: '{date} seçildi',
      maximumDate: 'Son müsait tarih',
      minimumDate: 'İlk müsait tarih',
      month: 'ay',
      next: 'Sonraki',
      previous: 'Önceki',
      todayDate: 'Bugün, {date}',
      todayDateSelected: 'Bugün, {date} seçildi',
      year: 'yıl',
    },
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
    calendar: {
      dateSelected: 'Вибрано {date}',
      maximumDate: 'Остання доступна дата',
      minimumDate: 'Перша доступна дата',
      month: 'місяць',
      next: 'Наступний',
      previous: 'Попередній',
      todayDate: 'Сьогодні, {date}',
      todayDateSelected: 'Сьогодні, вибрано {date}',
      year: 'рік',
    },
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
    calendar: {
      dateSelected: '已选择 {date}',
      maximumDate: '最后一个可用日期',
      minimumDate: '第一个可用日期',
      month: '月',
      next: '下一页',
      previous: '上一页',
      todayDate: '今天，即 {date}',
      todayDateSelected: '已选择今天，即 {date}',
      year: '年',
    },
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
    calendar: {
      dateSelected: '已選取 {date}',
      maximumDate: '最後一個可用日期',
      minimumDate: '第一個可用日期',
      month: '月',
      next: '下一頁',
      previous: '上一頁',
      todayDate: '今天，{date}',
      todayDateSelected: '已選取今天，{date}',
      year: '年',
    },
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
