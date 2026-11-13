# Ruta Segura Fusa - dirección corregida

## Cambios
- La descripción del residuo y la dirección ahora son campos separados.
- Acepta barrio, dirección completa o punto de referencia.
- Si no encuentra la dirección, permite tocar el mapa manualmente.
- El marcador siempre puede arrastrarse antes de confirmar.
- Residuos hospitalarios, biológicos, con sangre, agujas, jeringas y material infeccioso quedan forzados a riesgo ROJO incluso si Gemini responde otra cosa.

## Ejecutar
1. `npm install`
2. Copiar `.env.example` como `.env` y agregar `GEMINI_API_KEY`.
3. `npm run dev`
4. Abrir http://localhost:3000

## Prueba
Descripción: `Gasas contaminadas y jeringas usadas`
Dirección: `Carrera 6 # 8-20, Centro, Fusagasugá`
Resultado esperado: riesgo Rojo. Si la dirección no aparece, usar Elegir punto manualmente.
