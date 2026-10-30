# Помощь и сообщения об ошибках

[Установка](docs/user/INSTALLATION.md) ·
[Руководство 1.0](docs/user/USER_GUIDE_1_0.md) ·
[Создать обращение](https://github.com/aVitomin/runet-censorship-bypass-revived/issues/new/choose)

## Сначала проверьте

| Что произошло | Что проверить |
| --- | --- |
| Сайт не открывается через прокси | Запущен ли прокси, Tor, Tor Browser или WARP; верны ли адрес и порт; выбрано ли подключение для правил **Прокси** |
| Изменения не действуют | В 1.0 сохраните настройки, затем нажмите **Применить**. Одного сохранения недостаточно |
| **Авто** работает иначе, чем ожидалось | Этот режим следует источнику и общим правилам. Он может направить сайт через прокси |
| Firefox просит разрешение | В **Дополнения и темы → Расширения** разрешите работу в приватных окнах, вернитесь в настройки, нажмите **Проверить снова**, затем **Применить** |
| Прокси контролирует другая программа | Проверьте другие расширения и политики браузера. Повторное сохранение правил не возвращает управление |
| База не изменилась после проверки | Новых данных могло не быть. В Firefox 1.0 при ручном источнике обновление остаётся подготовленным и не меняет выбранный режим |

Сначала посмотрите состояние в **Обзоре** и **Обслуживании**. Успешная проверка
одного подключения не подтверждает доступность всех сайтов. Удалять расширение
или сбрасывать настройки для первого обращения не нужно.

Для подписанного **Firefox 0.0.4.0** используйте [отдельное решение проблем](docs/user/TROUBLESHOOTING.md):
интерфейс отличается, а удалённое обновление базы в этой версии отключено.

## Сообщить об ошибке

Проверьте [существующие обращения](https://github.com/aVitomin/runet-censorship-bypass-revived/issues),
затем заполните [короткую форму](https://github.com/aVitomin/runet-censorship-bypass-revived/issues/new?template=bug_report.yml):

1. Браузер, его версия, ОС, версия расширения и способ установки.
2. Что делали, что ожидали и что получилось.
3. При необходимости — видимое состояние и снимок экрана без личных данных.

В версии 1.0 можно добавить **Экспорт для поддержки**. Это отдельный очищенный
отчёт о состоянии. Просмотрите его перед отправкой.

Не прикладывайте **экспорт настроек**, профиль браузера, HAR/NetLog или сырые
логи: они могут раскрыть сайты, частные адреса, пароли, токены и cookies.
Экспорт настроек исключает пароли, но сохраняет правила сайтов и адреса прокси.

## Предложить улучшение или сообщить об уязвимости

[Для предложения](https://github.com/aVitomin/runet-censorship-bypass-revived/issues/new?template=feature_request.yml)
опишите задачу, которую хотите решить, и ожидаемое поведение.
Уязвимости отправляйте приватно по [политике безопасности](SECURITY.md).

## English

Check the extension status, your proxy/local service, and whether saved changes
were applied. Auto follows the selected source and rules; it can use a proxy.
Firefox requires private-window permission for its browser-wide proxy setting.

[Report a bug](https://github.com/aVitomin/runet-censorship-bypass-revived/issues/new?template=bug_report.yml)
with browser/OS/extension versions, installation method, steps and expected/actual
results. Version 1.0 has a separate sanitized support export; inspect it before
sharing. Do not attach settings exports, profiles, raw network logs or credentials.
Report vulnerabilities through the [private security channel](SECURITY.md).
