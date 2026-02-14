/**
 * Motor de cálculos para la Marquetería
 * Centraliza las reglas de negocio para costos de materiales y mano de obra.
 */

/**
 * 1. Calcular el costo del material basado en el área
 * @param {number} anchoCm - Ancho en centímetros
 * @param {number} largoCm - Largo en centímetros
 * @param {number} precioM2 - Precio de costo por metro cuadrado
 * @returns {number} Costo redondeado al entero más cercano
 */
const calcularCostoMaterial = (anchoCm, largoCm, precioM2) => {
    if (!anchoCm || !largoCm || !precioM2) return 0;
    
    // Lógica Excel: Calculamos el área en m2: (ancho * largo) / 10,000
    const areaM2 = (anchoCm * largoCm) / 10000;
    
    // Devolvemos el costo redondeado (Área * Precio de Costo M2)
    return Math.round(areaM2 * precioM2);
};

/**
 * 2. Tabla de Mano de Obra (Basada en rangos de medidas comerciales)
 * @param {number} ancho - Medida en cm
 * @param {number} largo - Medida en cm
 * @param {number} valorManual - Valor ingresado en el formulario (opcional)
 * @returns {number} Valor de la mano de obra sugerido o manual
 */
const calcularManoObra = (ancho, largo, valorManual = null) => {
    // Si el usuario ingresó un valor manual en el formulario, usamos ese
    if (valorManual !== null && valorManual > 0) {
        return parseFloat(valorManual);
    }

    // Si no hay valor manual, aplicamos tu tabla de rangos del Excel
    const mayor = Math.max(ancho, largo);
    const menor = Math.min(ancho, largo);

    // Rango 1: Hasta 40x50 cm
    if (mayor <= 50 && menor <= 40) {
        return 40000;
    }
    
    // Rango 2: Hasta 70x50 cm
    if (mayor <= 70 && menor <= 50) {
        return 50000;
    }
    
    // Rango 3: Hasta 100x70 cm (Rango estándar de cuadros medianos)
    if (mayor <= 100 && menor <= 70) {
        return 90000;
    }
    
    // Rango 4: Hasta 120x90 cm (Rango para obras grandes)
    if (mayor <= 120 && menor <= 90) {
        return 110000;
    }

    // Rango Especial: Medidas superiores a 120x90
    return 150000;
};

module.exports = {
    calcularCostoMaterial,
    calcularManoObra
};