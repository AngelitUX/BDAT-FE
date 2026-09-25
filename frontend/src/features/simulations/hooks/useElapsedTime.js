import { useState, useEffect } from 'react';

/**
 * Hook personalizado para calcular el tiempo transcurrido desde una fecha de inicio
 * @param {string} startDateTime - Fecha de inicio en formato ISO string
 * @param {boolean} isRunning - Si la simulación está en curso
 * @returns {string} Tiempo formateado (HH:MM:SS)
 */
export const useElapsedTime = (startDateTime, isRunning) => {
  const [elapsedTime, setElapsedTime] = useState(null);

  useEffect(() => {
    // Si no hay fecha de inicio o no está corriendo, no mostrar nada
    if (!startDateTime || !isRunning) {
      setElapsedTime(null);
      return;
    }

    const startTime = new Date(startDateTime);
    
    // Validar que la fecha sea válida
    if (isNaN(startTime.getTime())) {
      console.error('❌ Fecha de inicio inválida:', startDateTime);
      setElapsedTime(null);
      return;
    }
    
    const updateElapsedTime = () => {
      const now = new Date();
      const diffMs = now - startTime;
      
      // Si la diferencia es negativa (fecha futura), no mostrar
      if (diffMs < 0) {
        setElapsedTime(null);
        return;
      }

      // Calcular horas, minutos y segundos
      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      // Formato HH:MM:SS
      const formatted = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      setElapsedTime(formatted);
    };

    // Actualizar inmediatamente
    updateElapsedTime();

    // Actualizar cada segundo
    const interval = setInterval(updateElapsedTime, 1000);

    return () => clearInterval(interval);
  }, [startDateTime, isRunning]);

  return elapsedTime;
};

/**
 * Función utilitaria para formatear tiempo transcurrido entre dos fechas
 * @param {string} startDateTime - Fecha de inicio
 * @param {string} endDateTime - Fecha de fin
 * @returns {string} Tiempo formateado (HH:MM:SS)
 */
export const formatElapsedTime = (startDateTime, endDateTime) => {
  if (!startDateTime || !endDateTime) return null;

  const start = new Date(startDateTime);
  const end = new Date(endDateTime);
  
  // Validar fechas
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
  
  const diffMs = end - start;

  if (diffMs < 0) return null;

  // Calcular horas, minutos y segundos
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Formato HH:MM:SS
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};
