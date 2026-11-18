# Itinéraire QR — Clinique Mont Carmel

Générateur de QR code d’itinéraire GPS **scannable de manière illimitée et sans expiration**, prêt à être hébergé gratuitement sur **GitHub Pages**.

## Pourquoi les scans sont-ils illimités ?

Contrairement aux générateurs payants qui utilisent des liens courts temporaires, ce QR code encode directement l’URL officielle d’itinéraire Google Maps :

```
https://www.google.com/maps/dir/?api=1&destination=5.3552392,-4.0985352
```

- **Aucun quota de scans** : il fonctionne à l’infini.
- **Aucune expiration** : aucun abonnement ni serveur payant requis.

## Hébergement gratuit sur GitHub Pages

Ce dépôt contient déjà la configuration automatique (`.github/workflows/deploy.yml` et `base: './'` dans `vite.config.ts`).

1. Créez un dépôt sur GitHub et poussez ces fichiers sur la branche `main`.
2. Dans votre dépôt GitHub, ouvrez **Settings → Pages**.
3. Sous **Build and deployment → Source**, sélectionnez **GitHub Actions**.
4. Après quelques secondes, votre site est en ligne sur :
   - Générateur complet : `https://<votre-identifiant>.github.io/<nom-du-depot>/`
   - Page de redirection directe : `https://<votre-identifiant>.github.io/<nom-du-depot>/go/`

> Astuce : Si vous générez le QR code vers votre page `/go/` hébergée sur GitHub Pages, vous pouvez modifier les coordonnées GPS dans `public/go/index.html` plus tard sans jamais devoir réimprimer vos affiches QR !
