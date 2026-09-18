# Приватность и безопасность

Runet Censorship Bypass управляет маршрутизацией браузера, поэтому видит адреса,
для которых должен выбрать Direct или Proxy. В исходном коде нет телеметрии,
аналитики или отдельного сервера сбора событий. Расширение не является VPN и не
гарантирует анонимность, сокрытие IP во всех сценариях или отсутствие DNS-утечек.

Текущий опубликованный [`v0.0.4.0`](https://github.com/aVitomin/runet-censorship-bypass-mv3/releases/tag/v0.0.4.0)
содержит Chromium-пакет и Mozilla-подписанный Firefox XPI.

## Кому могут быть видны сетевые данные

- При **Direct** сайт и обычная сетевая инфраструктура видят соединение так же,
  как без прокси расширения.
- При **Proxy** выбранный proxy server видит destination и сетевые данные в
  пределах протокола/шифрования. Используйте только доверенные серверы.
- Провайдер automatic-routing data определяет правила маршрута, но это не делает
  его VPN-провайдером. Firefox использует локальный набор; Chromium может
  загружать выбранный routing source.
- Tor, Tor Browser и WARP работают только через локально запущенные приложения;
  расширение не запускает их и не обещает их анонимность.

## Что хранится локально

- Правила сайтов, флаги и proxy connections.
- Проверенные routing data и служебная информация, нужная для восстановления
  после перезапуска фонового процесса.
- Username и пароль пользовательского прокси, только если пользователь явно их
  настроил.

Прокси-пароль хранится локально отдельно от правил маршрутизации. После
сохранения интерфейс получает только состояния **KEEP / SET / NONE**: реальное
значение не возвращается в DOM, popup, diagnostics, notifications, ошибки или
логи. Удаление расширения обычно удаляет его browser storage; облачного backup
продукт не предоставляет.

## Разрешения браузера

### Chromium

- `proxy` — применить и снять конфигурацию маршрутизации расширения;
- `storage` и `alarms` — хранить настройки и восстанавливать расписание;
- `webRequest` / proxy-auth — отвечать только на ожидаемые proxy challenges;
- `activeTab` — определить текущий сайт для Auto / Proxy / Direct;
- `notifications` — редкие сообщения о состоянии, требующем действия.

Широкий сетевой доступ нужен для принятия proxy-решения и аутентификации, а не
для внедрения content scripts на каждую страницу.

### Firefox

Firefox использует `proxy`, `webRequest`, `webRequestBlocking`, `storage`,
`alarms`, `notifications` и `<all_urls>` для маршрутизации, proxy-auth,
восстановления и безопасного выключения.

Mozilla manifest декларирует категории сбора данных `authenticationInfo` и
`browsingActivity`: расширение обрабатывает proxy-auth challenge и hostname,
чтобы выбрать маршрут. Это обязательное описание доступа, а не отправка данных
разработчикам. Телеметрия отсутствует.

Для Firefox Apply требуется private-window access, потому что proxy setting
общий. Если разрешение отозвано во время работы, приватные listeners исчезают и
маршрутизация блокируется; Clear остаётся доступен без повторной выдачи
разрешения.

## Сетевые обращения расширения

- Chromium принимает custom routing source только по HTTPS или loopback HTTP,
  запрещает URL credentials и повторно проверяет redirects, размер и UTF-8.
- Firefox поставляет проверенный локальный набор automatic-routing data.
  Production endpoint и публичный ключ удалённого обновления пока не настроены,
  поэтому ручной/фоновый fetch отключён. Встроенный набор остаётся пригодным.
- **Connection check** запускается пользователем, не отправляет cookies или
  proxy credentials и не меняет правила, данные или владение proxy settings.

Downloaded PAC в Chromium рассматривается как недоверенный routing input и не
выполняется через `eval`/`Function` внутри extension runtime. Firefox не
исполняет provider PAC и использует декларативный dataset.

## Границы защиты

### Chromium

Chromium применяет PAC с `mandatory: false`. Ошибка браузерного PAC-механизма
может привести к Direct fallback, поэтому Chromium нельзя описывать как полностью
fail-closed на уровне браузера.

### Firefox

Firefox устанавливает локальный fail-closed proxy floor до публикации активной
сессии. Потеря контроля, ошибка восстановления или отзыв private access убирает
активную сессию, не перезаписывая чужую proxy-настройку. Если все provider proxy
кандидаты исчерпаны, Firefox завершает запрос вместо terminal Direct fallback.

Floor использует случайный высокий loopback port. Browser API не может
зарезервировать его или доказать, что он свободен. Случайное совпадение возможно,
а вредоносный локальный процесс вне модели угроз может занять выбранный endpoint.
Поэтому это защита от browser/WebExtension lifecycle failures, а не от
скомпрометированного компьютера.

Ни toolbar badge, ни Connection check не доказывают маршрут каждого
вспомогательного запроса, отсутствие DNS-утечек или будущую доступность прокси.

## Безопасный отчёт о проблеме

Не публикуйте пароль, username, приватный endpoint, полный URL с query string,
browser profile, routing data или историю посещений. Для диагностики используйте
очищенный отчёт из **Maintenance**.

Обычные проблемы: [issue form](https://github.com/aVitomin/runet-censorship-bypass-mv3/issues/new/choose).
Уязвимости: [приватная форма GitHub](https://github.com/aVitomin/runet-censorship-bypass-mv3/security/advisories/new)
по [политике безопасности](../../SECURITY.md).
