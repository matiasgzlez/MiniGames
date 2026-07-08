# Bomba Palabra — Direccion de arte: "Mesa de bomba"

Bomba Palabra se ve como una **ronda alrededor de una bomba**: los jugadores
forman un circulo y en el centro late la bomba con el fragmento a completar. Es el
lenguaje clasico de BombParty. Fondo oscuro y calido de mesa, avatares genericos,
y una sola cosa encendida a la vez: **el jugador al que apunta la bomba**.

## Principio

**La atencion es un foco.** En cada turno hay un unico protagonista: el jugador
de turno. La bomba lo apunta, su nombre se enciende, y lo que escribe aparece
debajo de su avatar en vivo. Todo lo demas (los otros jugadores, sus vidas, sus
ultimas palabras) queda en penumbra alrededor. El diseno existe para que, de un
vistazo, sepas **de quien es el turno y que esta escribiendo**.

## Layout

- **Circulo de jugadores** alrededor de un centro. Se reparten por angulo (uno
  arriba, el resto girando), soportando de 2 a **8** jugadores (el tope de la
  sala) sin solaparse.
- **La bomba en el centro**, un disco oscuro con el **fragmento** (silaba/combo)
  en mayusculas. Una **flecha/chispa** amarilla sale de la bomba y apunta al
  jugador de turno; gira hacia el que corresponde.
- **Cada jugador** es una columna: **nombre arriba**, **avatar generico** (una
  silueta violeta sobre una placa gris — nunca fotos ni imagenes propias), y
  **debajo lo que escribe**. Encima del avatar, su estado: corazones (vidas) o una
  calavera si quedo afuera.
- **No hay caja de texto.** El jugador de turno simplemente escribe y el texto
  aparece debajo de su avatar. (En movil un input invisible summonea el teclado,
  pero visualmente no hay caja: el texto se lee bajo el avatar.)

## Paleta (de la referencia)

- **Mesa** `#3a3330` — fondo, un marron/gris calido y oscuro. Degrade sutil al
  centro para dar profundidad de foco.
- **Nombre** `#f5f2ee` — blanco calido, peso alto.
- **Placa de avatar** `#8a8a8a` sobre la que va la **silueta** `#6a5f86` (violeta
  apagado), el avatar generico universal.
- **Turno** `#46d16a` — el nombre del jugador de turno se pone verde. Unico color
  de "estas vos / es su turno".
- **Chispa/flecha** `#f5c518` — el amarillo de la mecha encendida que apunta.
- **Vidas** corazones rojos `#ff5a5f`; **eliminado** calavera y nombre tachado,
  atenuado. **Desconectado** en cursiva/gris (sigue en la ronda, la mecha lo
  castiga como AFK).
- **Rojo peligro** `#e23b3b` — la palabra rechazada y el golpe de la explosion.

## Vocabulario visual

- **Avatar generico** identico para todos: placa gris con silueta violeta. La
  identidad la da el **nombre**, no una imagen. Es deliberado (rapido, parejo, sin
  assets).
- **Corazones y calavera** como marcas claras y legibles arriba del avatar, no
  ilustraciones recargadas.
- **La bomba** es un disco simple con el fragmento; la tension la pone la
  **flecha que apunta** al jugador de turno, no una ilustracion de dinamita.
- **La mecha es visible para todos, en todos los turnos**: un **anillo alrededor
  de la bomba** se consume con el tiempo y debajo del fragmento cuenta los
  **segundos restantes**. Va de **chispa amarilla** (llena) a **rojo peligro**
  (por vaciarse), con un pulso cuando esta por explotar. Es informacion clave del
  juego: saber cuanto le queda a la bomba es parte de la decision. El server tiene
  el deadline real y manda los ms restantes; el cliente los ancla a su reloj local
  para animar el anillo sin drift entre maquinas.
- **Texto en vivo** debajo del avatar: lo que se teclea se ve al instante (propio
  y ajeno, via el relay del server). La ultima palabra aceptada queda debajo del
  avatar hasta el proximo turno de ese jugador.

## Movimiento

Sobrio y con foco: al pasar el turno, la flecha **gira** hacia el nuevo jugador y
su nombre se enciende. La palabra aceptada da un pequeno "sello"; el rechazo
sacude el avatar. La explosion de la mecha es un golpe seco de rojo. Nada de
rebotes elasticos ni particulas: la energia esta en el foco que salta de jugador
en jugador.

## Que evitar

- Fotos / avatares personalizados: rompe la lectura pareja y mete assets. Siempre
  la silueta generica.
- Una caja de input visible: se escribe directo, el texto vive bajo el avatar.
- Neon / glows saturados: la mesa es oscura y calida, no arcade. El unico color
  fuerte es el foco (verde del turno, amarillo de la chispa, rojo del peligro).
