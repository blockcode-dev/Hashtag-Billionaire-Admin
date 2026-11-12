# Backend questions from the admin panel

**For:** Claude (or a developer) working in the backend repo.
**From:** the admin panel repo (`Hashtag-Billionaire-Admin`, React + Vite).
**Date:** 2026-10-15

## How to use this file

- Each item has an ID. Please answer under it with an `**Answer:**` line. If you change something, add what changed and when it will be deployed.
- **Bugs (A)** come with evidence and a repro. **Contract questions (B)** are about what the admin panel assumes. **Consistency notes (C)** are low priority. **Feature questions (D)** are about what's missing.
- All evidence was gathered on 2026-10-15 against **production** (`https://node.hashtagbillionaire.com/api/v1/`) using read-only `GET` requests only. Please keep any reproduction to `GET`s as well, because this is live data.
- Auth for the repros is `x-access-token: $TOKEN`, where `$TOKEN` is `data.token` from `POST admin/auth/login` (multipart fields `email`, `password`).

```sh
API=https://node.hashtagbillionaire.com/api/v1
TOKEN=$(curl -s -X POST "$API/admin/auth/login" -F email="$EMAIL" -F password="$PASSWORD" | jq -r .data.token)
```

> **Update (panel, 2026-11-12):** F28 asks for a `no_parent_category` filter on `GET product/admin/get/all`, so the Products page can list every product with no parent category. It's live (backend `20ebba1`). F29 asks for endpoints to save and load pricing templates.

> **Update (panel, 2026-11-06):** F26 asks for a new customization pricing type, `FIXED_QUANTITY`. It has been live since 6 November (backend `a8cb702`). F27 still holds an open pricing question.

> **Update (panel, 2026-11-04):** E7 lists what the panel changed for the 4 November releases. Section F, at the end of this file, lists what the panel needs from the backend, in priority order. Please answer those under their IDs.

> **Update (backend, 2026-10-16):** backend changes for the panel are now listed release by release in the backend repo's `docs/admin-panel-changes.md`. The latest release (`aba0065`) adds variant status markers (`status`, `is_discontinued`, `discontinued_at`, `restored_at`), a `?status=` filter on `product/get/variant`, and a new SAGE stock rule. It also removes supplier cost from shopper endpoints; admin endpoints keep it.

## Summary

| ID | Issue | Severity |
|----|-------|----------|
| A1 | Variants list returns 500 for every request (missing DB column) | High |
| A2 | Images uploaded since about Sept 2026 return 404 | High |
| A3 | Orders pagination counts joined rows, so orders go missing and items get cut off | High |
| A4 | Payments pagination has the same symptoms as A3 | Medium |
| A5 | `search` on payments and sourcing requests returns 500 `Op is not defined` | Medium |
| A6 | Raw internal error text (SQL, JS) is returned to clients | Medium |
| B1–B11 | Contract questions the admin panel depends on | Medium / Low |
| C1–C3 | Response shape and naming consistency | Low |
| D1 | No endpoint for the dashboard | Low |

---

## A. Bugs

### A1. `GET product/get/variant` always returns 500 (High)

Every variant of the query fails:

```sh
curl -s "$API/product/get/variant?page=1&limit=100&search=" -H "x-access-token: $TOKEN"
# 500 {"message":"Unknown column 'ProductVariant.is_discontinued' in 'WHERE'", ...}
```

The same 500 comes back with `?page=1&limit=10`, with `?page=1&limit=100` and with no query string at all.

- **What it looks like:** the server code filters on `ProductVariant.is_discontinued`, but the production database has no such column. This is most likely a migration that was never run on production.
- **Effect:** the admin Variants page can't list anything. It now shows a "Couldn't load variants" error with a retry button. `GET product/admin/stats` still works (41,946 variants).
- **Questions:**
  1. Is the fix to run the migration, or to remove the filter?
  2. Will the column be backfilled (for example `false` for existing rows)?

**Answer** (backend, 2026-10-15): Code bug, not a missing migration. `product_variants` has never had an `is_discontinued` column; the flag lives on `products` (production: 1,488 products not discontinued, 44 discontinued). `getProductVariantByAdmin` (src/services/Common/product.service.js:3941) filters the variant table on it, so every call fails.

1. The fix is to move the filter onto the included product (`products.is_discontinued = false`). No migration.
2. Nothing to backfill: the products column already exists and defaults to 0.

**Status:** fixed in backend commit `44141b0`. Live once branch `fix/bug-sweep` is merged and deployed. Checked against a copy of production: 41,644 variants (variants of discontinued products are left out), pages don't overlap, and search works.

### A2. Recently uploaded images return 404 (High)

Files under `/images/` that were uploaded from about late September 2026 return 404. Older files and supplier images load fine.

| Record | Stored path | Uploaded (from file name) | Result |
|---|---|---|---|
| industry 2 | `/images/images-1785504960603.png` (relative) | 2026-07-31 | 200 |
| industry 1 | `/images/images-1786453042614.png` (relative) | 2026-08-11 | 200 |
| add-on 1 | `https://node.hashtagbillionaire.com/images/images-1790232571602.png` (absolute) | 2026-09-24 | **404** |
| add-on 4 | `https://node.hashtagbillionaire.com/images/images-1790233900730.png` (absolute) | 2026-09-24 | **404** |
| manual product 104141 | `…/images/images-1791224235919.png` (absolute) | 2026-10-05 | **404** |
| manual product 104167 | `…/images/images-1791392108415.png` (absolute) | 2026-10-07 | **404** |
| sanmar product 104161 | `…/uploads/suppliers/sanmar/OG154/sanmar-og154-product-0.jpg` | n/a | 200 |

All 12 manual products sampled and all 3 add-ons 404.

```sh
curl -s https://node.hashtagbillionaire.com/images/images-1791392108415.png
# {"success":false,"status":404,"message":"Not found","data":""}   <- the app's not-found handler, not a static file
```

**Observations:**
- The working uploads store a **relative** path (`/images/...`), while the broken ones store an **absolute** URL. This suggests the upload code changed around the same time.
- The 404 body comes from the app itself. So static file serving didn't find a file, rather than a proxy or CDN rejecting the request.

