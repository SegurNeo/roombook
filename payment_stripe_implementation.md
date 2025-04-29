
¡Perfecto! Entendido el enfoque principal: gestión de alquileres de activos con **domiciliación bancaria (SEPA Direct Debit)** como método de pago principal a través de Stripe, dejando de lado los Payment Links por ahora.

Aquí tienes un plan paso a paso más detallado, adaptado a tu estructura actual y enfocado en la domiciliación:

**Fase 1: Sincronización de Clientes y Preparación de Stripe**

1.  **Modificación Base de Datos (Supabase - `customers`):**
    *   **Objetivo:** Preparar la tabla de clientes para guardar la referencia de Stripe.
    *   **Acción:**
        *   Añadir una columna `stripe_customer_id` (tipo `TEXT`, `UNIQUE`) a tu tabla `customers`.
        *   *Opcional pero recomendado:* Añadir `stripe_payment_method_id` (tipo `TEXT`, `nullable`) para guardar el método de pago SEPA por defecto del cliente una vez configurado.
        *   *Opcional pero recomendado:* Añadir `stripe_mandate_status` (tipo `TEXT`, `nullable`, ejemplo: 'pending', 'active', 'failed') para seguir el estado del mandato SEPA.
    *   **Cómo:** Usa la CLI de Supabase para crear un nuevo archivo de migración (ej: `supabase db diff --schema public > supabase/migrations/YYYYMMDDHHMMSS_add_stripe_customer_fields.sql`), edita el SQL generado para añadir las columnas, y aplica la migración (`supabase db push`).

2.  **Configuración Inicial de Stripe:**
    *   **Objetivo:** Asegurarse de que la cuenta de Stripe está lista para SEPA.
    *   **Acción:**
        *   Verifica que tu cuenta de Stripe esté activa y que los pagos SEPA Direct Debit estén habilitados (puede requerir pasos adicionales en el dashboard de Stripe).
        *   Obtén tus claves API: Clave Publicable (Publishable Key) y Clave Secreta (Secret Key) desde el dashboard de Stripe. Guárdalas de forma segura (usaremos los Secrets de Supabase Edge Functions).

3.  **Backend: Función para Crear Cliente en Stripe (`supabase/functions/create-stripe-customer`):**
    *   **Objetivo:** Crear automáticamente un `Customer` en Stripe cuando se crea uno en tu BD.
    *   **Acción:**
        *   Crea la estructura de la Edge Function: `supabase functions new create-stripe-customer`.
        *   Instala la librería de Stripe: `cd supabase/functions/create-stripe-customer && npm install stripe --save-dev && cd ../../..`.
        *   **Código (`index.ts`):**
            *   Recibirá los datos del nuevo cliente (idealmente desde un trigger de BD: `record.id`, `record.email`, `record.first_name`, `record.last_name`).
            *   Usará la Clave Secreta de Stripe (configurada como secret en Supabase: `supabase secrets set STRIPE_SECRET_KEY=sk_test_...`).
            *   Llamará a `stripe.customers.create({ email: record.email, name: ${record.first_name} ${record.last_name}, metadata: { supabase_customer_id: record.id } })`.
            *   Actualizará la fila correspondiente en `public.customers` con el `id` del cliente de Stripe devuelto, guardándolo en `stripe_customer_id`.
            *   Manejará errores adecuadamente.
        *   Despliega la función: `supabase functions deploy create-stripe-customer --no-verify-jwt` (si la llama un trigger, JWT no aplica directamente).

4.  **Trigger de Base de Datos (Supabase):**
    *   **Objetivo:** Invocar la función anterior automáticamente.
    *   **Acción:**
        *   Crea un trigger SQL en tu base de datos Supabase sobre la tabla `customers`.
        *   El trigger se ejecutará `AFTER INSERT ON public.customers`.
        *   Llamará a la función `create-stripe-customer` pasándole los datos del `NEW` registro. (Puedes usar `supabase functions deploy` o crear el trigger directamente en el dashboard SQL de Supabase o en un archivo de migración).

**Fase 2: Configuración del Mandato SEPA (Autorización del Cliente)**

*   **Contexto Clave:** Para cobrar por domiciliación SEPA, necesitas la **autorización explícita (mandato)** del cliente (su IBAN y consentimiento). La forma más segura y estándar de recoger esto es usando **Stripe Checkout en modo 'setup'**.

5.  **Frontend: Interfaz para Iniciar Configuración de Mandato:**
    *   **Objetivo:** Darle a la empresa (usuario de tu software) un botón para iniciar el proceso de configuración del mandato para un cliente específico.
    *   **Acción:**
        *   En la vista de detalles del cliente o en la fila de la tabla `customers-table.tsx`, añade un botón "Configurar Domiciliación SEPA".
        *   Este botón *no* pedirá el IBAN directamente. Llamará a una nueva Edge Function.
        *   Muestra visualmente el `stripe_mandate_status` si ya existe (ej: un badge).

