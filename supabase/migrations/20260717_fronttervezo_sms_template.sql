-- Fronttervező: "Front beérkezés" SMS sablon (Beérkezett státusz)
-- Manuálisan futtatható a tenant DB-n.

INSERT INTO public.sms_settings (template_name, message_template)
VALUES (
  'Front beérkezés',
  'Kedves {customer_name}! A(z) {order_number} szamu front rendelese beerkezett es atveheto. Osszeg: {total_price}. Udvozlettel, {company_name}'
)
ON CONFLICT (template_name) DO NOTHING;

COMMENT ON TABLE public.sms_settings IS
  'SMS sablonok: Készre jelentés, Tárolás figyelmeztetés, Beszerzés, Front beérkezés';
