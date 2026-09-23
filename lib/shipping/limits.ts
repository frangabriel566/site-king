/**
 * Correios' floor for a parcel, and the floor Melhor Envio validates
 * against: anything smaller is rejected outright rather than rounded up.
 * A folded t-shirt is under 16cm on two sides, so this is not an edge
 * case — it is most of the catalogue.
 *
 * In its own module, free of `server-only`, because both sides need it:
 * the quote builder clamps to these numbers, and the admin form warns
 * the operator before they save something that will be billed at the
 * floor anyway.
 */
export const MIN_LENGTH_CM = 16;
export const MIN_WIDTH_CM = 11;
export const MIN_HEIGHT_CM = 2;
export const MIN_WEIGHT_KG = 0.3;
