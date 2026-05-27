/**
 * Calcule o preço público com base no preço base e na taxa de serviço (comissão).
 * Retorna o preço arredondado a 2 casas decimais.
 */
export function calculatePublicPrice(basePrice: number, commissionPercentage: number = 10): number {
    const percentage = commissionPercentage || 10;
    const markup = 1 + (percentage / 100);
    const publicPrice = basePrice * markup;
    return Math.round(publicPrice * 100) / 100;
}

/**
 * Calcula o valor da comissão incluído num preço público.
 */
export function calculateCommissionAmount(publicPrice: number, commissionPercentage: number = 10): number {
    const percentage = commissionPercentage || 10;
    const basePrice = publicPrice / (1 + (percentage / 100));
    const commission = publicPrice - basePrice;
    return Math.round(commission * 100) / 100;
}
