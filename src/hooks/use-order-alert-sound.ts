import { useEffect, useRef, useCallback } from 'react';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useOrdersStore } from '@/store/useOrdersStore';

/**
 * Hook que gerencia o som de alerta para novos pedidos
 * Toca um som quando um novo pedido chega e continua tocando enquanto estiver pendente
 */
export const useOrderAlertSound = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const loopIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousOrderCountRef = useRef<number>(0);
  const previousOrderStatusRef = useRef<Map<string, string>>(new Map());

  const settings = useSettingsStore((s) => s.settings);
  const orders = useOrdersStore((s) => s.orders);

  // Função para gerar e tocar o som usando Web Audio API
  const playAlertSound = useCallback(() => {
    if (!settings.orderAlertEnabled) return;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const audioContext = audioContextRef.current;
      const now = audioContext.currentTime;
      const duration = 0.6; // 600ms total

      // Criar oscilador para som de campainha
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const lfo = audioContext.createOscillator(); // Low frequency oscillator para pulsação

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Frequência de campainha (aguda e metálica)
      oscillator.frequency.value = 1200;

      // LFO para criar efeito de vibração/pulsação (tipo campainha real)
      lfo.frequency.value = 7; // 7 pulsos por segundo
      const lfoGain = audioContext.createGain();
      lfo.connect(lfoGain);
      lfoGain.connect(oscillator.frequency);
      lfoGain.gain.value = 100; // Variação de frequência

      // Volume sobe rápido e desce lentamente (som de campainha)
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.8, now + 0.1); // Aumento rápido
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration); // Queda suave

      oscillator.start(now);
      oscillator.stop(now + duration);
      lfo.start(now);
      lfo.stop(now + duration);

      console.log('🔔 Som de campainha tocado');
    } catch (error) {
      console.error('❌ Erro ao tocar som:', error);
    }
  }, [settings.orderAlertEnabled]);

  // Monitorar novos pedidos e mudança de status
  useEffect(() => {
    if (!settings.orderAlertEnabled || !orders) {
      if (loopIntervalRef.current) {
        clearInterval(loopIntervalRef.current);
        loopIntervalRef.current = null;
      }
      previousOrderCountRef.current = orders ? orders.length : 0;
      return;
    }

    const currentOrderCount = orders ? orders.length : 0;

    // Verificar se há novos pedidos
    const hasNewOrder = currentOrderCount > previousOrderCountRef.current;

    if (hasNewOrder) {
      console.log('🔔 Novo pedido detectado! Tocando alerta...');
      playAlertSound();
    }

    // Verificar se algum pedido mudou de status para pendente
    if (orders) {
      orders.forEach((order) => {
        const previousStatus = previousOrderStatusRef.current.get(order.id);
        if (order.status === 'pending' && previousStatus !== 'pending') {
          console.log(`🔔 Pedido ${order.id} agora está pendente. Tocando alerta...`);
          playAlertSound();
        }
        previousOrderStatusRef.current.set(order.id, order.status);
      });
    }

    // Limpar pedidos que não existem mais
    const orderIds = new Set(orders ? orders.map((o) => o.id) : []);
    for (const [id] of previousOrderStatusRef.current) {
      if (!orderIds.has(id)) {
        previousOrderStatusRef.current.delete(id);
      }
    }

    previousOrderCountRef.current = currentOrderCount;

    // Verificar periodicamente se há pedidos pendentes para manter o loop
    if (loopIntervalRef.current) {
      clearInterval(loopIntervalRef.current);
    }

    loopIntervalRef.current = setInterval(() => {
      const hasPendingOrders = orders && orders.some((order) => order.status === 'pending');

      if (hasPendingOrders && settings.orderAlertEnabled) {
        console.log('🔔 Mantendo som de alerta para pedidos pendentes...');
        playAlertSound();
      }
    }, 8000); // Toca a cada 8 segundos se houver pedidos pendentes

    return () => {
      if (loopIntervalRef.current) {
        clearInterval(loopIntervalRef.current);
      }
    };
  }, [orders, settings.orderAlertEnabled, playAlertSound]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (loopIntervalRef.current) {
        clearInterval(loopIntervalRef.current);
      }
    };
  }, []);
};
