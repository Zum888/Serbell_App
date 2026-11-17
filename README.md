# Serbell Reconciliation Lab

Laboratorio local de conciliación. No es el producto de producción: no conecta bancos, no cierra el mes y no lee comprobantes con OCR.

## Run

```bash
npm install
npm run db:reset
npm run dev
```

Abre http://127.0.0.1:3000

## Perfiles

El menú superior derecho cambia de persona. No hay contraseña y todos leen la misma base.

| Perfil | Papel | Empresa |
| --- | --- | --- |
| Padrino | Propietario | Solo Quick Pick Logistics |
| Luis Rivera | Propietario | Solo Rivera Construction |
| Carlos Ruiz | Contador | Las dos empresas. Puede revisar, corregir, aprobar y sellar. |
| Ana Martínez | Administración de la firma | Las dos empresas. Es la única que puede reabrir un sello, con justificación. |

## Reset

```bash
npm run db:reset
```

Borra el archivo SQLite local, vuelve a crear el esquema y carga la semilla de demostración.

## Tests

```bash
npm test
npm run test:e2e
```

## Qué está guardado

Movimientos, saldos, comprobantes, vínculos, categorías, mensajes, tareas, reglas de corrección y auditoría viven en SQLite (`prisma/dev.db`). Los archivos subidos quedan en `storage/uploads/`. El dinero se guarda en centavos.

El saldo de Quick Pick Logistics (USD 4,140.49, Bank of America ····3366) sale de esa base. Utilidad, por cobrar, por pagar y las dos tarjetas de “Tu resumen de hoy” están marcadas como demostración.

El ticket FleetSmarts de USD 203.94 del 12 oct 2026 también es un dato de demostración: el laboratorio no lee el archivo. Cualquier otro archivo se guarda vacío y hay que completar comercio, fecha e importe.

## Qué no está implementado

Plaid, WhatsApp, libro mayor, asientos, cierre de mes, conciliación de extracto, cobranza y pagos. Una regla aprendida se guarda y no se aplica sola. Vincular un comprobante no aprueba el movimiento ni lo concilia con el banco.
