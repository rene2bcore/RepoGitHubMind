# auth Specification

## Purpose

Da a cada persona una cuenta propia con la que entrar y salir, y hace que todo lo demás sea suyo: sin sesión no hay biblioteca, y con sesión solo hay la propia. Es la capability que sostiene la promesa de que las bibliotecas son privadas.

Historia: H1 · RGM-2.

## Requirements

### Requirement: Registro de una cuenta nueva

El sistema SHALL crear una cuenta a partir de un email, una contraseña y su confirmación cuando se envíe `POST /api/v1/auth/register`, SHALL abrir sesión en la misma respuesta, y SHALL responder `201` con la cuenta creada sin la contraseña ni su hash.

#### Scenario: Alta correcta

- **WHEN** se envía `POST /api/v1/auth/register` con `{"email": "ada@example.com", "password": "secreto123", "passwordConfirmation": "secreto123"}`
- **THEN** la respuesta es `201` con `{"data": {"id": ..., "email": "ada@example.com", "role": "USER", "createdAt": ...}}`, sin ningún campo de contraseña, y trae la cookie de sesión

#### Scenario: Validación de los datos de registro

- **WHEN** se envía un email mal formado, una contraseña de menos de 8 caracteres o una confirmación distinta
- **THEN** la respuesta es `422` con un error por cada campo que falla, con su `field` y su `rule`, y no se crea ninguna cuenta

#### Scenario: Varios campos inválidos a la vez

- **WHEN** se envían los tres campos mal a la vez
- **THEN** la respuesta trae los tres errores, cada uno con su campo, y no solo el primero

### Requirement: Un email, una sola cuenta, ignorando mayúsculas

El sistema SHALL guardar el email normalizado a minúsculas y SHALL rechazar con `422` sobre el campo `email` cualquier alta cuyo email ya exista con cualquier combinación de mayúsculas.

#### Scenario: Alta repetida con otras mayúsculas

- **WHEN** existe `ada@example.com` y se intenta registrar `Ada@Example.com`
- **THEN** la respuesta es `422` sobre `email` y sigue habiendo una sola cuenta

#### Scenario: Carrera de altas

- **WHEN** dos altas con el mismo email llegan a la vez
- **THEN** solo una crea la cuenta; la otra responde `422` y no un `500`, porque el índice único sobre `lower(email)` se traduce a la forma de error del proyecto

### Requirement: Inicio de sesión

El sistema SHALL abrir sesión con email y contraseña correctos, y SHALL responder al fallo de acceso **igual** con un email desconocido que con una contraseña equivocada, sin revelar si la cuenta existe.

#### Scenario: Acceso correcto

- **WHEN** se entra con `ada@example.com` y su contraseña
- **THEN** se abre sesión y la siguiente petición a una ruta privada responde `200`

#### Scenario: Un fallo no revela si la cuenta existe

- **WHEN** se entra con un email que no existe, y por separado con un email que existe y una contraseña equivocada
- **THEN** las dos respuestas tienen el mismo código y el mismo cuerpo

#### Scenario: Demasiados intentos

- **WHEN** la misma dirección supera el límite de intentos de acceso en la ventana configurada
- **THEN** la respuesta es `429` con la forma de error del proyecto, y los intentos siguientes no se evalúan hasta que pase la ventana

### Requirement: La sesión sobrevive a recargar y termina al salir

El sistema SHALL mantener la sesión en una cookie segura, `HttpOnly` y `SameSite`, de modo que recargar la aplicación conserve la sesión, y SHALL invalidarla al cerrar sesión.

#### Scenario: Recargar

- **WHEN** una persona con sesión recarga la aplicación
- **THEN** sigue dentro sin volver a introducir credenciales

#### Scenario: Salir

- **WHEN** cierra sesión
- **THEN** la cookie deja de valer, y una petición a una ruta privada con esa cookie responde `401`

### Requirement: Protección de los recursos privados

El sistema SHALL responder `401` con `{"errors": [{"message": ...}]}` y sin ningún dato a toda petición a una ruta privada sin sesión válida. La identidad SHALL tomarse siempre de la sesión en el servidor y NO SHALL aceptarse ningún identificador de usuario que venga del cliente.

#### Scenario: Sin sesión

- **WHEN** se solicita `GET /api/v1/repositories` sin cookie, o con una cookie inventada o revocada
- **THEN** la respuesta es `401` y no se devuelve ningún repositorio

#### Scenario: Un userId en el cuerpo no cambia nada

- **WHEN** una petición con sesión de Ada incluye en el cuerpo o en la query un `userId` de otra cuenta
- **THEN** el sistema lo ignora y actúa como Ada

### Requirement: Pantallas de acceso

La interfaz SHALL ofrecer las pantallas de registro y de acceso, mobile first, con los errores de validación junto a cada campo y en castellano, un estado visible mientras se envía, y SHALL llevar a la biblioteca al entrar. Con sesión, `/login` y `/register` SHALL redirigir a la biblioteca; sin sesión, toda pantalla privada SHALL redirigir a `/login`.

#### Scenario: Registrarse desde la pantalla

- **WHEN** una persona rellena el formulario de registro y lo envía
- **THEN** entra directa a su biblioteca vacía, con un mensaje que explica qué es y cómo guardar el primer repositorio

#### Scenario: Errores junto al campo

- **WHEN** envía el formulario con la confirmación distinta
- **THEN** el aviso aparece junto al campo de confirmación, en castellano, y no se pierde lo escrito

#### Scenario: Llegar a la biblioteca sin sesión

- **WHEN** alguien sin sesión abre `/library`
- **THEN** se le lleva a `/login` y no ve ningún dato

#### Scenario: El servidor no está disponible al arrancar

- **WHEN** la aplicación arranca con sesión guardada y el servidor no responde
- **THEN** se avisa de que no se pudo conectar, se conserva la sesión, y al recuperar el servidor y recargar se sigue dentro
