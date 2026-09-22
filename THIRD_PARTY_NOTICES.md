# Third-party materials

The approved Air HTML reference contains React/ReactDOM 19.1.1 and Font Awesome Free vector paths. Its notices are retained in the HTML and in reference/air/THIRD_PARTY_NOTICES.md. This historical runtime is not the dependency version contract for the new Web product.

The starter's UI primitives, CSS and selected icons are copied from the user-provided Air reference. Font Awesome path data is in apps/web/src/icon-data.json; the Font Awesome Free icon licensing notice in reference/air/THIRD_PARTY_NOTICES.md applies to those copies as well.

The normal frontend installs official React/ReactDOM, Vite, TypeScript and type definitions via npm. Preserve their notices and record the actual versions and lockfile when installed. They are not bundled as node_modules in this delivery.

No font files, external Refero assets, credentials, or old repository implementation are included. No new public license for the user's product is assumed; the owner should choose a product license before public distribution.
