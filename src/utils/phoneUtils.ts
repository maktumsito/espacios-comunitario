/**
 * Utilidades para formatear y generar enlaces de contacto telefónico y WhatsApp
 * optimizados para números de Chile (+56).
 */

export interface PhoneContactAction {
  raw: string;
  cleanDigits: string;
  chileanDigits: string;
  telHref: string;
  waHref: string;
  isValid: boolean;
}

/**
 * Procesa un string de teléfono y genera los esquemas de enlace reales:
 * - tel:+56... para llamadas directas
 * - https://wa.me/56... para mensajería por WhatsApp
 */
export function getPhoneContactActions(phone?: string | null): PhoneContactAction | null {
  if (!phone || typeof phone !== 'string') return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;

  const cleanDigits = trimmed.replace(/\D/g, '');
  if (!cleanDigits || cleanDigits.length < 7) return null;

  // Si ya contiene el código de país 56
  let chileanDigits = cleanDigits;
  if (cleanDigits.startsWith('56')) {
    chileanDigits = cleanDigits;
  } else {
    chileanDigits = `56${cleanDigits}`;
  }

  return {
    raw: trimmed,
    cleanDigits,
    chileanDigits,
    telHref: `tel:+${chileanDigits}`,
    waHref: `https://wa.me/${chileanDigits}`,
    isValid: true
  };
}