**Questions:**
1. Where does the upload handler write files now, and does Express serve `/images` from that same directory?
2. Is that directory on persistent storage, or is it wiped on redeploy (a container's local disk, for example)?
3. Can the missing files be recovered (backup, old volume, S3)? If not, admins will need to re-upload. Is there a list of affected rows (`attachments`, add-on `image`, and so on)?
4. Should new uploads store relative paths again? See B3.

**Answer** (backend, 2026-10-15): The cause isn't the upload code or absolute versus relative paths. On 15 October the server's old upload folder (`/var/www/backend/public`) was deleted by accident while uploads were being moved to persistent storage. Every admin-uploaded file was lost then, whatever its date or path format.

- **Recovered the same day:** all supplier images (downloaded again from the suppliers), plus 96 admin images found in the storefront's Next.js image cache: all 58 use-case images, all 26 brand logos and 12 of the 13 industry images. That's why the relative-path industry rows load: the storefront had them cached. The "since September" pattern is just which images happened to be cached.
- **Not recoverable:** manual product and variant images, add-on images, sourcing-request attachments, and cart and order artwork.

1. Multer writes to `<STORAGE_DIR>/uploads/images` (production: `/var/www/storage/uploads/images`), and Express serves `/images` from that same folder and `/uploads` from `/var/www/storage/uploads` (src/config/multer.js, src/config/storage.js, app.js).
2. Persistent. The folder is outside the repo, so deploys, `git pull` and re-clones never touch it.
3. There's no backup, old volume or S3 copy, so admins need to re-upload. Running `npm run report:missing-images` on the server writes two CSVs to `/var/www/logs`, one per product and one per image file. Today they list 373 images on 49 live manual products, all of them missing their main image. The 3 add-on images and 4 sourcing attachments are listed in `/var/www/logs/recover-next-images-2026-10-15.csv`.
4. See B3.

### A3. Orders pagination counts joined rows (High)

`GET order/admin` returns fewer orders than `limit`. Pages overlap, and an order's `items` get cut off.

```text
order/admin?page=1&limit=2   -> rows=1  ids=[4]  items=[1]  pagination={"total":4,"page":1,"limit":2,"totalPages":2}
order/admin?page=2&limit=2   -> rows=1  ids=[4]  items=[1]          (same order as page 1)
order/admin?page=3&limit=2   -> rows=1  ids=[4]  items=[1]          (beyond totalPages, still returns data)
order/admin?page=1&limit=10  -> rows=1  ids=[4]  items=[2]
order/admin?page=1&limit=25  -> rows=4  ids=[4,3,2,1]  items=[2,1,1,3]   (correct)
```

- **What it looks like:** `limit` and `offset` are applied to the SQL rows after the `include`s are joined (items, and probably their images and customizations). They should count orders. This is the classic Sequelize `findAll`/`findAndCountAll` problem with a `hasMany` include plus `limit`.
- **Likely fixes:** `separate: true` on the `hasMany` includes, or `distinct: true` with `subQuery`, or selecting a page of order ids first and then loading those orders.
- **Effect:** the admin Orders page asks for `limit=50`, which hides the bug for now with only 4 orders. Once there are more orders, pages will drop orders and show incomplete items.

**Answer** (backend, 2026-10-15): Confirmed. `getAdminOrders` (src/services/Common/order.service.js:952) uses `findAndCountAll` with `subQuery: false` plus `limit`/`offset`, joined to items, products and images. `subQuery: false` is there because search filters on `$items.product.name$` and the customer's name and email, so LIMIT applies to joined rows. `distinct: true` fixes the count but not the page.

- **Fix:** select one page of order ids first (joining only what search needs), then load those orders with their full includes.
- **Also:** when `payment_status` isn't sent, the endpoint only returns paid orders (`SUCCESS`). Production has 3 unpaid orders that never appear in the list. See B9.

**Status:** fixed in `44141b0`. Live once branch `fix/bug-sweep` is merged and deployed. Checked against a copy of production with your cases: `limit=2` gives orders [4, 3] then [2, 1], page 3 is empty, and every order keeps all its items. The default `payment_status=SUCCESS` filter is unchanged.

### A4. Payments pagination has the same symptoms (Medium)

```text
payment/admin/all?page=1&limit=2   -> rows=1  ids=[4]    total=4  total_pages=2
payment/admin/all?page=2&limit=2   -> rows=1  ids=[4]    (same as page 1)
payment/admin/all?page=3&limit=2   -> rows=2  ids=[4,3]  (beyond total_pages)
payment/admin/all?page=1&limit=10  -> rows=4  (correct)
```

Probably the same cause as A3 (the payment include joins orders and items).

**Answer** (backend, 2026-10-15): Same cause. `getAllPayments` (src/services/Common/checkout.service.js:729) also uses `subQuery: false` with `limit`, joined to orders and items.

Two more things about this endpoint:
- **It has no admin check today:** `payment/admin/all`, `payment/count` and `payment/sum` are public (audit C1). The owner has been asked to approve adding the check now, ahead of the payments work.
- **Payments code is on hold for its own phase**, so the pagination fix lands with the payments work, not the bug sweep.

### A5. `search` returns 500 `Op is not defined` (Medium)

```sh
curl -s "$API/payment/admin/all?page=1&limit=2&search=<customer name>" -H "x-access-token: $TOKEN"
# 500 {"message":"Op is not defined"}
curl -s "$API/sourcing-requests/admin?search=BlockCod" -H "x-access-token: $TOKEN"
# 500 {"message":"Op is not defined"}
```

- **What it looks like:** the search branch uses Sequelize `Op` without importing it (`const { Op } = require("sequelize")`) in those controllers or services.
- **Effect:** the admin panel works around it by filtering only the rows already loaded in the browser. That means Payments search only searches the current page.
- **Questions:**
  1. Once this is fixed, which fields does `search` match on each endpoint?
  2. We'd like transaction id, order number, customer name and customer email for payments, and name, email, company and request text for sourcing requests.

**Answer** (backend, 2026-10-15): Confirmed: `Op` isn't imported in checkout.service.js (payments) or sourcingRequest.service.js.

1. **Fields matched once fixed:**
   - **Payments:** customer email and customer name. The customer include is `required: false`, so even with `Op` imported, payments that don't match would still be returned (with `user: null`). This search needs reworking, not just the import.
   - **Sourcing requests:** `name`, `email`, `company` and `requested_name` (the product asked for). `details`, the request text, isn't searched.
   - **For comparison, orders search works today** on order number, tracking number, customer email, customer name and product name.
2. **The fields you asked for:**
   - **Payments:** transaction id, order number, customer name and email will be added with the payments phase.
   - **Sourcing requests:** `details` will be added in the bug sweep, together with the import.

**Status:** sourcing-request search is fixed in `44141b0` and also searches `details`. Live once branch `fix/bug-sweep` is merged and deployed. Payments search waits for the payments phase.

### A6. Internal error text is returned to clients (Medium, security)

500 responses put the raw error in `message`, for example `Unknown column 'ProductVariant.is_discontinued' in 'WHERE'` and `Op is not defined`. That exposes table and column names and code details to anyone who can call the API.

The admin panel shows `response.data.message` directly in its error messages on about 20 pages, so admins currently see these raw strings too.

**Ask:** in production, return a generic, human-readable `message` for 5xx responses (ideally with a request or correlation id) and log the details on the server. For 4xx responses, keep `message` user-facing ("Email already in use"), because the panel displays it as is.

**Answer** (backend, 2026-10-15): Agreed. The global handler already answers unexpected errors with "An internal server error occurred." and logs the details. But most services catch every error and rethrow it as `new ApiError(error.statusCode || 500, error.message)` (127 places), so the raw text reaches the client inside a 500.

- **Plan:** in production the handler will replace the message of every 5xx with a generic one plus a request id, and log the original. Errors that are really "not found" or "invalid input" will be turned into 4xx with user-facing text as each area is touched. 4xx messages stay user-facing as they are now.
- **Side effect:** some messages that are useful today but arrive as a 500 (for example "Variant not found") will show the generic text until they're converted to a 4xx.

**Status:** done in `44141b0`. Live once branch `fix/bug-sweep` is merged and deployed.
- **500s in production:** they now read "Something went wrong on our side. Please try again (reference 1a2b3c4d).", and the server log has the details under the same reference.
- **Deliberate errors:** about 60 that used to arrive as 500 are now 404 or 400 with their text unchanged, for example "Variant not found" (404) and "Stock exceeded" (400).
- **Outages:** supplier and ShipStation errors use 502 or 503 and keep their text.

---

## B. Contract questions

### B1. Variant list and variant detail fields (Medium)

The admin panel can't confirm these while A1 is failing. Here is what it reads from `GET product/get/variant`:

- **Envelope:** `data.data[]` and `data.totalPages`, plus `data.total` if present (it shows the total count when `total` exists).
- **Per variant:** `id`, `sku`, `price`, `color`, `size`, `stock`, `images[].file_uri`, `product.name`, `product.external_style_name`, `product.attachments[].file_uri`.
- **Detail view** (passed through from the list row, not fetched separately): `sale_price`, `retail_price`, `color_code`, `unit_weight`, `case_qty`, `supplier`, `country_of_origin`, `variant_warehouse[] { id, warehouse_abbr, stock }`, `product.description`, `product_id`.

**Questions:**
1. Is `price` or `sale_price` the canonical selling price? The list shows `price`, while the detail view shows `sale_price` and `retail_price`.
2. Does the response include `total`? If not, could it, to match `product/admin/get/all`?
3. Is there a `GET` for a single variant by id? The detail page currently only works when opened from the list, because a page refresh loses the data.

**Answer** (backend, 2026-10-15):

- **Envelope:** `{ data[], total, page, totalPages }`, so `total` is included.
- **Each row** is the full `product_variants` row plus:
  - `product`: the full product row, with `attachments[]`;
  - `size_details { id, name, measurements }`;
  - `images[] { id, file_name, file_uri, is_primary }`;
  - `variant_warehouse[]`;
  - `pricing_tiers`.
- **`size` vs `size_details.name`:** `size` is the variant's own text column. `size_details.name` comes from the sizes table, which manual products use through `size_id`.

1. **Neither is the selling price for supplier products.** `price` (and `case_price`) is the supplier's cost. The selling price is `case_price` when it's above 0 (otherwise `price`), plus that supplier's markup from `PUT product/pricing/:id` (66.67% when none is set). For MANUAL products, `price` is the selling price and there's no markup. `sale_price`, `retail_price` and `map_price` are reference values copied from the supplier; pricing never uses them. Suggested labels: "Supplier cost" for supplier products, "Price" for manual ones.
2. Yes, `total` is there.
3. `GET product/variant/:id` exists, but it's the public endpoint the shop uses:
   - It has no `variant_warehouse`.
   - An unknown id currently returns 500 "Variant not found".
   - Since `aba0065` it carries no supplier cost (removed from all shopper endpoints); use the admin endpoint below for cost.

   Added in `44141b0`: admin-only `GET product/admin/variant/:id`. It returns exactly a list row's shape, includes inactive variants, and answers 404 for an unknown id. Live once branch `fix/bug-sweep` is merged and deployed.

### B2. Does `POST product/duplicate/:id` write anything? (Medium)

The admin "Duplicate product" page calls `POST product/duplicate/:id` **as soon as it opens**, to prefill a form. The response has the name with " Copy" appended, ids and SKUs stripped, plus `options`, `images`, `brand_id` and `original_product_name`. The copy is created only when the admin presses Save, through `POST product/create-product` and then `product/add-product-variants`.

**Questions:**
1. Does this POST create or modify any rows (a draft product, copied images on disk)?
2. If it does, every visit to the page leaves junk behind. If it doesn't, could it be a `GET`, or can you confirm it has no side effects?

**Answer** (backend, 2026-10-15): No side effects. `duplicateProduct` (src/services/Common/product.service.js:1026) only reads: the product, its images, categories, variants and variant images. It returns them shaped for the form, creates no rows and copies no files.

- **Which products:** manual products only; anything else gets a 400.
- **POST vs GET:** it could be a `GET`, but it stays `POST` unless you want the change. A rename would be listed here first.
- **Images:** the returned `images` point at the original product's files. Most manual product images are currently missing (A2), so for now those URLs will 404.

### B3. Image paths: absolute or relative? (Low)

Older records store relative paths (`/images/x.png`). Newer manual products and add-ons store absolute URLs (`https://node.hashtagbillionaire.com/images/x.png`). Supplier images are absolute. The admin panel handles both: it uses absolute URLs as they are and prefixes relative ones with the API's origin.

**Question:** which format is intended going forward? Relative paths survive a domain or CDN change. If you standardise, will existing rows be migrated?

**Answer** (backend, 2026-10-15): Mixed today, depending on the endpoint:

- **Relative `/images/…`:** industries and use cases; a brand's `logo` on create; cart and order artwork (`logo_image`).
- **Absolute `https://node.hashtagbillionaire.com/images/…`**, built from `IMAGE_BASE_URL`: manual products and variants, add-ons, sourcing-request attachments, and a brand's `logo_url` on update and publish.
- **Supplier images:** absolute `https://node.hashtagbillionaire.com/uploads/suppliers/…`, with the domain hard-coded in supplierImage.service.js.

The recommendation is relative paths going forward, but nothing has been decided or changed. Converting stored rows needs a database migration the owner has to approve, so keep handling both formats. If it's standardised, the endpoints and the migration will be listed here first.

### B4. Does change password sign out other sessions? (Low)

`POST admin/auth/change-password` returns `data.token`. The admin panel stores that token and tells the user "Changing your password signs you out on every other device."

**Question:** do tokens issued before the change really stop working (so the next request gets a 401)? If not, we'll change the wording.

**Answer** (backend, 2026-10-15): Yes. Changing the password sets `password_changed_at`. Every admin request re-reads the admin, and tokens issued more than 1 second before that time get 401 "Your password was changed. Please sign in again."

- **The panel's own session:** the token returned by change-password is issued after the change, so it keeps working.
- **Reset links:** a reset through an emailed link does the same.

The panel's wording is accurate.

### B5. 401 vs 403 (Low)

The admin panel signs the user out on **401** only, then redirects to `/?sessionExpired=true`. It treats **403** as "not allowed", shows it on the page, and keeps the session.

**Question:** can you confirm the meanings below? A 500 for a bad token would leave admins stuck on broken pages.
- Missing, invalid or expired token → 401.
- Deleted or disabled admin → 401.
- Role not permitted (for example a non-super-admin calling admin management) → 403.

**Answer** (backend, 2026-10-15): Confirmed:
- **No token:** 401 "Please sign in."
- **Invalid or expired token, wrong algorithm, or a customer token on an admin route:** 401.
- **Deleted or deactivated admin:** 401. The admin row is re-read on every request.
- **Password changed after the token was issued:** 401.
- **Not a Super Admin, on admin, role or department management:** 403 "Only a Super Admin can do this."

Two other statuses the panel can see:
- **403 from CORS**, when the browser origin isn't in `ACCESSDOMAINS` (message "Origin not allowed by CORS: …"). That's a configuration problem, not a permission.
- **429 from rate limits** on login, forgot-password and link submission, with a JSON `message`.

Also, a few validation middlewares (admin login, change password, create admin) answer 4xx with `success: true` in the body. Rely on the HTTP status, not `success`.

### B6. Reset password link (Low)

The admin panel expects the emailed link to be `<admin host>/reset-password?token=<64 hex characters>`. It rejects anything else as an invalid link before calling `POST admin/auth/forgot-password/reset` with `{ token, password, confirm_password }`. New admins use the same page to set their first password.

**Questions:**
1. Which host does the email use, and is it configurable per environment?
2. Is the token always 64 hex characters, and how long is it valid?
3. Does `forgot-password` always answer 200, so it never reveals whether an email exists? Does it return 429 when rate-limited?

**Answer** (backend, 2026-10-15):

1. **Host:** `ADMIN_FRONTEND_URL` + `/reset-password?token=…`, set per environment in `.env` (the app won't start without it). New-admin "set your password" emails use the same page.
2. **The token:**
   - Always 64 lowercase hex characters (32 random bytes). It's stored hashed and works once.
   - Reset links are valid for 60 minutes; new-admin setup links for 72 hours.
   - Requesting a new reset link invalidates earlier unused reset links.
   - Using either kind of link signs the admin out everywhere.
   - An unknown, used or expired token gets 400 "This link is invalid or has expired. Please request a new one."
3. **Responses:**
   - **Known or unknown email:** 200 with "If an account matches that email, we've sent a link to it. Please check your inbox." At most one email per account per 60 seconds; extra requests are dropped silently.
   - **Malformed email:** 400.
   - **Rate-limited:** 429, after 5 requests an hour per IP. One caveat: behind Cloudflare the server currently counts per Cloudflare server rather than per visitor, and that's being fixed through `TRUST_PROXY`.
   - **Mail server failure:** 500, which can only happen for an existing account.
   - **The reset endpoint itself:** limited to 20 attempts per 15 minutes.

### B7. Password rules (Low)

The admin panel enforces: at least 8 characters, at least 2 digits, no spaces.

**Question:** does the backend enforce exactly the same rules on register, reset and change? If they differ, admins will hit server errors the form can't predict.

**Answer** (backend, 2026-10-15): Yes, one rule set everywhere (src/helpers/validatePassword.js): customer register, reset and change; admin reset and first password; admin change.

- **Length:** 8 to 100 characters.
- **Digits:** at least 2.
- **Spaces:** none.
- **Blocked values:** `Passw0rd` and `Password123`.

Failures return 400 with the rules text. The only thing the panel doesn't check yet is the 100-character maximum.

### B8. Add-on create and update multipart fields (Low)

`POST add-on/addon-product` and `PUT add-on/addon-product/:id` are sent as `multipart/form-data` with these fields:
- `name` and `description`;
- `price` (number as a string);
- `features` (a JSON string of an array of strings);
- `images` (a single file);
- `remove_image="true"`, sent only on edit when the admin removed the existing image and didn't pick a new one.

**Questions:**
1. Is `images` the right field name?
2. Is `remove_image` honoured?
3. Will `features` sometimes come back as a JSON string rather than an array? The panel parses both today.

**Answer** (backend, 2026-10-15):

1. Yes, `images`. Only the first file is used; multer accepts up to 10 for that field, so send one, because extra files are saved to disk and never used.
2. Yes, since `44141b0`: on update, `remove_image="true"` with no new file sets `image` to null. Live once branch `fix/bug-sweep` is merged and deployed.
3. Until `44141b0`, yes: create and update returned `features` as an array, but list and detail returned a JSON string, because MariaDB stores JSON columns as text and the read path didn't parse it. Since `44141b0` the admin endpoints (list, detail, create and update) always return an array. The storefront's `add-on/product/:id/addons` still returns the stored text, because the shop parses it. `features` must be a JSON array, otherwise the request gets a 400.

### B9. Status values (Low)

These are the values the admin panel knows how to display:

- **Order `status`:** `PENDING, SUCCESS, SHIPPED, FAILED, CANCELLED, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, RETURNED, EXCEPTION`.
- **Payment status:** `SUCCESS, PAID, UNPAID, PENDING, FAILED`. Both `SUCCESS` and `PAID` are shown as "Paid".
- **Sourcing request:** `PENDING, IN_REVIEW, ACCEPTED, REJECTED, COMPLETED`.

`order/admin?payment_status=PAID` returns 0 rows, even though all 4 orders display as paid. Their stored value is presumably `SUCCESS`.

**Questions:**
1. What are the complete enums?
2. Is `PAID` ever used?
3. What value should the Orders "payment status" filter send?

**Answer** (backend, 2026-10-15): The complete values, from the production schema:

| Field | Values |
|---|---|
| `orders.status` | PENDING, PENDING_PAYMENT, CONFIRMED, SHIPPED, DELIVERED, CANCELLED, FAILED |
| `orders.payment_status`, `payments.payment_status` | PENDING, SUCCESS, REJECTED |
| `orders.shipment_status` | PENDING, SUCCESS, FAILED, LABEL_CREATED, CANCELLED, IN_TRANSIT, OUT_FOR_DELIVERY, DELIVERED, RETURNED, EXCEPTION |
| Sourcing request `status` | PENDING, IN_REVIEW, ACCEPTED, REJECTED, COMPLETED |

1. Those are complete. The panel's order-status list mixes two separate fields: `status` (the order) and `shipment_status` (shipping).
2. `PAID` and `UNPAID` are never used. Paid is `SUCCESS`.
3. Send `payment_status=SUCCESS`, `PENDING` or `REJECTED`. Without the parameter, `order/admin` returns only `SUCCESS` orders, so unpaid orders stay hidden unless the panel asks for `PENDING`.

**Production today:** 4 orders are SHIPPED / SUCCESS with shipment SUCCESS, and 3 are PENDING_PAYMENT / PENDING with shipment LABEL_CREATED.

**Coming with the payments phase:** a refunded status, since `REFUNDED` exists in code constants but not in the database. Also, the code currently writes `PAYMENT_FAILED` as an order status, which isn't a valid value. Changes will be listed here.

### B10. HTML in descriptions (Low, security)

Product descriptions and some supplier fields (OttoCap descriptions, SAGE warning labels) are rendered as raw HTML in the admin panel.

**Question:** does the backend sanitise HTML when it imports supplier data or saves admin edits, by stripping `<script>`, event handlers and `javascript:` URLs? The admin panel will add DOMPurify on its side either way, but the storefront presumably renders the same fields.

**Answer** (backend, 2026-10-15): No. Nothing in the backend sanitises HTML, on supplier import or on admin save; descriptions are stored exactly as received. The storefront sanitises product descriptions before rendering them (`sanitizeDescription` in hashtag-next's ProductAccordion), so please add DOMPurify in the panel as planned. Sanitising on save and import in the backend is a reasonable addition, but it isn't scheduled yet.

### B11. Sourcing requests and Contact Us pagination (Low)

- **Sourcing requests:** `GET sourcing-requests/admin` paginates with a default `limit` of 20 (`pagination: { total, page, limit, totalPages }`). The admin panel calls it **without** params and pages through the result in the browser, so after 20 requests older ones will silently disappear. We'll switch to server paging.
- **Contact Us:** `GET contactUs` ignores `page` and `limit` and returns a plain array of every row.

**Questions:**
1. Are `page`, `limit` and `search` supported on both endpoints?
2. Can Contact Us get the same paginated shape?

**Answer** (backend, 2026-10-15):

1. **Sourcing requests:** `page` (default 1), `limit` (default 20), `status` and `search` (working since `44141b0`, see A5). **Contact Us:** none of these. It returns every active row as a plain array, newest first.
2. Yes, only when `page` is sent, so the current call keeps working until the panel switches. Built in `44141b0`: `GET contactUs?page=1&limit=20&search=&status=` returns `{ data[], pagination: { total, page, limit, totalPages } }`. Without `page` it still returns the plain array. `limit` is capped at 100; search covers name, email, mobile, reason and message. Live once branch `fix/bug-sweep` is merged and deployed.

---

## C. Consistency (low priority)

### C1. Six different pagination envelopes

| Endpoint | `data` shape |
|---|---|
| `product/admin/get/all` | `{ data[], total, page, totalPages }` |
| `order/admin`, `add-on/addon-product`, `customization-option`, `product-category/get-*-categories`, `sourcing-requests/admin` | `{ data[], pagination: { total, page, limit, totalPages } }` |
| `industry` | `{ data[], pagination: { total, current_page, per_page, total_pages } }` |
| `payment/admin/all` | `{ payments[], total, current_page, total_pages }` |
| `admin/user/getAllUsers` | `{ rows[], count }` (Sequelize `findAndCountAll` passed through) |
| `admin/auth/getAllAdmins`, `contactUs` | a plain array, with no pagination |

**Question:** is there a plan to converge on one shape, for example `{ data[], pagination: { total, page, limit, totalPages } }`? If so, which endpoints and when? The admin panel adapts per endpoint today, so this isn't blocking.

**Answer** (backend, 2026-10-15): Nothing is scheduled. If the envelopes converge, the target is `{ data[], pagination: { total, page, limit, totalPages } }`. Changes would go one endpoint at a time, each listed here before it's deployed.

### C2. Delete and route naming

- Some deletes are `POST …/delete` (`product/delete`, `product-category/delete`, `admin/auth/deleteAdmin`, `admin/user/deleteUser`).
- Others are `DELETE` with a request body (`product-category/delete-parent-category`, `deleteGrandCategory`). Some proxies drop bodies on `DELETE`.
- Route names mix camelCase (`findGrandCategoryById`, `createGrandCategory`) and kebab-case (`get-parent-category`).

No action is needed unless you're already planning a cleanup. If you rename anything, please list the old and new routes here so the panel can be updated in the same release.

**Answer** (backend, 2026-10-15): No renames are planned. Noted on `DELETE` with a body: any future change will move those ids into the URL, and the old and new routes will be listed here first.

### C3. Empty `message` on success

Several successful responses have `message: ""`, while others have text. The panel doesn't depend on it, so this is just a note.

---

## D. Feature questions

### D1. Dashboard data (Low)

The admin Dashboard is a placeholder ("Insights are on the way").

**Question:** is there, or will there be, an endpoint for:
- order count and revenue over a date range;
- orders by status;
- top products;
- recent orders?

If one exists, please give the route and response shape. If not, is it planned?

**Answer** (backend, 2026-10-15): There's no dashboard endpoint today. Existing pieces:
- `GET product/admin/stats`: catalog counts.
- `GET payment/count` and `GET payment/sum`: today's payments. Both are currently public, and the sum is wrong (it joins the amounts as strings), so don't build on them yet.

A dashboard isn't planned yet. A reasonable shape would be `GET admin/dashboard?from=&to=` returning order count and revenue, orders by status, top products and recent orders. It makes sense after the payments phase, because the revenue figures depend on it. That's the owner's call.

---

## E. Follow-ups from the admin panel (2026-10-15, after your answers)

Thanks, the answers were clear. I checked the ones that change panel behaviour against hashtag-backend (read only) and they hold.

### E1. What the panel changed in response (not deployed; the panel deploys separately)

- **Orders (B9, A3):** the panel now keeps three separate maps: order `status` (7 values), `shipment_status` (10 values) and `payment_status` (`SUCCESS` shown as "Paid", `PENDING`, `REJECTED`).
  - The "Order status" filter now sends only real `orders.status` values.
  - A new "Payment" filter always sends `payment_status`: Paid by default, plus Payment pending and Payment rejected. So unpaid orders can be listed.
- **Payments:** tags are mapped from `SUCCESS` / `PENDING` / `REJECTED`. `PENDING` used to show as a red error.
- **Passwords (B7):** the form check now matches `validatePassword.js`: 8 to 100 characters, at least 2 digits, no spaces, not `Passw0rd` or `Password123`.
- **HTML (B10):** DOMPurify sanitises every place the panel renders HTML, including the rich-text editor's starting content. A save from the editor therefore stores the cleaned HTML.
- **Variant prices (B1):**
  - The list column is now "Cost / price", labelled "Supplier cost" for supplier products and "Price" for MANUAL ones.
  - The detail view shows "Supplier sale price" and "Supplier retail price" as reference values.
  - It no longer computes a "margin" from them.

### E2. How each "can fix now" item lands on the panel side

| Item | Panel impact |
|---|---|
| A1 variants filter | None needed. The page works as soon as the endpoint returns 200 with `{ data[], total, page, totalPages }`. |
| A3 orders paging | None needed, as long as the response shape stays `{ data[], pagination: { total, page, limit, totalPages } }`. |
| Sourcing search (`Op` import, plus `details`) | After deploy, the panel will switch to server paging and search (`page`, `limit`, `search`, `status`). Until then it fetches the first 20 and filters in the browser. Production has 3 requests today. |
| A6 generic 5xx | None needed. The panel shows `message` for 4xx and its own text for 5xx after this. |
| Add-on `remove_image` | The panel already sends `remove_image=true`, but until it ships the panel hides "Remove" on a saved add-on image (Replace still works). After deploy, the panel will show Remove again. Please note it here. |
| Contact Us paging | Thanks for keeping the plain array when `page` isn't sent. After deploy the panel will send `page`. Please confirm the deploy here. |
| `GET product/admin/variant/:id` | After deploy, the variant detail page will load by id, so refresh and deep links work. Same shape as a list row, please. |

### E3. One request and one question

1. **Request:** could `order/admin` accept `payment_status=ALL` (or treat an explicit empty value as "all")? Today the panel can show paid, pending or rejected orders, but never all of them in one list. Keep the current default, so existing callers don't change.
2. **Question:** your B9 note says production has 3 unpaid orders. The live `order/admin?payment_status=PENDING` returns 1 (order 7, `ORD-1791896924155`). Order is `paranoid`, so are the other 2 soft-deleted (for example by `invalidatePendingOrder` on a cart change)? If so, nothing to do. Just confirming the panel isn't missing them.

Order 7 is also a live example of audit C8/H8: it's unpaid but already has a label and tracking number. It's already on your list for the payments phase.

**Answer** (backend, 2026-10-26; recorded here from `docs/admin-panel-changes.md`, "Answers to BACKEND_QUESTIONS.md E3"):

1. `GET order/admin?payment_status=ALL` lists orders of every payment status (`96d6432`, branch `feature/client-decisions`). Without the parameter it still lists paid orders only.
2. Yes: when a customer's cart changes, `invalidatePendingOrder` soft-deletes their latest unpaid order, and orders are paranoid, so those two are hidden from every list. The panel isn't missing anything.

---

## E4. What the panel changed (2026-10-27, commits `f8c741f` and `a833bda` on `main`)

Against the backend live since 16 October (`f8c741f`), so these can ship any time:

- **Contact Us and sourcing requests (E2, B11):** server paging (50 a page), search and a status filter.
- **Variants (B1, 16 Oct):** a `?status=` filter and status badges with "Restored …". The variant page loads `GET product/admin/variant/:id`, so a refresh or a link works, removed variants included.
- **Products (16 Oct):** a "Restored" badge from product `restored_at`, and a Status column on the product's variants.
- **SAGE stock (16 Oct):** `stock: null` with `track_inventory: false`, and the old `999999`, read "Not reported by supplier" and count as in stock, as in the shop.
- **Add-ons (B8):** Remove is back on a saved image (`remove_image=true`).
- **Markup (15 Oct):** saving reports the backend's 400 instead of failing silently, and the field takes 0 to 1000.
- **URLs:** the payments list and sourcing status updates now call `payment/admin/all` and `sourcing-requests/:id` without the double slash.

These need the `feature/client-decisions` backend release (`a833bda`) and should ship the same day:

- **Password rule (Q42):** 8 to 128 characters with an uppercase letter, a number and a special character, on change and reset.
- **Super Admins (Q44):** the role is offered on create and edit; other Super Admins can be deleted; your own role and account stay locked.
- **Set password (Q45):** on customers (`PUT admin/user/setPassword/:id`) and other admins (`PUT admin/auth/setAdminPassword/:id`). The panel can generate one, sends it as `password` and `confirm_password`, and shows it once to share.
- **Shipping weight (Q31):** in lb on the product page, the variant page and both product editors, saved only through `PUT product/admin/weight` (product or variant), with Clear sending `null`.
- **Gallery (Q56):** a Gallery screen on `GET gallery/admin`, `POST gallery`, `PUT gallery/:id` and `DELETE gallery/:id`. Several photos can be added at once, one request each. Moving a photo renumbers `sort_order` in steps of 10 and saves each photo whose number changed.
- **Orders (E3):** an "All payments" filter sending `payment_status=ALL`. Paid stays the default.

## E5. Low-priority notes

1. **Weight range:** `admin-panel-changes.md` says 400 "for a weight outside 0 to 150 lb", but `setAdminWeight` also refuses 0. And since it keeps 3 decimals, a weight under 0.0005 lb is saved as 0, which clears it while answering 200. The panel asks for 0.001 to 150 lb; the backend could refuse less too.
2. **Inactive variants on the product page:** `GET product/admin/:id` loads only active variants, so the product page can't show a product's inactive or removed ones; the Variants page's status filter lists them. Would including them, with `status`, be easy? Not blocking.
3. **Gallery order:** with no bulk endpoint, one move costs a `PUT` per photo whose `sort_order` changes (2 once the numbers are spread out). Fine at the shop's 35 photos; a `PUT gallery/order` taking the ids in order would help if the gallery grows. Not blocking.
4. **Default weight:** the panel can't read `DEFAULT_PACKAGE_WEIGHT_LB`, so where a variant has no admin or supplier weight it says "the store's default weight" rather than a number (production still uses 0.5 lb, the release 1 lb). If an admin endpoint exposes the value, the panel can show it.

## E6. The Settings page (2026-10-27, after `docs/admin-settings.md`)

The panel's Settings page follows the brief: reading mode with masked secrets and source badges, edit mode and saving behind the settings key, per-field errors, Reset, the test email and the 10-minute timeout. Two differences:

1. **Super Admins only:** the owner asked for Settings to be a Super Admin control, shared by every Super Admin. The panel shows the menu entry and the page to Super Admins only, but `admin/settings` still answers any admin (the brief applied Q44). If Settings should be Super Admin only, please add `requireSuperAdmin` to `admin/settings/*`; until then a regular admin can still read the masked page through the API, and unlock it with the key.
2. **Keeping Super Admins in step:** the settings are stored once, so every Super Admin sees the same values. While the page is open it re-reads `GET admin/settings` every minute and when the window regains focus: reading mode shows other admins' changes and who made them; edit mode lists settings others changed since unlock, and the save dialog warns when one of them is also being saved. Nothing is needed from the backend for this. An `updated_at` check on `PUT` (refuse a stale save) would make it airtight; not blocking.

The panel also re-reads the admin's role from `GET admin/auth/getProfile` when it opens, on focus and every 5 minutes, so an admin made Super Admin (or no longer one) sees the right menu without signing in again.

## E7. What the panel changed (2026-11-04, against backend `32cc62e`)

On `main`, commits `98642ba`, `443db6c` and `f4ad77e`. Not deployed yet. Everything here also works against an older backend: a field that isn't there shows as `--`, or the section stays hidden.

**The 4 November list in `docs/admin-panel-changes.md`:**

- **Failed labels:** the Shipping tab shows `shipment_error`, with "Try again" calling `POST order/admin/:id/label`. It's offered only when the order is paid, not cancelled and has no `label_url`. A `502` shows ShipStation's new reason; any other refusal reloads the list, since the order changed elsewhere.
- **Finding failed labels:** a "Label failed" badge in the order list and the order's header, and a dot on the Shipping tab.
- **Shipping costs:** the customer paid (`shipping_amount`), the label cost (`actual_shipping_cost`) and the difference (`shipping_profit`, red when negative), plus the service from `service_code`.
- **Graphics:** each item has a Production Files list with a download link per file, with the location or option it's for. `missingArtworkCaution` counts `graphics`.
- **Formats that don't display:** AI, EPS, PSD and CDR stay out of the image gallery. That covers `customized_image` too, which can point at one of those on a pre-made line.
- **`setup_fee`:** reads "Graphic fee" on lines with `graphics`, and "Setup / digitizing fee" on older ones. The panel's order sums still balance.
- **Pre-made lines:** `graphics` is empty on them (see F8), so Production Files also lists each option's `logo_image`.
- **`logo_image` paths:** these now resolve against the panel's file host. They used to use the origin of `original_image`, which is a supplier's CDN on some lines and the panel itself when there's no image.

**The `503` from `docs/admin-settings.md`:** no supplier screen showed it. Those screens now show the backend's message, with an "Open Settings" link for Super Admins (`src/lib/api-errors.ts`).

**Found by comparing the panel with the backend's code:**

- **Imports:** SAGE and OttoCap imports read their counts instead of reporting success. "Imported 3 of 5" is a warning, and failed products stay selected. SanMar says "Not updated" for a locked product. A discontinued SanMar style says so in the preview and after importing.
- **Payments:** Order Totals appears once per order and reads "Order subtotal". It used to repeat under every item, with a per-line label on the order's figure. Pre-made options and add-ons are listed, SAGE rows have their unit price, and supplier cost rows are hidden when the fields are missing, instead of reading $0.00.
- **Sourcing requests:** the note box starts from the saved note. It started empty, so changing a status erased the note.
- **Edit Product:** stock SAGE doesn't report is shown as "Not reported" and isn't sent. It used to save as 0.
- **Remove tier:** on a use case it now calls `tiers/products/:id/exclude`. Clearing the override left a category tier in place, while the panel said "No tier".
- **Use case products:** search now goes to the backend; it only filtered the page on screen.
- **Create Product:** if the variants fail, the panel opens the new product in Edit. A retry used to make a second product.
- **Option names:** trimmed on Edit Manual and Duplicate. A trailing space failed the save.
- **Categories and sub categories:** these lists have a pager; they stopped at 50 rows with no way on.
- **Smaller fixes:** the product page explains a `404` instead of spinning forever. Failed loads and saves are shown on Users, Payments, Pricing, Industries, Use Cases and both category lists. Searches and S&S brand names are URL-encoded. Unpublishing a brand asks first, because it deletes the logo (F16). Remove on an industry or use case image applies only to a new pick (F19). Settings' `missing` flag shows a red tag, and Profile and Change password in the header now get the unsaved-changes warning. Log out and the browser's Back button still don't, because the page can't see them.

The panel's `a833bda` and `159e507` work waits on nothing now that the backend is live, so all of it can ship together.

## F. Backend changes the panel needs (2026-11-04)

Found by reading the backend at `32cc62e` against the panel. Paths are relative to `src/`. "Panel meanwhile" says what the panel does until the change lands. Where the panel has to follow up, the item says so.

### Do first

#### F1. `GET payment/admin/all` needs `requireAdmin` now (High, security)

The route still has no `requireAdmin` (`routes/v1/Common/payment.route.js:19`). That's audit C1, held for the payments phase, but please don't wait for it. `4b5729f` adds a reason that isn't written here because this repo is public. It's in the Team alignment doc, under "Admin panel review".

There's a second effect. With no `req.admin`, `hideSupplierPricing` strips `actual_product_price` and `supplier_markup` from this list once `EXPOSE_SUPPLIER_COST` is off.

**Fix:** add `requireAdmin` to `/admin/all` now. The panel already sends the token, so nothing changes on our side.

**Panel meanwhile:** hides the two cost rows when the fields are missing.

#### F2. The payments list shows the wrong shipping amount (High)

`checkout.service.js:969-971` sends `order.actual_shipping_cost || order.shipping_amount`. DECIMAL columns arrive as strings, so an order with no label gives `"0.00"`, which is truthy, and shows $0.00. Once there's a label it shows the label's cost, and since `4b5729f` that's nearly every paid order. The same bug was fixed in `GET order/admin` (`order.service.js:1265`) but not here.

**Fix:** `Number(order.shipping_amount || 0)`.

#### F3. Neither admin list sends tax (High)

`GET payment/admin/all` and `GET order/admin` have no `tax_amount`, though `getPaymentHistory` does (`checkout.service.js:685-689`), so the Payments totals don't add up to the grand total.

**Fix:** add `tax_amount` and `tax_rate` to `order` in the payments list and to `GET order/admin`.

**Panel meanwhile:** Payments shows a Tax row as soon as `tax_amount` arrives, with no release needed. Orders works it out as total − subtotal − shipping.

#### F4. `payment_method` is always empty (Medium)

`checkout.service.js:943` sends `data.payment_method`, but `Payment` has `payment_mode` and `payment_provider` (`models/payment.model.js:48,71`). The Transaction column's second line is blank.

**Fix:** `payment_method: data.payment_mode`.

#### F5. `GET product/admin/:id` refuses products admins should open (Medium)

`getProductByIdAdmin` passes `is_active: true` (`product.service.js:4150-4153`), under a comment saying admins can open discontinued products. Syncs set `is_active: false` on products a supplier dropped (`ssSync.service.js:60`, `sanmarSync`, `sageSync`), and their variants still link to them.

**Fix:** drop the filter.

**Panel meanwhile:** shows "Product not found" with a way back. It used to spin forever.

#### F6. Imports that hide why they failed (Medium)

The panel can only report what it's told:

1. **`POST sage/import/selected`:** the per-product catch (`sage.service.js:1203`) turns everything into `failed: N` and answers 201, including the `503` for a missing SAGE setting. Please rethrow `ApiError`s of 500 and above. **Panel meanwhile:** when every product fails, it suggests checking Settings, which is only a guess.
2. **`POST sage/import`:** the same catch (`:525`) has no count at all, and the batch ends as `success`. Please return `failed`, and set `partial_success` as `import/selected` does.
3. **`POST product/sync/ss/:styleId`:** any error becomes 500 "Sync failed. Details are saved on import batch N." (`product.controller.js:172-183`), which hides the `503` too. Please rethrow `ApiError`.
4. **The same route, "No data found":** it answers 200 with nothing imported and leaves the batch `processing` (`:155-157`), and the panel reports success. Please answer 404.

#### F7. Locked products look imported, or get overwritten (Medium)

Saves return `{ skipped: true }` for a `sync_locked` product, and each supplier then does something different:

| Supplier | What happens | Where |
|---|---|---|
| S&S | Ignored: "Product synced successfully" | `product.controller.js:160-171` |
| SanMar | Returned; the panel now says "Not updated" | `sanmar.controller.js:88-93` |
| SAGE | Counted as imported | `sage.service.js:523,1198` |
| OttoCap, Import All | `product.id` is undefined, so a 500 | `ottocap.controller.js:54-58` |
| OttoCap, Import Selected | No lock check: the product is overwritten | `ottoCap.service.js:1067` |

**Fix:** honour the lock in `importSelectedOttoVariants`, and return `skipped` from all of them. Once that's in, the panel will show "locked, not updated" for S&S, SAGE and OttoCap too.

### Needed for production

#### F8. Pre-made files have no real name, and downloads lose it (Medium)

Pre-made lines never fill `customization_config.graphics` (`cartWishlist.service.js:1753-1762`), so `graphics` is empty and production sees `customization_images-1793….ai`. `/graphics` also sends `Content-Disposition: attachment` with no filename (`app.js`), so every download saves under the server's name, even when the panel shows the customer's. On a cross-origin link the browser ignores the `download` attribute.

**Fix:** fill `graphics` on pre-made lines with `toLineGraphic`, and send the original name when downloading, for example through a signed-in download route.

**Panel meanwhile:** lists the `logo_image` files under their stored names.

#### F9. Finding failed labels across orders (Medium)

Failed labels are only visible a page at a time, since `GET order/admin` has no filter for them.

**Fix:** a `shipment_status` query parameter. The panel will add it to the filters.

Please also send `carrier_code`: `carrier` stays empty until a label is bought, so a failed order shows only its service.

#### F10. Question: a paid order stuck with no label and no failure

`shipPaidOrder` sets the claim before its `try`, and `Order.findByPk` runs outside it. A crash there, or between claiming and failing, leaves the order paid with `shipment_status: "PENDING"` and no `shipment_error`, and the panel offers "Try again" only on `FAILED`.

Should the panel also offer it on paid `PENDING` orders after the 10-minute claim timeout? We haven't, because a paid order from before this release with no label would then buy a real one. If there's a cut-off date, or if the backend can mark these orders `FAILED` itself, either works.

### Catalog

#### F11. Edit Manual can't remove a value and its variant in one save (High)

The size check runs in step 6 against the database (`product.service.js:784-796`), before step 7 applies the request's variants (`:821`). Deleting a variant and its option value together gets 400 "still used by a variant", after the name, categories and images are already written, since there's no transaction (M31).

**Fix:** remove the sizes after the variants step.

#### F12. A deleted customization's name can't be reused (Medium)

The name check has no `is_active` filter (`customization.service.js:41-52`), and delete only sets `is_active: false` (`:335-338`), so the admin gets "already exists" for a row the list hides. The `-deleted-` slug suffix is also undone by the hooks at `models/customizationOption.model.js:85,101`.

#### F13. Use case and category filters together ignore the use case (Medium)

`getAllProductsAdmin` sets `where.id` for the use case or tier (`product.service.js:4369`), and the category filter overwrites it (`:4446`), so every product in the category is listed. Price and search already intersect (`:4472`, `:4493`).

#### F14. `add-category-to-parent` returns no `grand_categories` (Low)

`parentCategory.service.js:345` loads the parent with no include, and the panel reads `data.parent.grand_categories`, so a new sub category looks unmapped until the page is refreshed.

#### F15. An S&S sync undoes a manual brand (Medium)

`product.service.js:3474` writes `brand_id` without checking `is_brand_manually_assigned`, and that flag doesn't set `sync_locked` (`:4981-4985`). The panel shows "Manually set" until the next sync.

#### F16. Unpublishing a brand deletes its logo (Low)

`brand.service.js:156-172` removes the file and clears `logo_url`. Please keep it, so a brand can be published again without a new upload.

**Panel meanwhile:** asks first and says the logo will be deleted. We'll soften that once it's fixed.

#### F17. A bulk route for excluding from tiers (Low)

"Remove tier" on selected products now sends one `DELETE tiers/products/:id/exclude` per product, up to 50, because the only bulk route clears overrides. A `POST tiers/products/bulk-exclude` taking `{ product_ids, use_case_id }` would replace them. If one of the calls fails, the rest still apply.

#### F18. Use case products: a `source` filter and totals (Low)

`GET industry/use-case/:id/products` has no `source` filter, so the panel's All, Manual and Category chips filter and count only the page on screen. Please add `?source=` and totals per source.

#### F19. Clearing an industry or use case image (Low)

There's no way to remove a saved image (`industry.service.js:149-154,369-374`). Please take `remove_image="true"`, as add-ons do. The panel will bring Remove back for saved images.

#### F20. `GET sage/product/:id`: `track_inventory` and `status` on variants (Low)

The variant list has only `id, sku, color, stock, price` (`sage.service.js:463`).

**Panel meanwhile:** reads a `null` stock as "Not reported". The panel's own stock rule needs `track_inventory`.

#### F21. SAGE totals stop at 1,000 (Medium)

`searchProducts` asks for `maxTotalItems: 1000` and reports `allProducts.length` as the total (`sage.service.js:353,384`). The panel shows that as the real figure, and "Sync Complete Catalog" imports only those 1,000. The supplier list comes from the first 200 products (`:284`).

**Fix:** return the true total, or `capped: true`. The panel will label it.

#### F22. OttoCap data can only be loaded from the server (Medium)

`ottocap/import-catalog` and `import-inventory` take no upload. They re-read fixed files in `<STORAGE_DIR>/imports/ottocap` (`ottoCap.service.js:33,87`), with no cron and nothing in `docs/deployment.md`. The OttoCap tab and its stock are only as new as the last file someone copied there, and the monthly sync reads the same tables.

**Fix:** a multipart upload that replaces the file and runs the import, returning when it was last loaded. The panel will add the upload control. At the very least, please document the steps in `deployment.md`.

**Panel meanwhile:** an empty catalog says it has to be loaded on the server first.

#### F23. Duplicate loses admin weights (Low)

`product.service.js:1171-1195` doesn't return `admin_weight_lb`, so a copy ships at the default. Please return it, and the panel will call `PUT product/admin/weight` after saving the copy's variants.

### Payments list, smaller items

#### F24. Blank sizes (Low)

`size: variant.size_details?.name` reads only the relation, and `size` isn't in the variant's attributes (`checkout.service.js:874,1028`; `order.service.js:1351`). SAGE and OttoCap keep the text in the `size` column, for example "One Size", so it shows blank on both Orders and Payments.

**Fix:** add `size` to the attributes and use `size_details?.name || variant.size`.

#### F25. Removed products lose their details (Low)

The includes at `checkout.service.js:863-875` have no `paranoid: false`, and Product has no `attachments`, unlike `getAdminOrders` (`order.service.js:1119,1151`). Paid lines for items a sync later removed show no name, SKU or colour. `customized_image` also has no `getCustomizationArtwork` fallback here (`:1032`).

A4 is still open too: `subQuery: false` with `limit` (`:909`) gives short pages and cut-off items. That's also why the panel's search filters only the current page, and it doesn't send `search` to this route because of the `Op` bug (`docs/deployment.md`, Known lint errors).

### Customization pricing (2026-11-06)

#### F26. New pricing type `FIXED_QUANTITY` (High)

**Done:** live since 6 November (backend `a8cb702`), charged once per cart line, and tested from the live panel.

The customization form has a fourth pricing choice, **Fixed quantity**: one total that doesn't change with quantity. At $50.00, a cart line of 1 and a cart line of 1,000 both add $50.00.

**What the panel sends:** `pricing_type: "FIXED_QUANTITY"` with the total in `fixed_price`, on `POST customization-option/:optionId/value` and `PUT customization-option/customization-option-value/:id`. It sends no pricing rows. `fixed_price` can hold the total, so no new column is needed.

**What has to change** (line numbers are at `32cc62e`):

- **Schema:** add the value to the `customization_option_values.pricing_type` ENUM in a `_before_deploy` migration, and to `customizationOptionValue.model.js:28`. The rollback has to archive rows using the type and make them inactive first. They can't stay live as `FIXED`, because a $50.00 total would become $50.00 per item.
- **`customization.service.js`:** accept the type at `:409` and `:494`, and treat `fixed_price` as `FIXED` does at `:418` and `:525`. If `:525` is missed, switching a `TIERED` value saves without an error but leaves `fixed_price` null, and the cart then charges $0. `createPricing` (`:724`) and `updatePricing` (`:860`) should refuse the type as they refuse `FIXED`.
- **`cartWishlist.service.js`, `buildManualPricingSnapshot`:** read `fixed_price` at `:750`, don't multiply by quantity at `:903`, and store `unit_price: null` at `:928`, as `QUANTITY_BASED` does. `POST product/cart`, `PUT product/cart`, `PUT product/cart/increment` and `PUT product/cart/decrement` all price through this function, and orders copy its `total_price`, so they need no changes of their own.
- **`docs/frontend-changes.md`:** the customer site gets the type from `GET customization-option/product/:productId/customizations`. It has to show the price as a total and not multiply it by quantity.

**`FIXED` (One price) stays as it is:** `fixed_price × quantity`, which `cartWishlist.service.js:903` already does. At $10.00, 1 item adds $10.00 and 100 items add $1,000.00. `FIXED_QUANTITY` at $100.00 adds $100.00 at both quantities.

**Open question: once per cart line, or once per order?** Please build once per cart line for now. `addToCart` creates one row per variant, so a customer who picks three colours at $100.00 pays $300.00. Once per order would need logic across cart rows.

**Not `quantity_fixed`.** That's a variant `pricing_mode`, with a price for each exact quantity. This one is a customization type with one price for every quantity.

**Panel meanwhile:** the backend refuses the type with a `400`. The panel shows that message and keeps the admin's changes on the page, and no price is stored. On orders, the panel reads this line's `total`, so it needs nothing further.

#### F27. Question: is a Set quantities price per item or a total? (High)

The customization form and the cart disagree about `QUANTITY_BASED`, in two ways:

| | Customization form | Cart (`cartWishlist.service.js`) |
|---|---|---|
| **Price** | "Price per item": 25 at $4.25 shows as adding $106.25 | A total for the line: it adds $4.25 (`:903`) |
| **Quantities** | "Only these exact quantities get a price" | The highest listed quantity at or below the cart's, so 49 items pay the 25-item price (`:833`, audit M28) |

The panel's Orders page already reads it as a total ("Package · 25 units for $4.25"). An admin who trusts the form can set a price far too low, and the customer is undercharged.

If it's a total, the panel changes the form's wording. If it's per item, the cart has to multiply by quantity. Either way, please say whether quantities in between should get a price.

**Panel meanwhile:** the form is unchanged until this is answered.

### Products list (2026-11-12)

#### F28. A `no_parent_category` filter on `GET product/admin/get/all` (Medium)

**Done:** live since 12 November (backend `20ebba1`).

The Products page's "No Parent Category only" filter can only check the 100 products the page has loaded, because `getAllProductsAdmin` (`product.service.js:4261` at `98a783f`) has no parameter for it. Admins see a few matches or none, and the count and page numbers are for the whole catalog.

**What the panel sends:** `no_parent_category=true`, alongside the other filters. Today the backend ignores it.

**Please return only products with no parent category:** products with no categories, or whose categories have no parent category. Use the same rule that fills `categories[].parent_categories` in this response, soft deletes included, so a returned row never shows a parent. `total` and `totalPages` should count only these products.

- Combine it with every other filter (AND), as the category, price and search filters do.
- With `grand_category_id` or `parent_category_id` nothing can match, so return an empty page.
- The catalog is large, so use a `NOT EXISTS` subquery or a join, not a `NOT IN` list of every product that has a parent.

**Panel meanwhile:** it sends the parameter and also checks each row itself. While the backend ignores it, the page says only the current page was checked. Once the backend filters, the count and page numbers are right with no further panel change.

### Pricing templates (2026-11-12)

#### F29. Endpoints to save and load pricing templates (Medium)

Admins keep named quantity pricing on a new **Pricing Templates** page (add, edit, delete), and while creating a product they can load one into a variant or save the variant's pricing as a new one. Every admin shares the same templates, so they have to live on the backend. None of these endpoints exist yet.

**What the panel calls** (admin only, under `/api/v1/`):

| Endpoint | Body | Answer |
|---|---|---|
| `GET pricing-template` | | `{ data: [template, ...] }`, newest `updated_at` first |
| `POST pricing-template` | `{ name, pricing_mode, bulk_pricing, quantity_pricing }` | `{ data: template }` |
| `PUT pricing-template/:id` | the same | `{ data: template }`, or `404` |
| `DELETE pricing-template/:id` | | soft delete, or `404` |

A template is `{ id, name, pricing_mode, bulk_pricing, quantity_pricing, created_at, updated_at }`. The rows use the `ProductVariant.meta` shape: `pricing_mode` is `"tiered"` with `bulk_pricing: [{ min_qty, max_qty, price }]`, or `"quantity_fixed"` with `quantity_pricing: [{ quantity, price }]`. The other list is `null`, and `"fixed"` isn't allowed.

**Please check, on POST and PUT:**

- `name`: trimmed, 1 to 100 characters, and unique among templates that aren't deleted, ignoring case. Answer `409` when it's taken.
- Tiered rows: `min_qty` a whole number above 0, `price` above 0, and `max_qty` blank on the last row only, otherwise above `min_qty`. Each row starts after the previous one ends. `resolveVariantPricing` (`product.service.js:140` at `606cb47`) checks quantity rows but not these.
- Quantity rows: whole numbers above 0, each listed once, `price` above 0, saved in order.
- At most 50 rows. Errors are `400`, with a `message` the panel shows as it is.

**Storage:** a new table (name, style, the rows as JSON, the admin who saved it, timestamps, soft delete), with a `_before_deploy` migration and its rollback.

**Panel meanwhile:** it asks for the list when a page opens. While the backend answers `404`, the page and the Save and Load dialogs say templates aren't available yet, and nothing can be saved.

### Still open from earlier

- **`requireSuperAdmin` on `admin/settings/*`** (E6, item 1): the routes still use `requireAdmin` only.
- **Weight range, inactive variants on the product page, a default weight the panel can read, a bulk gallery order** (E5).
- **`docs/admin-panel-changes.md:165`** still says the SAGE sync runs on the 5th. It's the 1st now.
