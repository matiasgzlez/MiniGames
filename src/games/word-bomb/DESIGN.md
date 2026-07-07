# Bomba Palabra — Direccion de arte: "Prensa de papel"

Bomba Palabra no es un juego neon ni de fuego: es un **juego de palabras**, y su
estetica es la de la palabra impresa. El lenguaje es el de la landing y el
`RoomOverlay`: **papel crema, tinta, pastillas de borde firme**. Editorial,
limpio, tipografico. La tension no la pone el color ni el brillo; la pone el
**reloj** y la **letra grande**.

## Principio

**La tipografia es el juego.** Todo lo que importa se lee: el fragmento a
completar es el objeto mas grande de la pantalla, y la palabra que el jugador
escribe aparece con el mismo peso. El resto (jugadores, vidas, mecha) es
mobiliario alrededor de ese acto de leer y escribir. Si algo no ayuda a leer el
reto o a sentir el tiempo, sobra.

## Paleta

Hardcodeada, la misma familia que la landing (no depende de variables externas):

- **Papel** `#f4ecd8` — fondo. Un crema calido, no blanco.
- **Tinta** `#1c1a17` — texto, bordes, marcas. Casi negro, con temperatura.
- **Tinta suave** `#6b6455` — texto secundario, etiquetas, contadores.
- **Sello** `#c0392b` — un unico rojo de "sello de goma" para el peligro: la
  mecha cuando queda poco tiempo, la palabra rechazada, la vida perdida. Se usa
  con avaricia; es el unico acento.
- **Verde palabra** `#2e7d5b` — confirmacion de palabra aceptada. Segundo acento,
  igual de contenido.

Nada de gradientes de neon ni glows. Sombras minimas y duras (offset solido tipo
sello), no difusas.

## Vocabulario visual

- **Bordes tinta de 2-3px, esquinas apenas redondeadas** (pastillas, cartas), como
  el `RoomOverlay`. Todo se siente impreso y recortado.
- **El fragmento** va en una tarjeta central, mayusculas, tracking amplio, la
  pieza tipografica dominante.
- **La mecha = una regla de tiempo**, no una llama: una barra horizontal de tinta
  que se consume de izquierda a derecha; vira al rojo sello en el ultimo tramo. Es
  literal y legible, coherente con "el tiempo es lo que aprieta, no el fuego".
- **Las vidas** son marcas de tinta simples (tres trazos / puntos) que se tachan
  al perderse, no corazones ilustrados.
- **Los jugadores** son una fila de nombres en pastillas; el de turno se resalta
  invirtiendo tinta/papel (fondo tinta, texto papel), como un renglon subrayado.

## Movimiento

Sobrio y mecanico, de imprenta: la palabra aceptada "sella" (un pequeno punch +
asentar), el turno pasa con un desplazamiento corto, la mecha corre lineal. Sin
rebotes elasticos ni particulas. El unico momento intenso es la explosion de la
mecha: un golpe seco de rojo sello, breve, y sigue.

## Que evitar

- Neon, glows, degradados saturados (ese es el lenguaje de los otros juegos, no
  de este).
- Iconografia de dinamita/mecha encendida realista: la bomba es un concepto, no
  una ilustracion protagonista. El reloj manda.
- Tipografia decorativa. Una sans de buen peso y una serif/mono para el fragmento
  si aporta caracter, nada mas.
