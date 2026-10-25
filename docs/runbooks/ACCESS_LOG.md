# Access log — direct database access to personal data

AUTH_MODEL.md §6: staff use the admin pages, which are audited automatically. Any
**direct** access to personal data on the server (`psql`, reading a dump, copying media files) is the
exception and is recorded here **before or immediately after** it happens.

Rules:
- Only when the admin pages cannot do the job (an incident, a data-subject request, a restore check).
- Read only what is needed; never copy personal data to a laptop, chat or email.
- No production data in staging, ever (SEC-41).

| Date and time | Who | Environment | What was accessed (tables / files) | Why (case, request or incident) | Data copied or changed? |
|---|---|---|---|---|---|