6.  **Backend: Función para Crear Sesión de Checkout para Setup (`supabase/functions/create-sepa-setup-session`):**
    *   **Objetivo:** Generar una sesión segura de Stripe para que el cliente introduzca su IBAN y acepte el mandato.
    *   **Acción:**
        *   Crea la Edge Function `create-sepa-setup-session`.
        *   Instala `stripe`.
        *   **Código (`index.ts`):**
            *   Recibirá el `supabase_customer_id` desde el frontend.
            *   Consultará la tabla `customers` para obtener el `stripe_customer_id` correspondiente.
            *   Llamará a `stripe.checkout.sessions.create({ ... })`:
                *   `mode: 'setup'` (¡Importante! No es un pago, es configuración).
                *   `payment_method_types: ['sepa_debit']`.
                *   `currency: 'eur'` (Requerido para SEPA).
                *   `customer`: El `stripe_customer_id` obtenido.
                *   `success_url`: Una URL en tu app que indique éxito (ej: `https://tuapp.com/customers/{id}/mandate-success`).
                *   `cancel_url`: Una URL para cancelación.
                *   `metadata`: `{ supabase_customer_id: supabase_customer_id }`.
            *   Devolverá el `id` de la sesión de Checkout al frontend.
        *   Despliega la función (`supabase functions deploy create-sepa-setup-session` - esta sí requerirá JWT si la llama un usuario logueado).

7.  **Frontend: Redirección a Stripe Checkout:**
    *   **Objetivo:** Enviar al usuario a la página de Stripe para completar la configuración del mandato.
    *   **Acción:**
        *   Instala `@stripe/stripe-js` en tu proyecto React (`npm install @stripe/stripe-js`).
        *   Carga Stripe.js con tu Clave Publicable.
        *   Cuando se hace clic en "Configurar Domiciliación SEPA":
            *   Llama a la Edge Function `create-sepa-setup-session`.
            *   Con el `sessionId` devuelto, llama a `stripe.redirectToCheckout({ sessionId })`.

8.  **Backend: Webhook para Confirmar Mandato (`supabase/functions/stripe-webhooks`):**
    *   **Objetivo:** Recibir notificación de Stripe cuando el mandato se configure correctamente.
    *   **Acción:**
        *   Crea (o reutiliza si ya existe) una Edge Function `stripe-webhooks`.
        *   Instala `stripe`.
        *   **Configuración Stripe:** Crea un Webhook Endpoint en el dashboard de Stripe apuntando a la URL de tu función `stripe-webhooks`.
        *   **Eventos a Escuchar:** Suscríbete al evento `checkout.session.completed`. *Opcional pero bueno:* `setup_intent.succeeded`, `setup_intent.setup_failed`, `mandate.updated`.
        *   **Código (`index.ts`):**
            *   **Verificación de Firma:** ¡Absolutamente esencial! Usa `stripe.webhooks.constructEvent` con el payload, la firma (`stripe-signature` header) y el *secreto del endpoint* del webhook (configúralo como secret en Supabase: `STRIPE_WEBHOOK_SECRET`).
            *   Procesa el evento `checkout.session.completed`:
                *   Verifica que `session.mode === 'setup'`.
                *   Obtén el `setup_intent` ID de la sesión: `session.setup_intent`.
                *   Recupera el SetupIntent completo: `stripe.setupIntents.retrieve(session.setup_intent, { expand: ['payment_method', 'mandate'] })`.
                *   Extrae el `payment_method.id` y el `mandate.status`.
                *   Extrae tu `supabase_customer_id` de `session.metadata`.
                *   Actualiza la tabla `customers`: guarda el `payment_method.id` en `stripe_payment_method_id` y el `mandate.status` en `stripe_mandate_status`.
            *   Responde a Stripe con un `200 OK` rápidamente.
        *   Despliega la función (`--no-verify-jwt`).

**Fase 3: Vinculación con Reservas y Cobro**

9.  **Modificación Base de Datos (Supabase - `bookings`):**
    *   **Objetivo:** Poder rastrear el estado de pago de cada reserva.
    *   **Acción:**
        *   Añadir columna `payment_status` (tipo `TEXT`, `DEFAULT 'pending'`) a la tabla `bookings`. Estados posibles: 'pending', 'paid_manual', 'processing_stripe', 'paid_stripe', 'failed_stripe'.
        *   Añadir columna `stripe_payment_intent_id` (tipo `TEXT`, `nullable`) para guardar la referencia del intento de cobro.
    *   **Cómo:** Crear y aplicar una nueva migración.

