---
doc_key: cookies
locale: en
version: 0.1.0-utkast
status: DRAFT – not legally reviewed – informational translation
updated: 25.10.2026
translation_of: legal/nb/informasjonskapsler.md
---

# Cookies

> **Informational translation.** The Norwegian version of this document is the legally binding one. If the two versions differ, the Norwegian text prevails.

**Version 0.1.0-utkast · Last updated 25.10.2026**

> **DRAFT – NOT LEGALLY REVIEWED.** This list describes the setup as it is planned. It must be
> checked against the finished service before launch.

## In short

Laandet uses **only cookies that are necessary** for the service to work. We have no
analytics tools, advertising or tracking, and we do not share information with advertising networks.
That is why we do not show a consent banner.

Under § 3-15 of the Norwegian Electronic Communications Act (ekomloven), we do not need consent for
cookies that are strictly necessary to provide a service you have asked for yourself.

## Cookies we use

| Name | What it does | Duration |
|---|---|---|
| `__Host-laandet.session` | Keeps you logged in. Contains a random key, not personal data in plain text. | Up to 30 days (8 hours for staff), or until you log out |
| `__Host-laandet.session_data` | A short-lived, signed cache of your login, so that pages load faster | 5 minutes |
| `__Host-laandet.two_factor` | Used while staff log in with a two-factor code | 10 minutes |
| `NEXT_LOCALE` | Remembers whether you have chosen Norwegian or English | 1 year |

We do not store personal data in the browser's local storage (localStorage). Drafts of listings
are stored in your account on the server.

## If we start using something new

If it becomes necessary to protect registration against bots with a tool from another supplier, for
example Cloudflare Turnstile, we will update this page and the privacy notice **before** the tool is
put into use. We will ask for consent if the law requires it.

## How to delete cookies

You can delete cookies at any time in your browser settings. If you delete the
login cookie, you will be logged out.

Questions? See the [privacy notice](privacy-notice.md).
