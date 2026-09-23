# SlotGuard

![SlotGuard: una sala, dos solicitudes](assets/readme-hero.png)

**Dos personas. Una sala. El mismo horario. ¿Quién consigue reservar?**

[English](README.md) · [Wiki](https://github.com/DimaGutierrez/slotguard/wiki) · [Discussions](https://github.com/DimaGutierrez/slotguard/discussions)

SlotGuard es un prototipo fullstack funcional de reservas de salas. React y TypeScript muestran disponibilidad y alternativas; FastAPI y PostgreSQL protegen la escritura cuando dos solicitudes compiten.

## Probalo localmente

Necesitás Docker con Compose. Desde la raíz:

```powershell
Copy-Item .env.example .env
# Editá POSTGRES_PASSWORD con un valor aleatorio alfanumérico largo.
docker compose up --build
```

Abrí **http://127.0.0.1:8000**. Usuario `alice`, `bob` o `admin`; contraseña de demo `slotguard-demo`. Son cuentas ficticias para uso local. No publiques esta configuración en Internet.

Entrá en **Concurrency lab** y ejecutá el desafío. El navegador envía dos solicitudes reales: una confirma y otra recibe un conflicto. La pantalla consulta luego cuántas reservas quedaron confirmadas en PostgreSQL. El ganador no está predeterminado.

En **Room planner** podés crear y cancelar reservas, consultar uno o siete días y elegir alternativas si alguien tomó el horario. El administrador puede crear salas y ver el historial de acciones. Las ilustraciones promocionales son conceptuales; no son capturas de la app.

## Qué demuestra

- Exclusión de intervalos superpuestos en la base de datos.
- Reintentos idempotentes, independientes de los conflictos entre usuarios.
- Sesiones, CSRF, roles y permisos de propietario.
- Pruebas de concurrencia con PostgreSQL real y recorridos de navegador.
- Interfaz adaptable, mensajes de error y recuperación del conflicto.

Es v0.1 para un único espacio de trabajo. La agenda se refresca explícitamente y tras operaciones; no hay actualización push. Pagos, calendario externo, recordatorios y recurrencia quedan fuera de esta versión.

[Instalación nativa y configuración](docs/setup.md) · [Validación](docs/verification.md) · [Seguridad](SECURITY.md).

Contanos en [Discussions](https://github.com/DimaGutierrez/slotguard/discussions) qué te resultó confuso, cómo probarías la concurrencia y qué función te haría volver a usarlo. Podés responder en español o inglés.