10. **Frontend: Acciones de Pago en la Reserva:**
    *   **Objetivo:** Permitir marcar como pagado manualmente o iniciar el cobro SEPA.
    *   **Acción:**
        *   En la vista de detalles de la reserva (podría ser una extensión del Paso 3 de `new-booking.tsx` o una pantalla separada):
            *   Mostrar el `payment_status` actual.
            *   Añadir botón "Marcar Pago Manual".
            *   Añadir botón "Cobrar por Domiciliación". Este botón sólo debe estar **activo si el cliente asociado tiene `stripe_mandate_status === 'active'`**.

11. **Backend: Función para Marcar Pago Manual (`supabase/functions/mark-booking-paid-manual`):**
    *   **Objetivo:** Actualizar el estado de la reserva para pagos manuales.
    *   **Acción:**
        *   Crea la Edge Function.
        *   Recibe el `booking_id`.
        *   Actualiza `public.bookings` estableciendo `payment_status = 'paid_manual'` para esa reserva.
        *   Despliega (`--verify-jwt` si la llama el usuario).

12. **Backend: Función para Iniciar Cobro SEPA (`supabase/functions/charge-sepa-booking`):**
    *   **Objetivo:** Crear y confirmar un `PaymentIntent` para cobrar la reserva usando el mandato SEPA.
    *   **Acción:**
        *   Crea la Edge Function. Instala `stripe`.
        *   **Código (`index.ts`):**
            *   Recibe el `booking_id`.
            *   Obtiene los detalles de la reserva (precio, depósito, etc.) y calcula el **importe a cobrar en céntimos**.
            *   Obtiene los datos del cliente asociado a la reserva (necesitas `stripe_customer_id` y `stripe_payment_method_id` de la tabla `customers`).
            *   **Verificación Crítica:** Comprueba que `customers.stripe_mandate_status === 'active'`. Si no, devuelve error.
            *   Llama a `stripe.paymentIntents.create({ ... })`:
                *   `amount`: El importe calculado en céntimos.
                *   `currency: 'eur'`.
                *   `customer`: `stripe_customer_id`.
                *   `payment_method`: `stripe_payment_method_id` (el ID del método SEPA guardado).
                *   `payment_method_types: ['sepa_debit']`.
                *   `confirm: true` (Intenta iniciar el cobro inmediatamente).
                *   `off_session: true` (Indica que el cobro lo inicia la empresa, no el cliente en ese momento).
                *   `metadata`: `{ supabase_booking_id: booking_id }`.
            *   Tras la llamada (exitosa o no), actualiza la tabla `bookings`: guarda el `id` del PaymentIntent en `stripe_payment_intent_id` y actualiza `payment_status` a `'processing_stripe'` (SEPA tarda días en confirmar).
            *   Devuelve una confirmación al frontend (ej: "Cobro iniciado").
        *   Despliega (`--verify-jwt`).

13. **Backend: Webhook para Estado del Pago (`stripe-webhooks`):**
    *   **Objetivo:** Actualizar el estado final del pago SEPA (éxito o fallo).
    *   **Acción:**
        *   Reutiliza la función `stripe-webhooks`.
        *   **Eventos a Escuchar:** Asegúrate de estar suscrito a `payment_intent.succeeded` y `payment_intent.payment_failed`.
        *   **Código (`index.ts`):**
            *   Dentro del manejador de webhooks (tras verificar firma):
                *   Procesa `payment_intent.succeeded`:
                    *   Extrae `supabase_booking_id` de `paymentIntent.metadata`.
                    *   Actualiza `public.bookings` estableciendo `payment_status = 'paid_stripe'` donde `id = supabase_booking_id`.
                *   Procesa `payment_intent.payment_failed`:
                    *   Extrae `supabase_booking_id`.
                    *   Actualiza `public.bookings` estableciendo `payment_status = 'failed_stripe'`.
                    *   Opcional: Guarda el motivo del fallo (`paymentIntent.last_payment_error.message`) en algún log o campo de notas.
            *   Responde `200 OK` a Stripe.

**Orden Sugerido:**

1.  **Fase 1:** DB, Config Stripe, Función y Trigger `create-stripe-customer`. Prueba crear clientes en tu app y verifica que se crean en Stripe y se guarda el ID.
2.  **Fase 2:** DB, UI Mandato, Función `create-sepa-setup-session`, Config Webhook, Lógica Webhook para `checkout.session.completed` (setup). Prueba el flujo completo de configurar domiciliación para un cliente. Verifica que el `payment_method_id` y `mandate_status` se guardan en Supabase.
3.  **Fase 3:** DB, UI Acciones Pago, Funciones `mark-booking-paid-manual` y `charge-sepa-booking`, Lógica Webhook para `payment_intent.succeeded/failed`. Prueba marcar pagos manualmente e iniciar cobros SEPA. Observa cómo cambia el `payment_status` y cómo se actualiza tras la notificación del webhook (puede tardar unos días para SEPA).

Este plan desglosado debería darte una ruta clara para implementar la domiciliación SEPA con Stripe en tu sistema actual. ¡Vamos con el primer paso cuando quieras!
