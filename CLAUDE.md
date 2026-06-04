# Expressão da Uva — Projeto Wine Chat avec Avatar 3D

## Projet
Application React + Vite + TypeScript pour une cave à vin en ligne "Expressão da Uva". L'application inclut un chatbot sommelier avec un avatar 3D parlant du personnage "Luis".

## Structure clé
- `src/components/AvatarLuis.tsx` — Composant Three.js avec FBXLoader qui charge model.fbx (remplace TalkingHead3D.tsx)
- `src/components/ChatBot.tsx` — Panneau de chat qui intègre TalkingHead3D avec autoSpeak
- `public/model.fbx` — Modèle 3D FBX de Luis (9.1MB) avec morph targets
- `public/lui.png` — Photo de fallback

## Problème actuel
L'avatar Three.js avec FBXLoader ne s'affiche pas — l'utilisateur voit un cadre noir. Causes probables :
1. Le scale auto (bounding box) du FBX est incorrect
2. La position de la caméra ne cadre pas le modèle
3. Le modèle FBX a des skinned meshes mais leur géométrie n'est pas détectée
4. Il manque peut-être un wrapper de groupe ou une mise à jour de la matrice après scale

## Objectif
1. Faire apparaître le modèle FBX (Luis) correctement cadré dans la scène Three.js
2. Animer les morph targets jawOpen pour le labial (lip-sync) avec Web Speech API
3. Animer les morph targets eyeBlinkLeft/Right pour clignement des yeux
4. Remplacer le fallback sphere orange par le modèle réel
5. Style: fond marron (#2a1a0e), lumières chaudes

## Détails du FBX
- Format: Kaydara FBX, version 7400 (binaire)
- 84 BlendShapeChannel
- Morph targets: jawOpen, eyeBlinkLeft, eyeBlinkRight
- C'est un personnage skinned (SkinnedMesh avec bones et morph targets)
