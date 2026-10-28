# Проверка Firefox 153 ESR на Linux

Цель — дополнить расчётную совместимость **Firefox 140+** реальной проверкой
ESR 153 на Debian/Linux. Проверять каждую промежуточную версию не требуется;
расчёт по API и результат запуска учитываются отдельно. Используйте отдельный профиль и синтетические
настройки. Личный профиль и его пароли не нужны.

## Среда и тестовый пакет

Нужны Node.js 22.17 или новее, зависимости Firefox для выбранного дистрибутива
и официальный Firefox **153.5.1 ESR** для нужной архитектуры. Возьмите бинарный
архив и `SHA256SUMS` из [официального каталога Mozilla](https://archive.mozilla.org/pub/firefox/releases/153.5.1esr/),
проверьте SHA-256 и распакуйте браузер отдельно от установленного. Для
`linux-x86_64/en-US/firefox-153.5.1esr.tar.xz` ожидается:

```text
e289bdc532decf2b54dea9b5ac64cf6f84a62eeec4d4a9ec2f69590f61b0ff1c
```

Следующие команды Bash выполняются из корня репозитория. Укажите свой путь
к распакованному Firefox. Manifest изменять не нужно: минимум 140 уже допускает
установку в ESR 153.

```bash
set -euo pipefail
export FIREFOX_BIN='/absolute/path/to/firefox/firefox'
unset FIREFOX_RELEASE_XPI
"$FIREFOX_BIN" --version
npm ci --prefix extension
npm --prefix extension run verify:firefox

qaRoot="$(mktemp -d "${TMPDIR:-/tmp}/rucb-esr-qa.XXXXXX")"
export FIREFOX_PACKAGE_ROOT="$qaRoot/extension"
cp -R extension/build/firefox "$FIREFOX_PACKAGE_ROOT"
diff -qr extension/build/firefox "$FIREFOX_PACKAGE_ROOT"
```

Не загружайте эту копию в магазины и не выдавайте её за релизный пакет.

## Автоматические браузерные сценарии

```bash
node extension/src/firefox/test/firefox-lifecycle-smoke.js | tee "$qaRoot/lifecycle.log"
node extension/src/firefox/test/firefox-proxy-control-smoke.js | tee "$qaRoot/control.log"
node extension/src/firefox/test/firefox-auth-control-smoke.js | tee "$qaRoot/auth-auto.log"
node extension/src/firefox/test/firefox-auth-control-smoke.js --manual | tee "$qaRoot/auth-manual.log"
```

Все команды должны завершиться с кодом 0. Полные auth/lifecycle сценарии
содержат ожидание настоящего уничтожения фоновой страницы; не заменяйте их
`--quick` для подтверждения совместимости. Проверяются OFF, сохранение
прежнего proxy, private-access denial/revocation, ownership, Save B при
Effective A, восстановление A и применение B, предел повторов 407 и отсутствие
proxy-пароля у origin 401. Описание границ: [тестирование](../TESTING.md).

## Ручная проверка

В новом временном профиле загрузите тестовый manifest через
`about:debugging#/runtime/this-firefox`, разрешите работу в приватных окнах
и проверьте:

1. Popup и все разделы Options на русском и английском; светлая, тёмная и
   системная темы, клавиатура и узкое окно. Поиск и навигация сохраняют Draft.
2. Save не включает управление. Apply использует сохранённую версию.
   Ошибка в скрытом поле открывает соответствующий раздел.
3. Ручное и alarm-обновление базы при OFF не включает управление; при активном
   Effective обновление не применяет ожидающие Saved-правки. Отсутствие новой
   базы (`UNCHANGED`) само по себе не ошибка.
4. Auto/Proxy/Direct с точным хостом и поддоменами через собственный тестовый
   proxy; выключение возвращает прежнюю настройку браузера.

Сохраните версию ОС/Firefox, commit, хеш исходного пакета, коды завершения и
краткие результаты ручных пунктов. В отчёте отдельно укажите непроверенные
сценарии. Полный перезапуск с подписанным постоянно установленным пакетом
выполняется позднее при выпуске: временная установка его не заменяет.
После проверки закройте тестовый браузер и удалите только созданные для QA
каталоги. Не публикуйте личные URL, профили, credentials или необработанные логи.
