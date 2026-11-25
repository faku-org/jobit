# Recomendador

Cuánto le sirve una oferta a cada persona, y por qué. Todo corre en el
navegador sobre lo que la persona cargó: no hay modelo, no hay servidor de por
medio y no hay caja negra. El puntaje es la suma de razones, y esas mismas
razones son las que se muestran.

Código: `web/src/lib/recommend.ts` (puntaje y razones), `web/src/lib/skills.ts`
(habilidades), tests en `web/src/lib/recommend.test.ts`.

## Cómo puntúa

`recommender(preferences, profile, resume)` devuelve una función
`(job) => { score, reasons }`. Cada razón trae `points` (positivo suma, negativo
resta) y una frase en lenguaje llano. `score` es la suma de los `points`; las
razones vienen ordenadas de la que más pesa a la que menos.

Los pesos viven en `WEIGHTS` (`recommend.ts`) y son estos:

| Razón                                    | Puntos | Frase de ejemplo                          |
| ---------------------------------------- | ------ | ----------------------------------------- |
| Rubro entre los elegidos                 | +20    | Es de Tecnología, tu rubro                |
| Departamento elegido                     | +10    | Es en Montevideo, tu zona                 |
| Modalidad preferida                      | +6     | Es remoto, como preferís                  |
| Nivel que pidió ver                      | +5     | Es nivel junior, el que buscás            |
| Jornada preferida                        | +4     | Es la jornada que preferís                |
| Habilidad que pide la oferta y tenés     | +8 c/u | Pide React, que está en tu CV             |
| Habilidad que pide y no tenés            | −3 c/u | Pide SQL y no lo tenés cargado            |
| Cumple los años de experiencia que pide  | +8     | Pide 2 años y tenés 5 años                |
| Le faltan años de experiencia            | −10    | Pide 3 años y tenés 2 años                |
| No pide experiencia y estás arrancando   | +8     | No pide experiencia previa                |
| Nivel de la oferta acorde a tus años     | +6     | Es nivel junior, acorde a tus años        |
| Nivel de la oferta muy lejos de tus años | −6     | Es nivel senior y queda lejos de tus años |
| Estudios que alcanzan                    | +5     | Pide universitario y tenés universitario  |
| Estudios que no alcanzan                 | −8     | Pide universitario y cargaste primaria    |

Reglas que acotan el puntaje:

- Habilidades que suman: tope de 3 (`skillCap`). Las que faltan restan hasta 3
  (`skillMissingCap`).
- Las habilidades que faltan solo restan si la persona ya tiene alguna cargada.
  Un perfil sin habilidades no se castiga por no haberlas completado.
- Si la oferta dice cuántos años pide, se compara con los años y el nivel se
  ignora. El nivel contra los años solo se usa cuando la oferta no da años.
- Una persona con más de 1 año de experiencia no suma por "no pide
  experiencia": esa oferta no es para quien ya tiene recorrido.
- Sin preferencias ni perfil el puntaje es 0 y no hay razones.

## Habilidades

Las de la persona usan el mismo catálogo que las ofertas
(`worker/src/skills.ts`, `skillsOf`). Una habilidad es un slug cerrado, nunca
texto libre, así "Pide React" y "tenés React" son el mismo valor.

- **Del CV y el perfil**: se leen con `skillsOf` sobre los títulos, los cursos,
  el puesto del CV y los idiomas del CV.
- **A mano**: `profile.skills`, elegidas del catálogo en Configuración > Perfil.
- **Quitadas**: `profile.skillsOff` guarda las que salen del CV y la persona
  sacó, para que no vuelvan a aparecer.
- Sumar a mano le gana a quitar: una habilidad en `skills` cuenta aunque esté en
  `skillsOff`.
- Las de la oferta se leen del título, los requisitos y la descripción, y se
  cachean por oferta.

## Dónde se ve

- **Tarjeta**: hasta 2 razones positivas (`cardReasons`), las que más pesan.
- **Ficha** (`JobFit`): las razones positivas y las que faltan, en dos listas.
  Las de experiencia y estudios no se repiten: ya salen en la lista de
  requisitos de arriba.
- **"Para vos"**: `pickHighlights` ordena con este puntaje. El conjunto de
  candidatas no cambia: pasan las que cumplen las preferencias booleanas y,
  salvo en mezcla amplia, las que no dejan al perfil corto.

## Qué nunca sale del navegador

- Las habilidades, el CV, los años de experiencia y el puntaje de cada oferta.
  Nada de esto se manda al servidor ni a los eventos anónimos.
- La API ordena `sort=match` con `api/src/rank.ts` y solo lo que ya viaja en la
  consulta (rubros, departamentos, modalidad, nivel, jornada, sueldo, estudios
  y años). Las habilidades no forman parte de ese contrato.
- Con el sync de cuenta prendido viaja `profile.skills` y `profile.skillsOff`,
  que son slugs del catálogo, igual que ya viajan los títulos y los cursos. El
  CV sigue siendo solo local. Al mezclar dos navegadores las habilidades se
  unen (tope 30) y sumar le gana a quitar (`mergeProfile` en `sync.ts`).
