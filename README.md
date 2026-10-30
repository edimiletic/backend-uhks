# UHKS nominacije — API

Express + MongoDB. Frontend je odvojeni repo (`ukspgz-frontend`).

## Lokalno (bez Dockera)

1. MongoDB sluša na `27017` (ili Atlas URI).
2. Kopiraj `.env.example` u `.env` i postavi `MONGO_URI` i `JWT_SECRET`.
3. Lokalni Mailtrap: ostavi `SMTP_MIN_INTERVAL_MS=1100`.
4. `npm ci` pa `npm run dev` (port `3000`).

Angular na `http://localhost:4200` šalje kolačić sesije (`SameSite=Lax`). CORS je već `credentials: true`. API prihvaća samo taj kolačić (`uhks_session`), ne `Authorization: Bearer`. Odjava briše kolačić i time gasi pristup.

## Docker

API čita **isti** `.env` kao lokalni `npm run dev` — uključujući `MONGO_URI` (Atlas ili lokalni Mongo). Ako je to produkcijski Atlas, nemoj ostavljati demo lozinku; pokreni `npm run disable-demo-users`.

Samo API (baza ostaje tvoja postojeća):

```bash
docker compose up --build
```

API: `http://localhost:3000`

Ako je frontend repo pokraj ovog foldera kao `ukspgz-frontend`:

```bash
docker compose --profile fullstack up --build
```

Aplikacija je tada na `http://localhost:8080`. Nginx prosljeđuje `/api` na backend pa je kolačić iste stranice (`Lax`).

Prazni Mongo **u kontejneru** (ne Atlas) samo ako ga baš želiš:

```bash
docker compose --profile local-mongo up --build
```

Tada u `.env` privremeno stavi `MONGO_URI=mongodb://host.docker.internal:27017/uhks` — inače i dalje ide Atlas.

Putni nalozi i računi spremaju se u MongoDB GridFS (kolekcije `travelOrders.files` / `travelOrders.chunks`), ne na disk API procesa. Predložak `templates/putni-nalog-hks.xls` i dalje je u repou. Stari lokalni uploadi u `uploads/travel-orders` se i dalje mogu preuzeti ako postoje.

## Produkcija (Railway)

Trenutni API: `https://uhks-production.up.railway.app`.

`NODE_ENV=production` (Railway to obično sam postavi). API **neće slušati port** dok checklist nije ispunjen — pogledaj log deploya.

Obavezno:

| Varijabla | Vrijednost |
|---|---|
| `NODE_ENV` | `production` |
| `MONGO_URI` | Atlas (ili Railway Mongo) |
| `JWT_SECRET` | najmanje 16 znakova, slučajna tajna, ne `change-me` |
| `CORS_ORIGIN` | HTTPS origin **frontenda** (ne API), npr. `https://tvoja-app.up.railway.app` (zarezom više origin-a, bez `/` na kraju) |
| `FRONTEND_URL` | isti frontend, bez trailing slasha — za invite linkove |
| `COOKIE_SECURE` | `true` ili izostavi (default u production je true) |
| `COOKIE_SAMESITE` | `none` ili izostavi (frontend i API na različitim hostovima) |
| `SMTP_MIN_INTERVAL_MS` | `0` ili izostavi (default je 0). **Ne šalji Mailtrap delay 1100 ms na Railway.** |
| `TRUST_PROXY` | ostavi prazno u produkciji (default 1 hop za Railway). Lokalno se ne postavlja. |

Mail je opcionalan. Bez `SMTP_HOST` + `MAIL_FROM` nominacije i dalje rade u aplikaciji, samo se mail ne šalje. Kad ide pravi SMTP (Resend, Postmark, 365), postavi host/user/pass/`MAIL_FROM` i ostavi interval na 0.

Demo seed (`scripts/reset-demo-users.js`) ne radi u `NODE_ENV=production` ni na Atlasu bez `ALLOW_DEMO_SEED=1`. Da `Lozinka123!` prestane raditi na postojećim nalogima: `npm run disable-demo-users` (ista `MONGO_URI` kao API). Admin ostaje netaknut; suci se ponovo pozivaju invite linkom.

`vercel.json` nije u upotrebi.

Helmet na API-ju šalje `nosniff` i slične headere. CSP i COEP su isključeni (JSON API, odvojeni frontend). HSTS samo kad je `NODE_ENV=production`.

Svaki odgovor ima `X-Request-Id`. Request log je jedan JSON red (`level`, `method`, `path`, `status`, `ms`); `status >= 500` ide na `console.error` (grep za alarm). `GET /health` se ne logira. Tuđi `Origin` vraća JSON 403, ne Express Error.

## Health

`GET /health` → `{ "ok": true }` i status 200 samo kad je Mongo spojen (`readyState === 1`). Inače 503 `{ "ok": false }`. API sluša port tek nakon uspješnog `connectDB`.
