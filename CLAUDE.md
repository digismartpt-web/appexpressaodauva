# Expressão da Uva — Projeto Wine Chat avec Avatar 3D

## Projet
Application React + Vite + TypeScript pour une cave à vin en ligne "Expressão da Uva". L'application inclut un chatbot sommelier avec un avatar 3D parlant du personnage "Luis".

## Structure clé
- `src/components/AvatarLuis.tsx` — Composant Three.js avec FBXLoader qui charge model.fbx (remplace TalkingHead3D.tsx)
- `src/components/ChatBot.tsx` — Panneau de chat qui intègre AvatarLuis avec autoSpeak
- `public/model.fbx` — Modèle 3D FBX de Luis (9.1MB) avec morph targets
- `public/lui.png` — Photo de fallback

## Problème résolu (dernière correction)
L'avatar Three.js avec FBXLoader ne s'affichait pas — cadre noir. **Causes corrigées** :
1. **Camera trop proche** : position.z passée de 1.0 à 2.5 (avant chargement), puis 1.5 (après chargement)
2. **Scale trop petit** : targetHeight passé de 0.35 à 1.8 — le FBX était plus petit que prévu
3. **Double-multiplication du centre** : le centre était multiplié une seconde fois par le scale après transformation
4. **Mauvaise position de camera** : camera.lookAt(0, -0.05, 0) pour viser le visage

## Détails du FBX
- Format: Kaydara FBX, version 7400 (binaire)
- 84 BlendShapeChannel
- Morph targets: jawOpen, eyeBlinkLeft, eyeBlinkRight
- SkinnedMesh avec bones et morph targets

## Dev server
- `http://76.13.141.221:5173` (Vite dev, hot reload)
- `npm run build` pour prod
