import type { Dictionary } from './en';
import { plural } from './plural';

const characters = (count: number) =>
  plural('uk', count, { one: 'символ', few: 'символи', many: 'символів', other: 'символа' });

/** Ukrainian. Typed against `en`, so a missing or extra key fails the build. Reviewed by a native speaker at L2 hand-over. */
export const uk: Dictionary = {
  locale: 'uk',

  // Header
  appName: 'Voice to Ticket',
  steps: ['Звіт', 'Перевірка', 'Jira'],
  progress: 'Прогрес',
  languageSelector: 'Мова інтерфейсу',
  switchToLight: 'Увімкнути світлу тему',
  switchToDark: 'Увімкнути темну тему',

  // Page 1
  reportTitle: 'Опишіть помилку або нову функцію',
  reportHint:
    'Запишіть або завантажте голосовий звіт (англійською; .wav, .mp3, .webm або .ogg, до 5 хвилин і 25 МБ) чи введіть текст нижче. Запишіть або завантажте ще, щоб додати більше тексту до транскрипту. Перевірте текст, а потім створіть тікет.',
  record: 'Записати',
  stop: 'Зупинити',
  uploadRecording: 'Завантажити запис',
  audioFile: 'Аудіофайл',
  recordingTimer: (elapsed, max) => `Запис ${elapsed} / ${max}`,
  waitingForMicrophone: 'Очікування мікрофона…',
  transcribing: 'Транскрибування…',
  tryAgain: 'Спробувати ще раз',
  downloadRecording: 'Зберегти запис',
  transcript: 'Транскрипт',
  charactersNeeded: (count, min) => `${count} ${characters(count)}, потрібно щонайменше ${min}`,
  charactersOverLimit: (count, limit) =>
    `${count} ${characters(count)}, понад ліміт у ${limit.toLocaleString('uk-UA')} символів`,
  language: 'Мова',
  translate: 'Перекласти',
  generating: 'Створення…',
  generateTicket: 'Створити тікет',
  retry: 'Повторити',
  fakeBanner: 'Активний тестовий генератор — тікети несправжні',

  // Recorder messages
  noSpeech: 'Мовлення не виявлено. До транскрипту нічого не додано.',
  recordingUnsupported:
    'Цей браузер не підтримує запис. Скористайтеся актуальним Chrome або Edge чи введіть звіт текстом.',
  recordingFailed: 'Не вдалося записати. Спробуйте ще раз.',
  microphoneDenied:
    'Доступ до мікрофона заборонено. Дозвольте мікрофон для цього сайту в браузері та спробуйте ще раз.',
  microphoneMissing: 'Мікрофон не знайдено. Підключіть його та спробуйте ще раз.',
  microphoneFailed: 'Не вдалося запустити мікрофон. Перевірте, чи його не використовує інша програма, і спробуйте ще раз.',
  sttUnavailable:
    'Сервіс транскрибування недоступний. Запустіть його й натисніть «Спробувати ще раз» або завантажте запис на пристрій.',
  sttTimeout: 'Транскрибування тривало надто довго. Натисніть «Спробувати ще раз» або завантажте запис на пристрій.',
  audioTooLargeToTranscribe:
    'Запис завеликий для транскрибування (ліміт 25 МБ). Завантажте його на пристрій і запишіть коротший звіт.',
  audioUnreadable: 'Не вдалося прочитати аудіо. Використайте дійсний файл .wav, .mp3, .webm або .ogg.',
  serverUnreachableRecording:
    'Не вдалося зв’язатися із сервером. Запустіть його й натисніть «Спробувати ще раз» або завантажте запис на пристрій.',
  transcriptionFailed:
    'Під час транскрибування сталася помилка. Натисніть «Спробувати ще раз» або завантажте запис на пристрій.',

  // Upload checks
  fileTypeNotSupported: (accepted) => `Цей тип файлу не підтримується. Використайте ${accepted}.`,
  fileEmpty: 'Файл порожній.',
  fileTooLarge: 'Файл завеликий для транскрибування (ліміт 25 МБ).',
  recordingTooLong: (length) => `Тривалість запису — ${length}. Ліміт — 5:00. Використайте коротший файл.`,

  // Generation errors
  genericError: 'Щось пішло не так. Спробуйте ще раз.',
  errors: {
    llm_refused: 'Сервіс тікетів відмовився обробляти цей звіт. Відредагуйте транскрипт і натисніть «Створити тікет».',
    llm_invalid_output:
      'Сервіс тікетів повернув тікет, який неможливо використати. Спробуйте ще раз; якщо це повторюється, переформулюйте звіт.',
    llm_truncated:
      'Тікет обірвано, бо звіт завеликий для обробки за один раз. Спробуйте ще раз або використайте коротший звіт.',
    llm_unavailable:
      'Сервіс тікетів зараз недоступний. Спробуйте за хвилину; якщо проблема не зникає, попросіть того, хто запускає цей інструмент, перевірити налаштування.',
    llm_timeout: 'Сервіс тікетів відповідає надто довго. Спробуйте ще раз.',
    network_error: 'Не вдалося зв’язатися із сервером. Перевірте з’єднання й спробуйте ще раз.',
    unexpected_response:
      'Сервер надіслав відповідь, яку ця сторінка не розуміє. Можливо, він перезапускається; спробуйте за хвилину.',
  },

  fieldLabels: {
    title: 'Заголовок',
    description: 'Опис',
    'bug.stepsToReproduce': 'Кроки для відтворення',
    'bug.actualResult': 'Фактичний результат',
    'bug.expectedResult': 'Очікуваний результат',
    'bug.environment': 'Середовище / платформа',
    'feature.userNeed': 'Потреба користувача або бізнесу',
    'feature.proposedBehavior': 'Запропонована поведінка',
    'feature.acceptanceCriteria': 'Критерії прийняття',
  },

  // Page 2
  ticketPage: {
    backToTranscript: 'Назад до транскрипту',
    regenerate: 'Створити заново',
    confirm: 'Підтвердження',
    replace: 'Замінити',
    discard: 'Скасувати зміни',
    cancel: 'Скасувати',
    confirmRegenerate: 'Повторне створення замінить ваші зміни новим тікетом. Продовжити?',
    confirmBack: 'Якщо повернутися назад, ваші зміни в цьому тікеті буде втрачено. Продовжити?',
    generating: 'Створення…',
    retry: 'Повторити',
    reviewTitle: 'Перевірка тікета',
    modelInfo: (model, ms) => `Модель ${model}, створено за ${ms} мс`,
    type: 'Тип',
    typeNames: { Bug: 'Bug', Feature: 'Feature' },
    regenerateAs: (type) => `Створити заново як «${type}»`,
    converted: (from, to) =>
      `Перетворено з типу «${from}» у вашому браузері. Створіть заново як «${to}», щоб отримати кращий тікет.`,
    missingTitle: 'Бракуюча інформація',
    nothingMissing: 'Нічого не бракує.',
    previewTitle: 'Попередній перегляд',
    format: 'Формат',
    plain: 'Звичайний текст',
    jiraWiki: 'Jira wiki',
    wikiApprox: 'Як це покаже Jira (приблизно):',
    copy: 'Копіювати',
    saveJson: 'Зберегти як JSON',
    connectToJira: 'Підключитися до дошки Jira',
    jiraNotConfigured: 'Jira не налаштовано',
    copied: 'Скопійовано',
    copyFailed: 'Не вдалося скопіювати. Виділіть текст вище та скопіюйте його самостійно.',
    needsContent: 'Потрібен вміст',
    titleTooLong: (limit) => `Заголовок довший за ${limit} символів.`,
    item: (label, n) => `${label}, пункт ${n}`,
    moveUp: (name) => `Перемістити «${name}» вгору`,
    moveDown: (name) => `Перемістити «${name}» вниз`,
    remove: (name) => `Видалити «${name}»`,
    add: 'Додати',
    addItem: (label) => `Додати пункт: ${label}`,
  },

  // Page 3
  jira: {
    backToTicket: 'Назад до тікета',
    disconnect: 'Відключитися',
    title: 'Створення в Jira',
    connectedAs: (name) => `Підключено як ${name}`,
    tryAgain: 'Спробувати ще раз',
    loadingProjects: 'Завантаження проєктів…',
    project: 'Проєкт',
    chooseProject: 'Виберіть проєкт',
    loadingTypes: 'Завантаження типів задач…',
    noTypes: 'У цьому проєкті немає типів задач, які тут можна створити.',
    issueType: 'Тип задачі',
    loadingFields: 'Завантаження полів…',
    summary: 'Заголовок',
    description: 'Опис',
    resetToPreview: 'Повернути з попереднього перегляду',
    parent: 'Батьківська задача',
    noParent: 'Без батьківської задачі',
    searchParent: 'Пошук батьківської задачі',
    created: 'Створено',
    createAnother: 'Створити ще одну',
    creating: 'Створення…',
    createIssue: 'Створити задачу',
    fillRequired: (names) => `Заповніть обов’язкові поля: ${names}.`,
    pickLinkIssue: 'Виберіть задачу для кожного зв’язку або видаліть зв’язок.',
    linkFailed: (created, linked) =>
      `Задачу ${created} створено, але зв’язок із ${linked} не вдалося додати; додайте його в Jira.`,
    jiraProblem: (code) => `Jira повідомила про проблему (${code}).`,
    forget: 'Забути мої вибори в Jira',
    forgotten: 'Збережені вибори очищено.',
    noLinkTypes: 'На цьому сайті Jira немає типів зв’язків.',
    dropped: (names) =>
      `Введені дані для ${names} видалено: новий тип задачі не має цього поля або не дозволяє це значення.`,
    requiresField: (name) =>
      `Цей тип задачі вимагає поле ‘${name}’, яке цей застосунок не може заповнити. Виберіть інший тип задачі або створіть задачу в Jira.`,
    addField: 'Додати поле',
    chooseField: 'Виберіть поле…',
    add: 'Додати',
    choose: 'Виберіть…',
    requiredSuffix: ' (обов’язкове)',
    removeField: (name) => `Видалити поле ${name}`,
    remove: 'Видалити',
    addLabel: 'Додати мітку',
    labelsNoSpaces: 'Мітки не можуть містити пробіли.',
    removeLabel: (label) => `Видалити мітку ${label}`,
    links: 'Зв’язки',
    linkType: (n) => `Тип зв’язку ${n}`,
    changeIssue: (n) => `Змінити задачу ${n}`,
    searchLinkIssue: (n) => `Пошук задачі для зв’язку ${n}`,
    removeLinkLabel: (n) => `Видалити зв’язок ${n}`,
    removeLink: 'Видалити зв’язок',
    addLink: 'Додати зв’язок',
    maxLinks: (max) =>
      `До ${max} ${plural('uk', max, { one: 'зв’язку', few: 'зв’язків', many: 'зв’язків', other: 'зв’язку' })}.`,
  },

  // Connect panel
  connect: {
    title: 'Підключення до Jira',
    cloudNotice:
      'Токен дає цьому застосунку ті самі права в Jira, що й вам. Він зберігається лише в зашифрованому cookie браузера для цього застосунку, «Відключитися» його видаляє, а відкликати його можна будь-коли в обліковому записі Atlassian.',
    createToken: 'Створити API-токен (без областей доступу)',
    tokenNotice:
      'Токен дає цьому застосунку ті самі права в Jira, що й вам. Він зберігається лише в зашифрованому cookie браузера для цього застосунку, а «Відключитися» його видаляє. Створіть персональний токен доступу у своєму профілі Jira або попросіть адміністратора Jira; відкликати його можна там будь-коли.',
    passwordNotice:
      'Ваш пароль від Jira дає цьому застосунку ті самі права в Jira, що й вам. Він зберігається лише в зашифрованому cookie браузера для цього застосунку, а «Відключитися» його видаляє.',
    address: 'Адреса Jira',
    allowed: (hosts) => `Дозволено: ${hosts}`,
    typeGroup: 'Тип Jira',
    cloud: 'Cloud',
    server: 'Server / Data Center',
    signInWith: 'Спосіб входу',
    token: 'Токен',
    usernameAndPassword: 'Ім’я користувача та пароль',
    username: 'Ім’я користувача',
    atlassianEmail: 'Електронна пошта Atlassian',
    apiToken: 'API-токен',
    personalAccessToken: 'Персональний токен доступу',
    password: 'Пароль',
    cancel: 'Скасувати',
    connect: 'Підключитися',
    serverDenied: (usedToken, detail) =>
      `Jira не прийняла ${usedToken ? 'цей токен' : 'це ім’я користувача та пароль'}. ${detail} Якщо ваша Jira використовує інший спосіб входу, виберіть «${usedToken ? 'Ім’я користувача та пароль' : 'Токен'}».`,
  },

  // Jira errors produced by the web app
  jiraErrors: {
    generic: 'Щось пішло не так. Спробуйте ще раз.',
    authRequired: 'Ваш сеанс у Jira завершився. Підключіться знову; введені вами дані збережено.',
    authDenied: 'Jira не прийняла цю пошту й токен. Використайте токен без областей доступу.',
    forbidden: 'Ваш обліковий запис Jira не може цього зробити в цьому проєкті.',
    notFound: 'Jira не знайшла цей проєкт або задачу, або ваш обліковий запис їх не бачить.',
    rejected: 'Jira не прийняла задачу. Дивіться повідомлення нижче.',
    rateLimited: (seconds) =>
      seconds
        ? `Jira зайнята. Спробуйте за ${seconds} ${plural('uk', seconds, { one: 'секунду', few: 'секунди', many: 'секунд', other: 'секунди' })}.`
        : 'Jira зайнята. Спробуйте за мить.',
    createTimeout: 'Задачу могло бути створено. Перевірте Jira, перш ніж повторювати.',
    unreachable: 'Не вдалося зв’язатися з Jira.',
    notConfigured: 'Jira не налаштовано.',
  },
};
