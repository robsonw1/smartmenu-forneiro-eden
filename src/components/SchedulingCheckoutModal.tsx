import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useUIStore, useCartStore, useCheckoutStore } from '@/store/useStore';
import { useNeighborhoodsStore } from '@/store/useNeighborhoodsStore';
import { useOrdersStore } from '@/store/useOrdersStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useLoyaltyStore } from '@/store/useLoyaltyStore';
import { useLoyaltySettingsStore } from '@/store/useLoyaltySettingsStore';
import { useCouponManagementStore } from '@/store/useCouponManagementStore';
import { useOrderCancellationSync } from '@/hooks/use-order-cancellation-sync';
import { useSchedulingCancellationSync } from '@/hooks/use-scheduling-availability';
import { useStoreStatusRealtime } from '@/hooks/use-store-status-realtime';
import { useSettingsRealtimeSync } from '@/hooks/use-settings-realtime-sync';
import { SchedulingSlotSelector } from './SchedulingSlotSelector';
import { supabase } from '@/integrations/supabase/client';
import { sendOrderSummaryToWhatsApp } from '@/lib/whatsapp-notification';
import { PostCheckoutLoyaltyModal } from './PostCheckoutLoyaltyModal';
import { 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Home, 
  Truck, 
  Store, 
  CreditCard, 
  QrCode,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Banknote,
  Copy,
  Check,
  AlertCircle,
  Gift,
  XCircle,
  Star,
  Clock,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

type Step = 'contact' | 'address' | 'delivery' | 'scheduling' | 'payment' | 'pix' | 'confirmation';

interface PixData {
  qrCode: string;
  qrCodeBase64: string;
  paymentId: string;
  expirationDate: string;
}

// 5-step flow: contact, delivery, address, scheduling, payment (WITH scheduling)
const getVisibleSteps = (deliveryType: string): Step[] => {
  let steps: Step[] = ['contact', 'delivery', 'address', 'scheduling', 'payment'];
  if (deliveryType === 'pickup') {
    steps = ['contact', 'delivery', 'scheduling', 'payment'];
  }
  return steps;
};

export function SchedulingCheckoutModal() {
  const { isSchedulingCheckoutOpen, setSchedulingCheckoutOpen, setCartOpen } = useUIStore();
  const { items, getSubtotal, clearCart } = useCartStore();
  const {
    customer,
    address,
    deliveryType,
    paymentMethod,
    observations,
    selectedNeighborhood,
    needsChange,
    changeAmount,
    saveAsDefault,
    pointsToRedeem,
    scheduledDate,
    scheduledTime,
    setCustomer,
    setAddress,
    setDeliveryType,
    setPaymentMethod,
    setObservations,
    setSelectedNeighborhood,
    setNeedsChange,
    setChangeAmount,
    setSaveAsDefault,
    setPointsToRedeem,
    setScheduledDate,
    setScheduledTime,
    calculatePointsDiscount,
    getDeliveryFee,
    reset,
  } = useCheckoutStore();

  const neighborhoods = useNeighborhoodsStore((s) => s.neighborhoods);
  const activeNeighborhoods = neighborhoods.filter(n => n.isActive);
  const addOrder = useOrdersStore((s) => s.addOrder);
  const settings = useSettingsStore((s) => s.settings);
  const isStoreOpen = useSettingsStore((s) => s.isStoreOpen);

  const [step, setStep] = useState<Step>('contact');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLoyaltyModalOpen, setIsLoyaltyModalOpen] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<string>('');
  const [lastOrderEmail, setLastOrderEmail] = useState<string>('');
  const [lastOrderPayload, setLastOrderPayload] = useState<any>(null);
  const [lastLoyaltyCustomer, setLastLoyaltyCustomer] = useState<any>(null);
  const [lastPointsEarned, setLastPointsEarned] = useState<number>(0);
  const [lastPointsDiscount, setLastPointsDiscount] = useState<number>(0);
  const [lastPointsRedeemed, setLastPointsRedeemed] = useState<number>(0);
  const [lastFinalTotal, setLastFinalTotal] = useState<number>(0);
  const [lastAppliedCoupon, setLastAppliedCoupon] = useState<string>('');
  const [lastCouponDiscount, setLastCouponDiscount] = useState<number>(0);
  const [couponCode, setCouponCode] = useState<string>('');
  const [couponDiscount, setCouponDiscount] = useState<number>(0);
  const [appliedCoupon, setAppliedCoupon] = useState<string>('');
  const [couponValidationMessage, setCouponValidationMessage] = useState<string>('');
  const [tenantId, setTenantId] = useState<string>('');
  const [storeOpen, setStoreOpen] = useState<boolean>(false);

  const validateAndUseCoupon = useCouponManagementStore((s) => s.validateAndUseCoupon);
  const markCouponAsUsed = useCouponManagementStore((s) => s.markCouponAsUsed);
  const findOrCreateCustomer = useLoyaltyStore((s) => s.findOrCreateCustomer);
  const addPointsFromPurchase = useLoyaltyStore((s) => s.addPointsFromPurchase);
  const refreshCurrentCustomer = useLoyaltyStore((s) => s.refreshCurrentCustomer);
  const saveDefaultAddress = useLoyaltyStore((s) => s.saveDefaultAddress);
  const redeemPoints = useLoyaltyStore((s) => s.redeemPoints);
  const currentCustomer = useLoyaltyStore((s) => s.currentCustomer);
  const isRemembered = useLoyaltyStore((s) => s.isRemembered);

  // 🔴 REALTIME: Cancelamentos de pedidos
  useOrderCancellationSync(
    isSchedulingCheckoutOpen,
    customer?.email,
    refreshCurrentCustomer
  );

  // 🔴 REALTIME: Liberar slot quando pedido agendado é cancelado
  useSchedulingCancellationSync(
    isSchedulingCheckoutOpen,
    customer?.email,
    tenantId
  );

  // ⚡ REALTIME: Monitorar status da loja em tempo real (abrir/fechar + horários)
  useStoreStatusRealtime(isSchedulingCheckoutOpen);

  // ⚡ REALTIME: Sincronizar configurações do admin em tempo real (schedule, horários, etc)
  useSettingsRealtimeSync();

  // ⏰ REATIVO ROBUSTO: Recalcular storeOpen quando settings mudam + intervalo de 5s
  useEffect(() => {
    // Função para recalcular status
    const recalculateStoreOpen = () => {
      const newStoreStatus = isStoreOpen();
      setStoreOpen(newStoreStatus);
      console.log('🔄 [SCHEDULING-CHECKOUT] storeOpen recalculado:', newStoreStatus, 'Horário:', {
        hora: new Date().toLocaleTimeString('pt-BR'),
        dia: new Date().toLocaleDateString('pt-BR', { weekday: 'long' }),
        isManuallyOpen: settings.isManuallyOpen,
      });
    };

    // 1️⃣ Recalcular imediatamente quando checkout abre
    recalculateStoreOpen();

    // 2️⃣ Se inscrever nas mudanças de settings via Zustand
    const unsubscribe = useSettingsStore.subscribe(
      () => recalculateStoreOpen()
    );

    // 3️⃣ Verificar a cada 5 segundos (MUITO MAIS RÁPIDO - cliente pega mudanças quase imediatamente)
    const interval = setInterval(() => {
      recalculateStoreOpen();
    }, 5000); // 5 segundos

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [isSchedulingCheckoutOpen]); // Só depende de isSchedulingCheckoutOpen

  // ✅ Função para formatar telefone
  const formatPhoneNumber = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.length === 0) return '';
    if (cleaned.length <= 2) return `(${cleaned}`;
    if (cleaned.length <= 7) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
    
    // 10 dígitos: (XX) XXXX-XXXX
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    }
    
    // 11 dígitos: (XX) XXXXX-XXXX
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7, 11)}`;
  };

  // ✅ CRÍTICO: Buscar tenant_id na primeira montagem do componente
  useEffect(() => {
    const fetchTenantId = async () => {
      try {
        // 1️⃣ Tentar obter do localStorage (se estiver logado como admin)
        const storedId = localStorage.getItem('admin-tenant-id');
        if (storedId) {
          setTenantId(storedId);
          console.log('✅ [CHECKOUT] Tenant ID do localStorage:', storedId);
          return;
        }

        // 2️⃣ Fallback: Buscar primeiro tenant padrão
        const { data: tenants, error } = await (supabase as any)
          .from('tenants')
          .select('id')
          .limit(1);

        if (error) {
          console.error('❌ [CHECKOUT] Erro ao buscar tenants:', error);
          return;
        }

        if (tenants && tenants.length > 0) {
          const defaultTenant = tenants[0].id;
          setTenantId(defaultTenant);
          localStorage.setItem('default-tenant-id', defaultTenant);
          console.log('✅ [CHECKOUT] Usando Tenant padrão:', defaultTenant);
        } else {
          console.error('❌ [CHECKOUT] CRÍTICO: Nenhum tenant encontrado no banco!');
        }
      } catch (err) {
        console.error('❌ [CHECKOUT] Erro ao obter tenant_id:', err);
      }
    };

    fetchTenantId();
  }, []);

  // Pré-preencher dados de contato quando cliente logado abre checkout
  useEffect(() => {
    if (isSchedulingCheckoutOpen && currentCustomer && isRemembered) {
      if (currentCustomer.name && !customer.name) {
        setCustomer({ name: currentCustomer.name });
      }
      if (currentCustomer.phone && !customer.phone) {
        // ✅ Pré-preencher telefone já formatado
        setCustomer({ phone: formatPhoneNumber(currentCustomer.phone) });
      }
      // 🔑 CRÍTICO: Pré-preencher email do cliente autenticado
      if (currentCustomer.email && !customer.email) {
        setCustomer({ email: currentCustomer.email });
        console.log('📧 Email preenchido automaticamente:', currentCustomer.email);
      }
    }
  }, [isSchedulingCheckoutOpen, currentCustomer?.name, currentCustomer?.phone, currentCustomer?.email, isRemembered]);

  // Pré-preencher endereço salvo quando checkout abre
  useEffect(() => {
    if (isSchedulingCheckoutOpen && currentCustomer?.street && !address.street) {
      setAddress({
        street: currentCustomer.street,
        number: currentCustomer.number || '',
        complement: currentCustomer.complement || '',
        reference: '',
        city: currentCustomer.city || '',
        zipCode: currentCustomer.zipCode || '',
      });

      // Pre-select neighborhood
      if (currentCustomer.neighborhood) {
        const matchingNeighborhood = activeNeighborhoods.find(
          (n) => n.name === currentCustomer.neighborhood
        );
        if (matchingNeighborhood) {
          setSelectedNeighborhood(matchingNeighborhood);
        }
      }

      // Se tem endereço padrão, marca como salvo
      if (currentCustomer.street) {
        setSaveAsDefault(true);
      }
    }
  }, [isSchedulingCheckoutOpen, currentCustomer?.street]);

  // Resetar pontos a resgatar APENAS quando checkout fecha
  useEffect(() => {
    if (!isSchedulingCheckoutOpen && step !== 'contact') {
      setPointsToRedeem(0);
    }
  }, [isSchedulingCheckoutOpen, step]);

  // ✅ FORCE SETTINGS REFRESH: Usar Zustand subscribe para detectar mudanças
  // ✅ FORCE SETTINGS REFRESH: Re-fetch settings do Supabase quando checkout abre
  useEffect(() => {
    if (!isSchedulingCheckoutOpen) return;

    const refreshSettingsFromSupabase = async () => {
      try {
        const { data: settingsData } = await supabase
          .from('settings')
          .select('*')
          .eq('id', 'store-settings')
          .single();
        
        if (settingsData) {
          const valueData = (settingsData as any).value || {};
          console.log('🔄 [CHECKOUT] Settings re-sincronizados do Supabase:', {
            sendOrderSummaryToWhatsApp: valueData.sendOrderSummaryToWhatsApp,
            phone: valueData.phone,
          });
          
          // Atualizar o store se houver mudanças
          const settingsStore = useSettingsStore.getState();
          settingsStore.updateSettings({
            sendOrderSummaryToWhatsApp: valueData.sendOrderSummaryToWhatsApp !== undefined ? valueData.sendOrderSummaryToWhatsApp : false,
            phone: valueData.phone || settings.phone,
          });
        }
      } catch (error) {
        console.error('⚠️ [CHECKOUT] Erro ao re-sincronizar settings:', error);
      }
    };

    refreshSettingsFromSupabase();

    const handleStorageUpdate = () => {
      console.log('📢 [CHECKOUT] localStorage.settings-updated detectado');
      console.log('📢 [CHECKOUT] Settings atuais:', {
        sendOrderSummaryToWhatsApp: settings.sendOrderSummaryToWhatsApp,
        phone: settings.phone,
      });
    };

    window.addEventListener('storage', (e) => {
      if (e.key === 'settings-updated') {
        handleStorageUpdate();
      }
    });

    return () => {
      window.removeEventListener('storage', handleStorageUpdate);
    };
  }, [isSchedulingCheckoutOpen]);

  // 🔴 REALTIME: Sincronizar pontos do cliente em tempo real
  // Detecta quando outro navegador/aba usa os mesmos pontos (previne fraude)
  useEffect(() => {
    if (!isSchedulingCheckoutOpen || !currentCustomer?.id) return;

    console.log('🔴 Setting up Realtime points sync for customer:', currentCustomer.id);

    const channel = supabase.channel(`customer-points-${currentCustomer.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'customers',
          filter: `id=eq.${currentCustomer.id}`
        },
        (payload: any) => {
          const updatedCustomer = payload.new;
          console.log('🔄 Pontos sincronizados em tempo real:', {
            totalPoints: updatedCustomer.total_points,
            timestamp: new Date().toISOString()
          });

          // Refrescar dados do cliente na store de lealdade
          refreshCurrentCustomer();

          // Se cliente tinha selecionado usar pontos e eles foram reduzidos, alertar
          if (pointsToRedeem > 0 && updatedCustomer.total_points < currentCustomer.totalPoints) {
            toast.warning(
              `⚠️ Seus pontos foram atualizados! Disponíveis agora: ${updatedCustomer.total_points}`,
              { duration: 5000 }
            );
            
            // Se o cliente usou todos os pontos em outra aba, resetar
            if (updatedCustomer.total_points < pointsToRedeem) {
              setPointsToRedeem(0);
              toast.info('Pontos resgastados foram zerados devido à atualização');
            }
          }
        }
      )
      .subscribe((status: any) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime subscription ativo para pontos do cliente');
        }
      });

    return () => {
      console.log('🔴 Unsubscribing from realtime points sync');
      supabase.removeChannel(channel);
    };
  }, [isSchedulingCheckoutOpen, currentCustomer?.id, pointsToRedeem, currentCustomer?.totalPoints]);

  // � Calcular valores (ANTES dos useEffects que os usam)
  const subtotal = getSubtotal();
  const deliveryFee = getDeliveryFee();
  const total = subtotal + deliveryFee;

  // �🔄 REALTIME: Escutar confirmação automática do pagamento PIX
  useEffect(() => {
    if (step !== 'pix' || !lastOrderId) return;

    console.log('🔄 Listening for PIX confirmation via Realtime:', lastOrderId);
    const currentTotal = subtotal + deliveryFee;

    // Subscrever para mudanças na ordem
    const subscription = supabase
      .from('orders')
      // @ts-ignore - Supabase Realtime type compatibility
      .on('*', async (payload: any) => {
        console.log('📡 Realtime update received:', payload);

        if (payload.new?.id === lastOrderId && payload.new?.status === 'confirmed') {
          console.log('✅ Payment confirmed automatically via webhook!');
          
          // Atualizar state com informações do pedido criado
          const finalTotal = payload.new?.totals?.total || currentTotal;
          const pointsRedeemed = payload.new?.totals?.pointsRedeemed || 0;
          const appliedCoupon = payload.new?.totals?.appliedCoupon || null;
          
          setLastFinalTotal(finalTotal);
          if (payload.new?.totals?.pointsDiscount) {
            setLastPointsDiscount(payload.new.totals.pointsDiscount);
          }
          if (pointsRedeemed) {
            setLastPointsRedeemed(pointsRedeemed);
          }
          if (payload.new?.totals?.couponDiscount) {
            setLastCouponDiscount(payload.new.totals.couponDiscount);
          }
          if (appliedCoupon) {
            setLastAppliedCoupon(appliedCoupon);
          }

          // 💰 Processar pontos IMEDIATAMENTE após confirmação automática
          console.log('🔄 Disparando processamento de pontos no fluxo automático...');
          await processPointsAndCoupons(pointsRedeemed, finalTotal, appliedCoupon);

          // Mostrar confirmação automaticamente
          toast.success('✅ Pedido confirmado com sucesso!');
          setStep('confirmation');
          setTimeout(() => setIsLoyaltyModalOpen(true), 500);

          // Unsubscribe
          subscription.unsubscribe();
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [step, lastOrderId, subtotal, deliveryFee]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponValidationMessage('❌ Digite o código do cupom');
      return;
    }

    if (!isRemembered) {
      setCouponValidationMessage('❌ Apenas clientes registrados podem usar cupons');
      return;
    }

    const result = await validateAndUseCoupon(couponCode.toUpperCase(), currentCustomer?.id);
    
    if (result.valid) {
      setAppliedCoupon(couponCode.toUpperCase());
      setCouponDiscount(result.discount);
      setCouponValidationMessage(`✅ ${result.message}`);
      toast.success(result.message);
    } else {
      setCouponDiscount(0);
      setAppliedCoupon('');
      setCouponValidationMessage(result.message);
      toast.error(result.message);
    }
  };

  const handleRemoveCoupon = () => {
    setCouponCode('');
    setAppliedCoupon('');
    setCouponDiscount(0);
    setCouponValidationMessage('');
  };

  const formatCpf = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    let formatted = cleaned;
    if (cleaned.length > 3) formatted = `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
    if (cleaned.length > 6) formatted = `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
    if (cleaned.length > 9) formatted = `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9, 11)}`;
    return formatted;
  };

  const handleCpfInput = (value: string) => {
    setCustomer({ cpf: formatCpf(value) });
  };

  const validateStep = (currentStep: Step): boolean => {
    switch (currentStep) {
      case 'contact':
        if (!customer.name.trim()) {
          toast.error('Por favor, informe seu nome');
          return false;
        }
        if (!customer.phone.trim() || customer.phone.length < 14) {
          toast.error('Por favor, informe um telefone válido');
          return false;
        }
        // ✅ Validar email - obrigatório para confirmar pagamento e atualizar pontos
        if (!customer.email || !customer.email.trim()) {
          toast.error('Por favor, informe seu email');
          return false;
        }
        // Validar formato do email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(customer.email)) {
          toast.error('Por favor, informe um email válido');
          return false;
        }
        return true;
      case 'delivery':
        // Always valid - customer just needs to choose
        return true;
      case 'address':
        // Skip validation if pickup
        if (deliveryType === 'pickup') return true;
        // Validate address fields only for delivery
        if (!address.street || !address.number || !selectedNeighborhood) {
          toast.error('Por favor, preencha o endereço completo');
          return false;
        }
        return true;
      case 'scheduling':
        // REQUIRED: scheduling must have date and time
        if (!scheduledDate || !scheduledTime) {
          toast.error('Por favor, selecione a data e hora do agendamento');
          return false;
        }
        
        // ✅ VALIDAÇÃO CRITICAL: Verificar se a data está dentro do intervalo permitido
        const maxDaysAllowed = settings.maxScheduleDays ?? 7;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const selectedDateObj = new Date(`${scheduledDate}T00:00`);
        const daysDifference = Math.floor((selectedDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDifference < 0) {
          toast.error('Não é possível agendar para datas no passado');
          return false;
        }
        
        if (daysDifference > maxDaysAllowed) {
          toast.error(`Você só pode agendar com até ${maxDaysAllowed} dia${maxDaysAllowed !== 1 ? 's' : ''} de antecedência`);
          return false;
        }
        
        return true;
      case 'payment':
        // CPF é obrigatório APENAS para PIX
        if (paymentMethod === 'pix') {
          if (!customer.cpf || customer.cpf.replace(/\D/g, '').length !== 11) {
            toast.error('Por favor, informe um CPF válido para PIX');
            return false;
          }
        }
        if (paymentMethod === 'cash' && needsChange && !changeAmount) {
          toast.error('Por favor, informe o valor para troco');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const nextStep = () => {
    // 🔒 BLOQUEIO: Horários configurados no admin SEMPRE são respeitados
    if (!storeOpen) {
      toast.error('⏰ Estabelecimento fora do horário de funcionamento. Agendamentos não permitidos.');
      return;
    }
    
    const steps = getVisibleSteps(deliveryType);
    const currentIndex = steps.indexOf(step as any);
    if (!validateStep(step)) return;
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    }
  };

  const prevStep = () => {
    const steps = getVisibleSteps(deliveryType);
    const currentIndex = steps.indexOf(step as any);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };

  const handlePhoneInput = (value: string) => {
    const formatted = formatPhoneNumber(value);
    setCustomer({ phone: formatted });
  };

  const copyPixCode = async () => {
    if (pixData?.qrCode) {
      await navigator.clipboard.writeText(pixData.qrCode);
      setCopied(true);
      toast.success('Código PIX copiado!');
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const buildOrderPayload = (orderId: string) => {
    const paymentMethodMap = {
      pix: 'pix',
      card: 'cartao_maquina',
      cash: 'dinheiro'
    };

    // Build simplified items array
    const formattedItems = items.map(item => {
      const isPizza = ['promocionais', 'tradicionais', 'premium', 'especiais', 'doces'].includes(item.product.category);
      const isCombo = item.product.category === 'combos';

      // Build item_data JSON with complete information
      const itemData = {
        pizzaType: isPizza ? (item.isHalfHalf ? 'meia-meia' : 'inteira') : undefined,
        sabor1: isPizza ? item.product.name : undefined,
        sabor2: isPizza && item.isHalfHalf ? item.secondHalf?.name : undefined,
        borda: item.border?.name || 'Sem borda',
        extras: item.extras?.map(e => e.name) || [],
        drink: item.drink?.name || 'Sem bebida',
        customIngredients: item.customIngredients || null,
        comboPizzas: isCombo ? (
          // Usar comboPizzasData se disponível (dados explícitos)
          item.comboPizzasData?.map((pizzaData) => {
            const comboPizza = {
              pizzaNumber: pizzaData.pizzaNumber,
              type: pizzaData.isHalfHalf ? 'meia-meia' : 'inteira',
              sabor1: pizzaData.pizzaName,
              sabor2: pizzaData.isHalfHalf ? pizzaData.secondHalfName : undefined,
            };
            console.log(`📦 [CheckoutModal] Salvando Pizza ${pizzaData.pizzaNumber} (from data):`, comboPizza);
            return comboPizza;
          }) || 
          // Fallback para comboPizzaFlavors (compatibilidade com dados antigos)
          item.comboPizzaFlavors?.map((pizza: any, index: number) => {
            const comboPizza = {
              pizzaNumber: index + 1,
              type: pizza.isHalfHalf ? 'meia-meia' : 'inteira',
              sabor1: pizza.name,
              sabor2: pizza.isHalfHalf ? pizza.secondHalf?.name : undefined,
            };
            console.log(`📦 [CheckoutModal] Salvando Pizza ${index + 1} (from flavors):`, {
              pizzaObj: pizza,
              isHalfHalf: pizza.isHalfHalf,
              savedCombo: comboPizza,
            });
            return comboPizza;
          })
        ) : undefined,
      };

      return {
        order_id: null, // Will be set by backend
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        size: item.size || 'padrão',
        total_price: item.totalPrice,
        item_data: itemData,
        created_at: new Date().toISOString(),
      };
    });

    return {
      orderId,
      timestamp: new Date().toISOString(),
      
      // Customer info
      customer: {
        name: customer.name,
        phone: customer.phone,
        phoneClean: customer.phone.replace(/\D/g, ''),
        cpf: customer.cpf,
      },
      
      // Delivery info
      delivery: {
        type: deliveryType === 'delivery' ? 'ENTREGA' : 'RETIRADA',
        fee: deliveryFee,
        estimatedTime: deliveryType === 'delivery' 
          ? `${settings.deliveryTimeMin}-${settings.deliveryTimeMax} min`
          : `${settings.pickupTimeMin}-${settings.pickupTimeMax} min`,
        isScheduled: true,
        scheduledFor: scheduledDate && scheduledTime ? `${scheduledDate}T${scheduledTime}` : undefined,
        ...(deliveryType === 'delivery' && {
          address: {
            street: address.street,
            number: address.number,
            complement: address.complement || '',
            neighborhood: selectedNeighborhood?.name || address.neighborhood,
            city: address.city || 'São Paulo',
            state: 'SP',
            zipcode: address.zipCode,
            reference: address.reference || '',
          },
        }),
      },
      
      // Payment info
      payment: {
        method: paymentMethodMap[paymentMethod],
        methodLabel: paymentMethod === 'pix' ? 'PIX' : paymentMethod === 'card' ? 'Cartão' : 'Dinheiro',
        status: paymentMethod === 'pix' ? 'aguardando_pagamento' : 'pendente',
        needsChange: paymentMethod === 'cash' ? needsChange : false,
        changeFor: paymentMethod === 'cash' && needsChange ? parseFloat(changeAmount) || 0 : null,
      },
      
      // Items
      items: formattedItems,
      
      // Totals
      totals: {
        subtotal,
        deliveryFee,
        total,
        itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
        pointsDiscount: 0,
        pointsRedeemed: 0,
        couponDiscount: 0,
        appliedCoupon: '',
      },
      couponDiscount: 0,
      appliedCoupon: undefined,
      
      // Observations
      observations: observations || '',
    };
  };

  const processOrder = async (orderPayload: any, pointsDiscount: number = 0, pointsRedeemed: number = 0) => {
    console.log('Processando pedido...', { pointsDiscount, pointsRedeemed });
    
    // Determinar se deve auto-imprimir baseado em modo e método de pagamento
    let shouldAutoPrint = false;
    
    // SÓ usar auto-print se o modo for "auto" (não "manual")
    if (settings.print_mode === 'auto') {
      if (paymentMethod === 'pix' && settings.auto_print_pix) {
        shouldAutoPrint = true;
      } else if (paymentMethod === 'card' && settings.auto_print_card) {
        shouldAutoPrint = true;
      } else if (paymentMethod === 'cash' && settings.auto_print_cash) {
        shouldAutoPrint = true;
      }
    }
    
    if (shouldAutoPrint) {
      console.log('Auto-print habilitado para:', paymentMethod);
    } else {
      console.log('Auto-print desabilitado para:', paymentMethod);
    }
    
    // 🔒 CRÍTICO: Marcar cupom como usado ANTES de criar pedido (transação atômica)
    if (orderPayload.totals.appliedCoupon) {
      try {
        await markCouponAsUsed(orderPayload.totals.appliedCoupon, currentCustomer?.id);
        console.log('✅ Cupom marcado como usado na criação do pedido');
      } catch (error) {
        // Se cupom falhar, ainda registra o pedido mas avisa
        console.warn('⚠️ Falha ao marcar cupom, mas pedido será criado:', error);
      }
    }
    
    // Add order to local store for admin panel
    // (addOrder function handles auto-print with retry logic based on shouldAutoPrint parameter)
    console.log('[CHECKOUT] 🚀 Criando pedido com dados do cliente:', {
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      total: orderPayload.totals.total,
      pointsRedeemed: pointsRedeemed
    });

    const createdOrder = await addOrder({
      customer: {
        name: customer.name,
        phone: customer.phone,
        email: customer.email, // ✅ CRÍTICO: Incluir email do cliente
      },
      address: {
        city: address.city || 'São Paulo',
        neighborhood: selectedNeighborhood?.name || address.neighborhood,
        street: address.street,
        number: address.number,
        complement: address.complement,
        reference: address.reference,
      },
      deliveryType,
      deliveryFee,
      paymentMethod,
      items,
      subtotal,
      total: orderPayload.totals.total, // Use final total from payload
      pointsDiscount: pointsDiscount,
      pointsRedeemed: pointsRedeemed,
      couponDiscount: orderPayload.totals.couponDiscount,
      appliedCoupon: orderPayload.totals.appliedCoupon,
      status: 'pending',
      observations,
      needsChange: paymentMethod === 'cash' ? needsChange : false,
      changeAmount: paymentMethod === 'cash' && needsChange ? changeAmount : undefined,
      isScheduled: true,
      scheduledFor: scheduledDate && scheduledTime ? `${scheduledDate}T${scheduledTime}` : undefined,
      tenantId: tenantId || '', // ✅ CRÍTICO: Sempre enviar (vazio ou não - useOrdersStore trata fallback)
    }, shouldAutoPrint);
    
    console.log('✅ [CHECKOUT] Pedido criado com ID:', createdOrder.id, 'Tenant:', tenantId || 'será auto-detectado');

    // � Enviar resumo para WhatsApp do gerente (se habilitado nas configurações)
    if (settings.sendOrderSummaryToWhatsApp && settings.phone) {
      try {
        // Formatar número do pedido
        const orderNo = createdOrder.id || `PED-${Date.now()}`;
        
        // CRÍTICO: Usar settings fresco do store
        const storeSettings = useSettingsStore.getState().settings;
        console.log('🔍 [CHECKOUT] Verificando resumo WhatsApp (store atual):', {
          sendOrderSummaryToWhatsApp: storeSettings.sendOrderSummaryToWhatsApp,
          phone: storeSettings.phone,
          shouldSend: storeSettings.sendOrderSummaryToWhatsApp && storeSettings.phone,
        });
        
        // Se a flag foi desativada no meio do processo, não enviar
        if (!storeSettings.sendOrderSummaryToWhatsApp) {
          console.log('⏸️ [CHECKOUT] Resumo WhatsApp cancelado - flag desativada');
          return;
        }
        
        // Mapear items com detalhes completos
        const itemsWithDetails = items.map((item) => {
          const details: string[] = [];
          
          console.log('📋 [CheckoutModal] Item processing:', {
            productName: item.product.name,
            hasComboPizzasData: !!item.comboPizzasData,
            hasComboPizzaFlavors: !!item.comboPizzaFlavors,
            comboPizzasData: item.comboPizzasData,
            comboPizzaFlavors: item.comboPizzaFlavors,
          });
          
          // Usar comboPizzasData se disponível (dados explícitos mais confiáveis)
          if (item.comboPizzasData && item.comboPizzasData.length > 0) {
            item.comboPizzasData.forEach((pizzaData) => {
              console.log(`🍕 [CheckoutModal] Pizza ${pizzaData.pizzaNumber} (from data):`, pizzaData);
              
              const pizzaLabel = pizzaData.isHalfHalf
                ? `Pizza ${pizzaData.pizzaNumber} (Meia Meia): ${pizzaData.pizzaName} / ${pizzaData.secondHalfName || 'N/A'}`
                : `Pizza ${pizzaData.pizzaNumber}: ${pizzaData.pizzaName}`;
              details.push(pizzaLabel);
            });
          }
          // Fallback para comboPizzaFlavors (compatibilidade com dados antigos)
          else if (item.comboPizzaFlavors && item.comboPizzaFlavors.length > 0) {
            item.comboPizzaFlavors.forEach((pizza, index) => {
              // Verificar se é meia-meia
              const isHalfHalf = (pizza as any).isHalfHalf;
              const secondHalfName = (pizza as any).secondHalf?.name;
              console.log(`🍕 [CheckoutModal] Pizza ${index + 1} (from flavors):`, {
                pizzaName: pizza.name,
                isHalfHalf,
                secondHalfName,
                fullPizzaObject: pizza,
              });
              
              const pizzaLabel = isHalfHalf
                ? `Pizza ${index + 1} (Meia Meia): ${pizza.name} / ${secondHalfName || 'N/A'}`
                : `Pizza ${index + 1}: ${pizza.name}`;
              details.push(pizzaLabel);
            });
          }
          // Detalhes de pizza simples (não combo) - verifica se é meia-meia
          else if ((item as any).isHalfHalf) {
            details.push(`Pizza (Meia Meia): ${item.product.name} / ${(item as any).secondHalf?.name || 'N/A'}`);
          }
          
          // Tamanho
          if (item.size) {
            details.push(`Tamanho: ${item.size === 'broto' ? 'Broto' : 'Grande'}`);
          }
          
          // Borda
          if (item.border) {
            details.push(`Borda: ${item.border.name}`);
          }
          
          // Bebida
          if (item.drink) {
            details.push(`Bebida: ${item.drink.name}${item.isDrinkFree ? ' (grátis)' : ''}`);
          }
          
          // Adicionais
          if (item.extras && item.extras.length > 0) {
            item.extras.forEach(extra => {
              details.push(`Adicional: ${extra.name}`);
            });
          }
          
          // Ingredientes customizados (Moda do Cliente)
          if (item.customIngredients && item.customIngredients.length > 0) {
            details.push(`Ingredientes grátis: ${item.customIngredients.join(', ')}`);
          }
          
          if (item.paidIngredients && item.paidIngredients.length > 0) {
            details.push(`Ingredientes extras: ${item.paidIngredients.join(', ')}`);
          }
          
          // Observações do item
          if (item.notes) {
            details.push(`Obs: ${item.notes}`);
          }
          
          return {
            name: item.product.name,
            quantity: item.quantity,
            price: item.product.price || 0,
            size: item.size,
            details: details.length > 0 ? details : undefined,
          };
        });
        
        console.log('✅ [CHECKOUT] Enviando resumo WhatsApp - flag ativo:', storeSettings.sendOrderSummaryToWhatsApp);
        console.log('📋 [WHATSAPP] Items com detalhes:', JSON.stringify(itemsWithDetails, null, 2));
        console.log('📱 [WHATSAPP] Enviando para telefone do gerente:', storeSettings.phone);
        console.log('� [DEBUG-CRUCIAL] Valores ANTES de chamar sendOrderSummaryToWhatsApp:');
        console.log('  - paymentMethod:', paymentMethod, 'tipo:', typeof paymentMethod);
        console.log('  - needsChange:', needsChange, 'tipo:', typeof needsChange);
        console.log('  - changeAmount:', changeAmount, 'tipo:', typeof changeAmount);
        console.log('  - observations:', observations, 'tipo:', typeof observations);
        console.log('  - address.reference:', address.reference, 'tipo:', typeof address.reference);
        console.log('  - deliveryType:', deliveryType);
        console.log('  - selectedNeighborhood:', selectedNeighborhood?.name);
        
        // Enviar resumo formatado
        // ⚠️ USAR O PAGAMENTO DO OBJETO CRIADO, NÃO DA VARIÁVEL LOCAL
        const paymentMethodToSend = createdOrder.paymentMethod || paymentMethod || 'pix';
        console.log('[MEGA-LOG] paymentMethod do state:', paymentMethod);
        console.log('[MEGA-LOG] createdOrder.paymentMethod:', createdOrder.paymentMethod);
        console.log('[MEGA-LOG] paymentMethodToSend final:', paymentMethodToSend);
        
        await sendOrderSummaryToWhatsApp({
          orderId: createdOrder.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          customerEmail: customer.email,
          items: itemsWithDetails,
          subtotal,
          pointsDiscount: pointsDiscount || 0,
          couponDiscount: orderPayload.totals.couponDiscount || 0,
          appliedCoupon: orderPayload.totals.appliedCoupon,
          deliveryFee: deliveryType === 'pickup' ? 0 : deliveryFee,
          total: orderPayload.totals.total,
          deliveryType,
          address: deliveryType === 'delivery' ? {
            street: address.street,
            number: address.number,
            neighborhood: selectedNeighborhood?.name || '',
            complement: address.complement,
            reference: address.reference,
          } : undefined,
          observations,
          paymentMethod: paymentMethodToSend,
          needsChange: paymentMethodToSend === 'cash' ? needsChange : false,
          changeAmount: paymentMethodToSend === 'cash' && needsChange ? changeAmount : undefined,
          orderNo,
          managerPhone: storeSettings.phone,
          tenantId: tenantId || '',
        });
        console.log('🔴 [DEBUG-AFTER] sendOrderSummaryToWhatsApp foi chamado com os dados acima');
        console.log('📱 Resumo do pedido enviado para WhatsApp');
        console.log('[FINAL-DATA-SENT] paymentMethod que foi enviado:', paymentMethod);
      } catch (error) {
        console.warn('⚠️ Erro ao enviar resumo para WhatsApp:', error);
        // Não quebra o fluxo se falhar
      }
    } else {
      console.log('⏸️ [CHECKOUT] Resumo WhatsApp não enviado - Motivo:', {
        sendOrderSummaryToWhatsApp: settings.sendOrderSummaryToWhatsApp,
        phone: settings.phone,
        areConditionsMet: settings.sendOrderSummaryToWhatsApp && settings.phone,
      });
    }

    // �🔒 CRÍTICO: Se cliente usou pontos, sincronizar IMEDIATAMENTE com BD
    // Isso evita fraude onde cliente abre outra aba e usa os mesmos pontos
    if (pointsRedeemed > 0) {
      try {
        await useOrdersStore.getState().updateOrderPointsRedeemed(createdOrder.id, pointsRedeemed);
        console.log(`✅ Pontos resgastados sincronizados: ${pointsRedeemed} para ordem ${createdOrder.id}`);
      } catch (error) {
        console.error('⚠️ Falha ao sincronizar points_redeemed (não crítico):', error);
        // Se falhar, continua anyway pois o pedido já foi criado
      }
    }
  };

  const handleSubmitOrder = async () => {
    // � PROTEÇÃO CRÍTICA #1: Se loja está fechada manualmente, BLOQUEIA IMEDIATAMENTE
    if (!settings.isManuallyOpen && !settings.allowSchedulingOutsideBusinessHours) {
      console.error('🚫 [SCHEDULING] BLOQUEIO: isManuallyOpen = false E allowSchedulingOutsideBusinessHours = false');
      toast.error('🔒 Estabelecimento fechado manualmente. Agendamentos não são permitidos.');
      return;
    }

    // 🚫 PROTEÇÃO CRÍTICA #2: Horários configurados no admin SEMPRE são respeitados
    const currentStoreOpen = isStoreOpen();
    if (!currentStoreOpen) {
      console.error('🚫 [SCHEDULING] BLOQUEIO: Estabelecimento fora do horário configurado');
      toast.error('⏰ Estabelecimento fora do horário de funcionamento. Agendamento não permitido.');
      return;
    }

    console.log('✅ [SCHEDULING] Validações passaram - Processando agendamento');
    if (!validateStep('payment')) return;
    
    // 🔒 VALIDAÇÃO CRÍTICA: Revalidar data de agendamento antes de submeter
    // Isso previne que alguém tente manipular a data via DevTools
    if (settings.enableScheduling && scheduledDate) {
      const maxDaysAllowed = settings.maxScheduleDays ?? 7;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const selectedDateObj = new Date(`${scheduledDate}T00:00`);
      const daysDifference = Math.floor((selectedDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDifference > maxDaysAllowed) {
        toast.error(`❌ Data inválida! Você só pode agendar com até ${maxDaysAllowed} dia${maxDaysAllowed !== 1 ? 's' : ''} de antecedência`);
        console.warn('🚨 [SECURITY] Tentativa de agendar data além do limite permitido:', {
          selectedDate: scheduledDate,
          maxDaysAllowed,
          daysDifference
        });
        return;
      }
    }
    
    setIsProcessing(true);
    const orderId = `PED-${Date.now().toString().slice(-5)}`;
    setLastOrderId(orderId);
    
    // Calculate final total with points discount and coupon discount
    const minPointsRequired = useLoyaltySettingsStore.getState().settings?.minPointsToRedeem ?? 50;
    const validPointsToRedeem = pointsToRedeem >= minPointsRequired ? pointsToRedeem : 0;
    const pointsDiscount = calculatePointsDiscount();
    const couponDiscountAmount = (total * couponDiscount) / 100; // Cupom é percentual
    const finalTotal = total - pointsDiscount - couponDiscountAmount;
    
    // Create payload with final total
    const orderPayload = buildOrderPayload(orderId);
    orderPayload.totals.total = finalTotal;
    if (pointsDiscount > 0) {
      orderPayload.totals.pointsDiscount = pointsDiscount;
      orderPayload.totals.pointsRedeemed = validPointsToRedeem;
    }
    if (couponDiscountAmount > 0) {
      orderPayload.totals.couponDiscount = couponDiscountAmount;
      orderPayload.totals.appliedCoupon = appliedCoupon;
    }

    try {
      // 🔒 CRÍTICO: SEMPRE tentar encontrar/criar cliente com email fornecido no checkout
      // Seja logado ou anônimo, se tem email, processa pontos
      let loyaltyCustomer = null;
      const emailForLoyalty = isRemembered && currentCustomer?.email 
        ? currentCustomer.email 
        : customer.email; // Usar email do formulário se não logado
      
      if (emailForLoyalty) {
        console.log('🔍 [LOYALTY] Buscando/criando cliente com email:', emailForLoyalty);
        loyaltyCustomer = await findOrCreateCustomer(emailForLoyalty);
        setLastOrderEmail(emailForLoyalty);
        
        if (loyaltyCustomer) {
          console.log('✅ [LOYALTY] Cliente encontrado/criado:', {
            id: loyaltyCustomer.id,
            email: loyaltyCustomer.email,
            totalPoints: loyaltyCustomer.totalPoints
          });
        } else {
          console.warn('⚠️ [LOYALTY] Falha ao encontrar/criar cliente com email:', emailForLoyalty);
        }
      } else {
        console.warn('⚠️ [LOYALTY] Nenhum email encontrado para processar pontos');
      }
      
      // Save address as default if requested and customer exists
      if (saveAsDefault && currentCustomer && deliveryType === 'delivery') {
        try {
          await saveDefaultAddress({
            street: address.street,
            number: address.number,
            complement: address.complement || '',
            neighborhood: selectedNeighborhood?.name || '',
            city: address.city || 'São Paulo',
            zipCode: address.zipCode || '',
          });
        } catch (error) {
          console.error('Erro ao salvar endereço:', error);
          // Don't fail the order if address save fails
        }
      }
      
      if (paymentMethod === 'pix') {
        // 🔒 NOVO FLUXO: Não cria pedido aqui, apenas gera QR code
        // Pedido será criado APÓS validar pagamento
        
        // Create PIX payment with final total (including points discount)
        const { data: mpData, error: mpError } = await supabase.functions.invoke('mercadopago-payment', {
          body: {
            orderId,
            amount: finalTotal,
            description: `Pedido ${orderId} - Forneiro Éden`,
            payerEmail: 'cliente@forneiroeden.com',
            payerName: customer.name,
            payerPhone: customer.phone,
            payerCpf: customer.cpf,
            paymentType: 'pix'
          }
        });

        if (mpError) {
          console.error('Erro ao criar PIX:', mpError);
          throw new Error('Erro ao gerar pagamento PIX');
        }

        console.log('PIX criado:', mpData);

        if (mpData?.qrCode) {
          // 💾 Armazenar dados do pedido para webhook recuperar depois
          try {
            console.log('💾 Armazenando pedido pendente para confirmação automática...');
            // @ts-ignore - Tabela criada via migration SQL, não está em types automático
            await supabase.from('pending_pix_orders').insert({
              id: orderId,
              payment_id: mpData.paymentId,
              order_payload: {
                ...orderPayload,
                totals: {
                  ...orderPayload.totals,
                  pointsDiscount,
                  pointsRedeemed: validPointsToRedeem,
                  couponDiscount: couponDiscountAmount,
                  appliedCoupon
                }
              },
              customer_name: customer.name,
              customer_phone: customer.phone,
              customer_email: currentCustomer?.email || undefined,
              customer_id: currentCustomer?.id || undefined,
              status: 'pending'
            });
            console.log('✅ Pedido pendente armazenado. Webhook fará a confirmação automática!');
          } catch (error) {
            console.warn('⚠️ Falha ao armazenar pedido pendente (não crítico):', error);
            // Continua mesmo se falhar, o cliente pode clicar no botão manualmente
          }

          setPixData({
            qrCode: mpData.qrCode,
            qrCodeBase64: mpData.qrCodeBase64,
            paymentId: mpData.paymentId,
            expirationDate: mpData.expirationDate
          });
          
          // Armazenar dados do pedido para criar DEPOIS da validação
          setLastOrderPayload({
            ...orderPayload,
            totals: {
              ...orderPayload.totals,
              pointsDiscount,
              pointsRedeemed: validPointsToRedeem,
              couponDiscount: couponDiscountAmount,
              appliedCoupon
            }
          });
          
          // Armazenar valores para usar em handlePixConfirmed
          setLastPointsDiscount(pointsDiscount);
          setLastPointsRedeemed(validPointsToRedeem);
          setLastCouponDiscount(couponDiscountAmount);
          setLastAppliedCoupon(appliedCoupon);
          setLastFinalTotal(finalTotal);
          setLastLoyaltyCustomer(loyaltyCustomer);
          
          // ❌ NÃO cria pedido aqui!
          // ❌ NÃO resgate pontos aqui!
          // Tudo isso vai acontecer em handlePixConfirmed() APÓS validar pagamento
          
          setStep('pix');
        } else {
          throw new Error('QR Code não gerado');
        }
      } else {
        // For card and cash, just process order directly
        // ⚠️ Salvar pontos na ordem para depois o admin confirmar
        await processOrder(orderPayload, pointsDiscount, validPointsToRedeem);
        
        if (pointsDiscount > 0) {
          toast.success(`Pedido enviado! Desconto de ${formatPrice(pointsDiscount)} será aplicado após confirmação.`);
        } else {
          toast.success('Pedido enviado com sucesso! Aguarde confirmação do pagamento.');
        }
        
        // Store discount info for confirmation display (admin will apply later)
        setLastPointsDiscount(pointsDiscount);
        setLastPointsRedeemed(validPointsToRedeem);
        setLastCouponDiscount(couponDiscountAmount);
        setLastAppliedCoupon(appliedCoupon);
        setLastFinalTotal(finalTotal);
        setLastLoyaltyCustomer(loyaltyCustomer);
        setLastOrderPayload(orderPayload);
        
        setStep('confirmation');
        // Show loyalty modal for non-logged customers
        setTimeout(() => setIsLoyaltyModalOpen(true), 500);
      }

    } catch (error) {
      console.error('Erro ao enviar pedido:', error);
      toast.error('Erro ao processar pedido. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  // 💰 Processar pontos e cupons após confirmação de pagamento
  const processPointsAndCoupons = async (pointsRedeemed: number, finalTotal: number, appliedCoupon: string | null) => {
    try {
      // 🔑 USAR CURRENTCUSTOMER COMO FALLBACK se lastLoyaltyCustomer não estiver disponível
      const loyaltyCustomer = lastLoyaltyCustomer || currentCustomer;
      
      if (!loyaltyCustomer || !loyaltyCustomer.id) {
        console.error('❌ [POINTS] Cliente de lealdade não encontrado! Dados:', {
          lastLoyaltyCustomer,
          currentCustomer,
          pointsRedeemed
        });
        toast.error('Erro: Cliente não encontrado. Pedido criado, mas pontos não foram processados.');
        return;
      }

      // 🔑 REGRA: Se cliente usou pontos na compra, NÃO adiciona novos pontos
      const shouldEarnNewPoints = pointsRedeemed === 0;
      
      console.log('💰 [POINTS] Processando pontos após pagamento confirmado:', {
        customerId: loyaltyCustomer.id,
        customerEmail: loyaltyCustomer.email,
        pointsRedeemed,
        shouldEarnNewPoints,
        rule: shouldEarnNewPoints 
          ? 'Cliente NÃO usou pontos - GANHA novos pontos' 
          : 'Cliente USOU pontos - NÃO ganha novos pontos'
      });
      
      // Resgate de pontos se o cliente tiver usado
      if (pointsRedeemed > 0) {
        const minPoints = useLoyaltySettingsStore.getState().settings?.minPointsToRedeem ?? 50;
        if (pointsRedeemed >= minPoints) {
          try {
            console.log(`🔄 [POINTS] Iniciando resgate de ${pointsRedeemed} pontos para cliente ${loyaltyCustomer.id}`);
            const result = await redeemPoints(loyaltyCustomer.id, pointsRedeemed);
            if (!result.success) {
              console.error(`❌ [POINTS] Falha ao resgatar pontos para cliente ${loyaltyCustomer.id}`);
              toast.error('Erro ao resgatar pontos. Tente novamente.');
              return;
            }
            console.log(`✅ [POINTS] ${pointsRedeemed} pontos resgatados com sucesso! Desconto: R$ ${result.discountAmount.toFixed(2)}`);
            
            // ✅ Sincronizar pontos apenas se cliente está logado
            if (isRemembered && currentCustomer?.id === loyaltyCustomer.id) {
              console.log(`🔄 [POINTS] Sincronizando ${pointsRedeemed} pontos descontados para cliente logado ${loyaltyCustomer.id}...`);
              await refreshCurrentCustomer();
              console.log(`✅ [POINTS] Pontos descontados sincronizados com sucesso`);
            } else {
              console.log(`✅ [POINTS] Cliente anônimo - pontos já descontados no BD`);
            }
          } catch (error) {
            console.error('❌ [POINTS] Erro ao resgatar pontos:', error);
            toast.error('Erro ao resgatar pontos. Tente novamente.');
          }
        } else {
          console.warn(`⚠️ [POINTS] Pontos resgastados (${pointsRedeemed}) abaixo do mínimo (${minPoints})`);
        }
      }
      
      // 🔑 Adicionar pontos da compra APENAS se cliente NÃO usou pontos
      if (shouldEarnNewPoints) {
        try {
          const pointsEarned = Math.floor(finalTotal * 1); // 1 ponto por real
          setLastPointsEarned(pointsEarned);
          console.log(`💰 [POINTS] Adicionando ${pointsEarned} novos pontos ao cliente ${loyaltyCustomer.id} (não usou pontos no resgate)`);
          await addPointsFromPurchase(loyaltyCustomer.id, finalTotal, lastOrderEmail, pointsRedeemed);
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // ✅ Sincronizar apenas se cliente está logado
          if (isRemembered && currentCustomer?.id === loyaltyCustomer.id) {
            await refreshCurrentCustomer();
            console.log(`✅ [POINTS] ${pointsEarned} pontos adicionados com sucesso`);
          } else {
            console.log(`✅ [POINTS] ${pointsEarned} pontos adicionados ao cliente anônimo`);
          }
        } catch (error) {
          console.error('❌ [POINTS] Erro ao adicionar pontos:', error);
          toast.error('Erro ao processar pontos de fidelização');
        }
      } else {
        console.log('⏭️ [POINTS] NÃO adicionar pontos: cliente usou pontos no resgate');
        // Apenas atualizar o cliente para refletir a mudança de pontos após resgate (se logado)
        if (isRemembered && currentCustomer?.id === loyaltyCustomer.id) {
          await refreshCurrentCustomer();
        }
      }
      
      // Marcar cupom como usado (se foi aplicado)
      if (appliedCoupon) {
        try {
          await markCouponAsUsed(appliedCoupon, loyaltyCustomer.id);
          console.log(`✅ [POINTS] Cupom ${appliedCoupon} marcado como usado`);
        } catch (error) {
          console.warn('⚠️ [POINTS] Falha ao marcar cupom:', error);
        }
      }
    } catch (error) {
      console.error('❌ [POINTS] Erro ao processar pontos e cupons:', error);
    }
  };

  const handlePixConfirmed = async () => {
    // 🔒 VALIDAÇÃO CRÍTICA: Validar PAGAMENTO + CRIAR PEDIDO (tudo junto na Edge Function)
    if (!pixData?.paymentId) {
      toast.error('ID de pagamento não identificado');
      return;
    }

    if (!lastOrderId || !lastOrderPayload) {
      toast.error('Dados do pedido não encontrados');
      return;
    }

    setIsProcessing(true);
    try {
      // 1️⃣ VALIDAR PAGAMENTO + CRIAR PEDIDO NA EDGE FUNCTION
      console.log('🔄 Validando pagamento e criando pedido...', {
        paymentId: pixData.paymentId,
        orderId: lastOrderId,
        pointsRedeemed: lastPointsRedeemed
      });

      const { data: validationData, error: validationError } = await supabase.functions.invoke(
        'validate-and-create-pix-order',
        {
          body: {
            paymentId: pixData.paymentId,
            orderPayload: lastOrderPayload
          }
        }
      );

      if (validationError || !validationData?.success) {
        const errorMsg = validationData?.error || validationError?.message || 'Erro ao validar pagamento';
        toast.error(errorMsg);
        console.error('❌ Validação falhou:', { validationData, validationError });
        return;
      }

      console.log('✅ Pagamento validado e pedido criado:', validationData);

      // 2️⃣ PEDIDO CRIADO COM SUCESSO - Processar pontos baseado em se foi usado
      await processPointsAndCoupons(lastPointsRedeemed, lastFinalTotal, lastAppliedCoupon);
      
      toast.success('✅ Pedido confirmado com sucesso!');
      
      setStep('confirmation');
      setTimeout(() => setIsLoyaltyModalOpen(true), 500);

    } catch (error) {
      console.error('Erro ao confirmar PIX:', error);
      toast.error('Erro ao confirmar pagamento. Verifique o status da sua transação.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (step === 'confirmation') {
      clearCart();
      // ✅ Limpar agendamento APENAS após confirmar pedido
      setScheduledDate('');
      setScheduledTime('');
      reset();
    }
    // ❌ NÃO resetar scheduledDate/scheduledTime se apenas cancelar
    setStep('contact');
    setPixData(null);
    setCopied(false);
    setLastPointsEarned(0);
    setLastOrderEmail('');
    setSaveAsDefault(false);
    setLastAppliedCoupon('');
    setLastCouponDiscount(0);
    setPointsToRedeem(0);
    setLastPointsDiscount(0);
    setLastPointsRedeemed(0);
    setLastFinalTotal(0);
    setCouponCode('');
    setCouponDiscount(0);
    setAppliedCoupon('');
    setCouponValidationMessage('');
    setSchedulingCheckoutOpen(false);
  };

  const handleBackToCart = () => {
    setSchedulingCheckoutOpen(false);
    setCartOpen(true);
  };

  const getPaymentMethodLabel = () => {
    switch (paymentMethod) {
      case 'pix': return 'PIX';
      case 'card': return 'Cartão (na entrega)';
      case 'cash': return needsChange ? `Dinheiro (troco para R$ ${changeAmount})` : 'Dinheiro (sem troco)';
      default: return '';
    }
  };

  // 📅 Calcular datas de agendamento (mínima e máxima - ANTES do render para não resetar)
  const minDate = new Date().toISOString().split('T')[0];
  
  // ✅ CORRIGIDO: Usar maxScheduleDays do settings em vez de hardcoded 30 dias
  const maxScheduleDays = settings.maxScheduleDays ?? 7; // Fallback para 7 se não configurado
  const maxDate = new Date(Date.now() + maxScheduleDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // ✅ Calcular status da loja
  // 🔑 Usar estado reativo de storeOpen que é atualizado quando settings mudam
  // Se !storeOpen, significa que está fora do horário configurado
  const isStoreClosed = !settings.isManuallyOpen || !storeOpen;

  // 🔒 BLOQUEIO CRÍTICO: Se loja fechada (e agendamentos NÃO permitidos), mostrar aviso uma vez
  useEffect(() => {
    if (isSchedulingCheckoutOpen && isStoreClosed) {
      console.log('🚫 [SCHEDULING] LOJA FECHADA - Agendamentos não permitidos');
      // Não mostra toast pois o aviso visual já está no modal
    }
  }, [isStoreClosed, isSchedulingCheckoutOpen]);

  // ✅ Helper: Verificar se agendamento é para hoje
  const isScheduledForToday = scheduledDate === minDate;

  // ✅ Lógica de aviso: Mostrar SOMENTE se:
  // (Loja fechada manualmente OU fora do horário) E (agendamento NÃO permitido)
  // Se allowSchedulingOutsideBusinessHours = true, NUNCA mostra aviso
  const shouldShowStoreClosedAlert = isStoreClosed && step !== 'confirmation';
  const visibleSteps = getVisibleSteps(deliveryType);

  return (
    <>
      <Dialog open={isSchedulingCheckoutOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden">
        <DialogDescription className="sr-only">
          Formulário de checkout para realizar pedido
        </DialogDescription>
        <ScrollArea className="max-h-[90vh]">
          <div className="p-6">
            <DialogHeader>
              <DialogTitle className="font-display text-xl">
                {step === 'confirmation' ? 'Pedido Agendado com Sucesso! 🗓️' : 
                 step === 'pix' ? 'Pagamento PIX' : 
                 'Agendar Pedido'}
              </DialogTitle>
            </DialogHeader>

            {/* ⚠️ STORE CLOSED CRITICAL BANNER - BLOQUEANTE */}
            {isStoreClosed && step !== 'confirmation' && (
              <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center pointer-events-none">
                <div className="bg-red-600 text-white p-8 rounded-xl text-center max-w-md shadow-2xl">
                  <div className="text-5xl mb-4">🔓</div>
                  <h3 className="text-2xl font-bold mb-2">
                    {!settings.isManuallyOpen ? 'ESTABELECIMENTO FECHADO' : 'HORÁRIO NÃO PERMITIDO'}
                  </h3>
                  <p className="text-base font-semibold">
                    {!settings.isManuallyOpen 
                      ? 'Não é possível agendar no momento' 
                      : 'Loja está fora do horário'}
                  </p>
                </div>
              </div>
            )}

            {/* Store Closed Alert */}
            {isStoreClosed && step !== 'confirmation' && (
              <Alert variant="destructive" className="mt-4 border-2 border-red-600">
                <AlertCircle className="h-5 w-5" />
                <AlertDescription className="font-bold text-base">
                  <strong>{!settings.isManuallyOpen ? '🔒 ESTABELECIMENTO FECHADO MANUALMENTE' : '⏰ FORA DO HORÁRIO DE FUNCIONAMENTO'}</strong> 
                  <br />
                  Não é possível fazer agendamentos no momento. Por favor, consulte nosso horário de funcionamento.
                </AlertDescription>
              </Alert>
            )}

            {/* 🔒 IF STORE IS CLOSED - RENDER DISABLED OVERLAY */}
            {isStoreClosed && step !== 'confirmation' && (
              <div className="mt-6 p-6 bg-red-50 border-2 border-red-300 rounded-lg">
                <div className="flex items-center gap-4 text-red-700">
                  <div className="text-4xl">🚫</div>
                  <div>
                    <p className="font-bold text-lg">Acesso bloqueado</p>
                    <p className="text-sm">A loja não está funcionando agora. Volte mais tarde para agendar seu pedido.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Store Closed Alert - LEGACY */}
            {shouldShowStoreClosedAlert && !isStoreClosed && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>{!settings.isManuallyOpen ? '🔒 Estabelecimento Fechado Manualmente.' : '⏰ Fora do Horário de Funcionamento.'}</strong> {!settings.isManuallyOpen ? 'Não é possível fazer pedidos no momento.' : 'Agendamento fora do horário não está permitido.'}
                  Consulte nosso horário de funcionamento.
                </AlertDescription>
              </Alert>
            )}

            {(!storeOpen || !settings.isManuallyOpen) && step !== 'confirmation' && settings.allowSchedulingOutsideBusinessHours && (
              <Alert className="mt-4" style={{ backgroundColor: '#fef08a', borderColor: '#facc15', color: '#92400e' }}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>✅ Loja fechada,</strong> mas você pode agendar um pedido para quando abrir!
                </AlertDescription>
              </Alert>
            )}

            {/* Progress Steps */}
            {!['confirmation', 'pix'].includes(step) && (
              <div className="flex items-center justify-between mt-6 mb-8">
                {visibleSteps.filter(s => s !== 'payment').map((s, i) => {
                  const displaySteps = visibleSteps.filter(s => s !== 'payment');
                  const currentStepIndex = displaySteps.indexOf(step as any);
                  return (
                    <div key={s} className="flex items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                          ${step === s || currentStepIndex > i
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-muted-foreground'
                          }`}
                      >
                        {i + 1}
                      </div>
                      {i < displaySteps.length - 1 && (
                        <div className={`w-8 md:w-16 h-1 mx-1 rounded
                          ${currentStepIndex > i
                            ? 'bg-primary'
                            : 'bg-secondary'
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <AnimatePresence mode="wait">
              {/* Step 1: Contact */}
              {step === 'contact' && (
                <motion.div
                  key="contact"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <h3 className="font-semibold flex items-center gap-2">
                    <User className="w-5 h-5 text-primary" />
                    Dados de Contato
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">Nome completo *</Label>
                      <Input
                        id="name"
                        placeholder="Seu nome"
                        value={customer.name}
                        onChange={(e) => setCustomer({ name: e.target.value })}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="phone">Telefone/WhatsApp *</Label>
                      <div className="relative mt-1">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="phone"
                          placeholder="(11) 99999-9999"
                          value={customer.phone}
                          onChange={(e) => handlePhoneInput(e.target.value)}
                          className="pl-10"
                          maxLength={15}
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="seu@email.com"
                        value={customer.email || ''}
                        onChange={(e) => setCustomer({ email: e.target.value })}
                        className="mt-1"
                        required
                      />
                    </div>

                  </div>
                </motion.div>
              )}

              {/* Step 2: Delivery */}
              {step === 'delivery' && (
                <motion.div
                  key="delivery"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <h3 className="font-semibold flex items-center gap-2">
                    <Truck className="w-5 h-5 text-primary" />
                    Forma de Entrega
                  </h3>

                  <RadioGroup value={deliveryType} onValueChange={(v) => setDeliveryType(v as 'delivery' | 'pickup')}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="relative">
                        <RadioGroupItem value="delivery" id="delivery" className="peer sr-only" />
                        <Label
                          htmlFor="delivery"
                          className="flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer
                            peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5
                            hover:bg-secondary transition-colors"
                        >
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <Truck className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold">Entrega em domicílio</p>
                            <p className="text-sm text-muted-foreground">
                              Taxa: {selectedNeighborhood ? formatPrice(selectedNeighborhood.deliveryFee) : 'Selecione o bairro'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {settings.deliveryTimeMin}-{settings.deliveryTimeMax} min
                            </p>
                          </div>
                        </Label>
                      </div>

                      <div className="relative">
                        <RadioGroupItem value="pickup" id="pickup" className="peer sr-only" />
                        <Label
                          htmlFor="pickup"
                          className="flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer
                            peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5
                            hover:bg-secondary transition-colors"
                        >
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <Store className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold">Retirada na loja</p>
                            <p className="text-sm text-muted-foreground">Sem taxa</p>
                            <p className="text-xs text-muted-foreground">
                              {settings.pickupTimeMin}-{settings.pickupTimeMax} min
                            </p>
                          </div>
                        </Label>
                      </div>
                    </div>
                  </RadioGroup>

                  <div>
                    <Label htmlFor="observations">Observações do pedido</Label>
                    <Textarea
                      id="observations"
                      placeholder="Ex: Sem cebola, molho extra, etc."
                      value={observations}
                      onChange={(e) => setObservations(e.target.value)}
                      className="mt-1"
                      rows={3}
                    />
                  </div>
                </motion.div>
              )}

              {/* Step 3: Address (ONLY if delivery type is 'delivery') */}
              {step === 'address' && deliveryType === 'delivery' && (
                <motion.div
                  key="address"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <h3 className="font-semibold flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" />
                    Endereço de Entrega
                  </h3>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <Label htmlFor="neighborhood">Bairro *</Label>
                        <Select 
                          value={selectedNeighborhood?.id || ''} 
                          onValueChange={(id) => {
                            const nb = activeNeighborhoods.find(n => n.id === id);
                            setSelectedNeighborhood(nb || null);
                          }}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {activeNeighborhoods.map(nb => (
                              <SelectItem key={nb.id} value={nb.id}>
                                {nb.name} - {formatPrice(nb.deliveryFee)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="street">Rua *</Label>
                      <Input
                        id="street"
                        placeholder="Nome da rua"
                        value={address.street}
                        onChange={(e) => setAddress({ ...address, street: e.target.value })}
                        className="mt-1"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="number">Número *</Label>
                        <Input
                          id="number"
                          placeholder="123"
                          value={address.number}
                          onChange={(e) => setAddress({ ...address, number: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="complement">Complemento</Label>
                        <Input
                          id="complement"
                          placeholder="Apto, Bloco..."
                          value={address.complement}
                          onChange={(e) => setAddress({ ...address, complement: e.target.value })}
                          className="mt-1"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="reference">Referência</Label>
                      <Input
                        id="reference"
                        placeholder="Próximo ao..."
                        value={address.reference}
                        onChange={(e) => setAddress({ ...address, reference: e.target.value })}
                        className="mt-1"
                      />
                    </div>

                    {/* Save as default option if customer is logged in */}
                    {currentCustomer && (
                      <div className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                        saveAsDefault 
                          ? 'bg-primary/10 border-primary' 
                          : 'bg-secondary/50 border-secondary'
                      }`}>
                        <Checkbox
                          id="save-as-default"
                          checked={saveAsDefault}
                          onCheckedChange={(checked) => setSaveAsDefault(checked as boolean)}
                        />
                        <div className="flex-1">
                          <Label 
                            htmlFor="save-as-default" 
                            className="text-sm font-medium cursor-pointer"
                          >
                            Usar como endereço padrão
                          </Label>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {currentCustomer.street 
                              ? 'Será salvo como preferido para próximos pedidos' 
                              : 'Marque para usar automaticamente nos próximos pedidos'}
                          </p>
                        </div>
                        {currentCustomer.street && (
                          <Home className="w-4 h-4 text-primary" />
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Step 4: Scheduling */}
              {step === 'scheduling' && (
                <motion.div
                  key="scheduling"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <h3 className="font-semibold flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" />
                    Agendar Pedido
                  </h3>

                  <div className="space-y-4">
                    {/* Date Input - Simples, sem visualização de ano */}
                    <div>
                      <Label htmlFor="scheduled-date" className="text-sm font-medium">
                        Data de Entrega/Retirada
                      </Label>
                      <Input
                        id="scheduled-date"
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        min={minDate}
                        max={maxDate}
                        className="mt-1"
                      />
                      {scheduledDate && (
                        <div className="mt-2 p-2 bg-primary/10 rounded text-sm font-medium text-primary">
                          📅 {new Date(`${scheduledDate}T00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                        </div>
                      )}
                    </div>

                    {/* Slot Selector - Novo componente com horários disponíveis */}
                    {scheduledDate && (
                      <>
                        {console.log('🎯 [MODAL] Renderizando SchedulingSlotSelector com tenantId:', tenantId)}
                        <SchedulingSlotSelector
                          tenantId={tenantId}
                          selectedDate={scheduledDate}
                          selectedTime={scheduledTime}
                          onTimeChange={setScheduledTime}
                          minDate={minDate}
                          maxDate={maxDate}
                          weekSchedule={settings.schedule}
                          respectBusinessHours={!settings.allowSchedulingOutsideBusinessHours && settings.respectBusinessHoursForScheduling}
                        />
                      </>
                    )}

                    {/* Summary */}
                    {scheduledDate && scheduledTime && (
                      <Alert className="bg-primary/10 dark:bg-primary/20 border-primary/40 dark:border-primary/60 text-foreground dark:text-slate-100">
                        <Calendar className="h-4 w-4" />
                        <AlertDescription className="text-foreground dark:text-slate-100">
                          Seu pedido será entregue/retirado em <strong>{new Date(`${scheduledDate}T${scheduledTime}`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}</strong>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Step 5: Payment */}
              {step === 'payment' && (
                <motion.div
                  key="payment"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <h3 className="font-semibold flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-primary" />
                    Forma de Pagamento
                  </h3>

                  <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as 'pix' | 'card' | 'cash')}>
                    <div className="grid grid-cols-1 gap-4">
                      {/* PIX */}
                      <div className="relative">
                        <RadioGroupItem value="pix" id="pix" className="peer sr-only" />
                        <Label
                          htmlFor="pix"
                          className="flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer
                            peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5
                            hover:bg-secondary transition-colors"
                        >
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <QrCode className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold">PIX</p>
                            <p className="text-sm text-muted-foreground">Pagamento instantâneo via QR Code</p>
                          </div>
                        </Label>
                      </div>

                      {/* CPF para PIX - APENAS aqui e APENAS para PIX */}
                      {paymentMethod === 'pix' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="bg-secondary/50 rounded-xl p-4 space-y-2"
                        >
                          <Label htmlFor="cpf-pix">CPF *</Label>
                          <Input
                            id="cpf-pix"
                            placeholder="000.000.000-00"
                            value={customer.cpf}
                            onChange={(e) => handleCpfInput(e.target.value)}
                            maxLength={14}
                          />
                          <p className="text-xs text-muted-foreground">Necessário para segurança do pagamento PIX</p>
                        </motion.div>
                      )}

                      {/* Cartão */}
                      <div className="relative">
                        <RadioGroupItem value="card" id="card" className="peer sr-only" />
                        <Label
                          htmlFor="card"
                          className="flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer
                            peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5
                            hover:bg-secondary transition-colors"
                        >
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <CreditCard className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold">Cartão</p>
                            <p className="text-sm text-muted-foreground">Crédito ou débito na entrega</p>
                          </div>
                        </Label>
                      </div>

                      {/* Dinheiro */}
                      <div className="relative">
                        <RadioGroupItem value="cash" id="cash" className="peer sr-only" />
                        <Label
                          htmlFor="cash"
                          className="flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer
                            peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5
                            hover:bg-secondary transition-colors"
                        >
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <Banknote className="w-6 h-6 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold">Dinheiro</p>
                            <p className="text-sm text-muted-foreground">Pagamento em espécie na entrega</p>
                          </div>
                        </Label>
                      </div>
                    </div>
                  </RadioGroup>

                  {/* Opção de troco para dinheiro */}
                  {paymentMethod === 'cash' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-secondary/50 rounded-xl p-4 space-y-4"
                    >
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          id="needsChange" 
                          checked={needsChange}
                          onCheckedChange={(checked) => setNeedsChange(checked as boolean)}
                        />
                        <Label htmlFor="needsChange" className="cursor-pointer">
                          Preciso de troco
                        </Label>
                      </div>

                      {needsChange && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          <Label htmlFor="changeAmount">Troco para quanto?</Label>
                          <div className="relative mt-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                            <Input
                              id="changeAmount"
                              type="number"
                              placeholder="0,00"
                              value={changeAmount}
                              onChange={(e) => setChangeAmount(e.target.value)}
                              className="pl-10"
                              min={total}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Total do pedido: {formatPrice(total)}
                          </p>
                        </motion.div>
                      )}
                    </motion.div>
                  )}

                  <Separator className="my-6" />

                  {/* Loyalty Points Redemption - Only for logged in customers */}
                  {isRemembered && currentCustomer && currentCustomer.totalPoints > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200 space-y-4"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Gift className="w-5 h-5 text-amber-600" />
                        <h4 className="font-semibold text-amber-900">Resgate de Pontos</h4>
                        <Star className="w-4 h-4 text-amber-500 ml-auto" />
                      </div>

                      <div className="bg-white rounded-lg p-3 flex items-center justify-between border border-amber-100">
                        <div>
                          <p className="text-xs text-muted-foreground">Saldo disponível</p>
                          <p className="text-2xl font-bold text-amber-600">{currentCustomer.totalPoints} pts</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Equivale a</p>
                          <p className="text-lg font-semibold text-primary">
                            {formatPrice((currentCustomer.totalPoints / 100) * 5)}
                          </p>
                        </div>
                      </div>

                      {currentCustomer.totalPoints > 0 && (
                        <>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="points-slider" className="text-sm font-medium">
                                Quanto deseja gastar?
                              </Label>
                              <span className={`text-sm font-semibold ${pointsToRedeem > 0 && pointsToRedeem < (useLoyaltySettingsStore.getState().settings?.minPointsToRedeem ?? 50) ? 'text-red-500' : 'text-primary'}`}>
                                {pointsToRedeem} pts
                              </span>
                            </div>
                            <input
                              id="points-slider"
                              type="range"
                              min="0"
                              max={currentCustomer.totalPoints}
                              value={pointsToRedeem}
                              onChange={(e) => setPointsToRedeem(parseInt(e.target.value))}
                              className="w-full h-2 bg-amber-200 rounded-lg appearance-none cursor-pointer"
                              style={{
                                background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${(pointsToRedeem / currentCustomer.totalPoints) * 100}%, #fef3c7 ${(pointsToRedeem / currentCustomer.totalPoints) * 100}%, #fef3c7 100%)`
                              }}
                            />
                            {pointsToRedeem > 0 && pointsToRedeem < (useLoyaltySettingsStore.getState().settings?.minPointsToRedeem ?? 50) && (
                              <p className="text-xs text-red-500 font-medium">
                                ⚠️ Mínimo de {useLoyaltySettingsStore.getState().settings?.minPointsToRedeem ?? 50} pontos para resgate
                              </p>
                            )}
                          </div>

                          {pointsToRedeem > 0 && pointsToRedeem >= (useLoyaltySettingsStore.getState().settings?.minPointsToRedeem ?? 50) && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="bg-white rounded-lg p-3 border border-green-200 flex items-center justify-between"
                            >
                              <div>
                                <p className="text-xs text-muted-foreground">Desconto</p>
                                <p className="text-lg font-bold text-green-600">
                                  -{formatPrice(calculatePointsDiscount())}
                                </p>
                              </div>
                              <CheckCircle className="w-5 h-5 text-green-600" />
                            </motion.div>
                          )}

                          <p className="text-xs text-center text-muted-foreground">
                            100 pontos = R$ {useLoyaltySettingsStore.getState().settings?.discountPer100Points ?? 5} de desconto
                            {currentCustomer.totalPoints > 0 && (
                              <>
                                <br />
                                <span className="text-amber-600 font-medium">Mínimo: {useLoyaltySettingsStore.getState().settings?.minPointsToRedeem ?? 50} pontos</span>
                              </>
                            )}
                          </p>
                        </>
                      )}
                    </motion.div>
                  )}

                  {/* Coupon Section */}
                  {isRemembered && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 rounded-xl p-4 space-y-3 border border-purple-200 dark:border-purple-800"
                    >
                      <h4 className="font-semibold flex items-center gap-2">
                        <Gift className="w-4 h-4 text-purple-600" />
                        Usar Cupom de Promoção
                      </h4>

                      {!appliedCoupon ? (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Input
                              placeholder="Digite o código do cupom"
                              value={couponCode}
                              onChange={(e) => {
                                setCouponCode(e.target.value.toUpperCase());
                                setCouponValidationMessage('');
                              }}
                              className="flex-1"
                            />
                            <Button
                              onClick={handleApplyCoupon}
                              variant="outline"
                              size="sm"
                            >
                              Aplicar
                            </Button>
                          </div>
                          {couponValidationMessage && (
                            <p className={`text-xs ${couponValidationMessage.includes('✅') ? 'text-green-600' : 'text-red-600'}`}>
                              {couponValidationMessage}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="bg-white dark:bg-slate-900 rounded-lg p-3 flex items-center justify-between border-2 border-green-200">
                          <div>
                            <p className="text-xs text-muted-foreground">Cupom Aplicado</p>
                            <p className="font-mono font-bold text-green-600">{appliedCoupon}</p>
                            <p className="text-xs text-green-600">-{couponDiscount}% de desconto</p>
                          </div>
                          <button
                            onClick={handleRemoveCoupon}
                            className="p-2 hover:bg-red-50 rounded transition"
                            title="Remover cupom"
                          >
                            <XCircle className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}

                  <Separator className="my-6" />

                  {/* Order Summary */}
                  <div className="bg-secondary/50 rounded-xl p-4 space-y-3">
                    <h4 className="font-semibold">Resumo do Pedido</h4>
                    
                    <div className="space-y-2 text-sm">
                      {items.map(item => (
                        <div key={item.id} className="flex justify-between">
                          <span className="text-muted-foreground">
                            {item.quantity}x {item.product.name}
                            {item.size && ` (${item.size})`}
                          </span>
                          <span>{formatPrice(item.totalPrice)}</span>
                        </div>
                      ))}
                    </div>

                    <Separator />

                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatPrice(subtotal)}</span>
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Taxa de entrega</span>
                      <span>{deliveryType === 'pickup' ? 'Grátis' : formatPrice(deliveryFee)}</span>
                    </div>

                    {pointsToRedeem > 0 && pointsToRedeem >= (useLoyaltySettingsStore.getState().settings?.minPointsToRedeem ?? 50) && (
                      <div className="flex justify-between text-sm text-green-600 font-medium">
                        <span>Desconto (pontos)</span>
                        <span>-{formatPrice(calculatePointsDiscount())}</span>
                      </div>
                    )}

                    {appliedCoupon && couponDiscount > 0 && (
                      <div className="flex justify-between text-sm text-purple-600 font-medium">
                        <span>Desconto (cupom {appliedCoupon})</span>
                        <span>-{formatPrice((total * couponDiscount) / 100)}</span>
                      </div>
                    )}

                    <Separator />

                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span className="text-primary">
                        {formatPrice(total - (pointsToRedeem > 0 && pointsToRedeem >= (useLoyaltySettingsStore.getState().settings?.minPointsToRedeem ?? 50) ? calculatePointsDiscount() : 0) - (appliedCoupon && couponDiscount > 0 ? (total * couponDiscount) / 100 : 0))}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* PIX Payment Step */}
              {step === 'pix' && pixData && (
                <motion.div
                  key="pix"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="space-y-6"
                >
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <QrCode className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg">Escaneie o QR Code para pagar</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Total: <span className="font-semibold text-primary">{formatPrice(total)}</span>
                    </p>
                  </div>

                  {/* QR Code */}
                  <div className="flex justify-center">
                    {pixData.qrCodeBase64 ? (
                      <img 
                        src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                        alt="QR Code PIX"
                        className="w-64 h-64 rounded-lg border"
                      />
                    ) : (
                      <div className="w-64 h-64 bg-secondary rounded-lg flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      </div>
                    )}
                  </div>

                  {/* Código PIX para copiar */}
                  <div className="space-y-2">
                    <Label>Ou copie o código PIX:</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={pixData.qrCode || ''} 
                        readOnly 
                        className="font-mono text-xs"
                      />
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={copyPixCode}
                        className="shrink-0"
                      >
                        {copied ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="bg-secondary/50 rounded-xl p-4 text-center">
                    <p className="text-sm text-muted-foreground">
                      Após realizar o pagamento, clique no botão abaixo para confirmar seu pedido.
                    </p>
                  </div>

                  <Button 
                    className="w-full btn-cta"
                    onClick={handlePixConfirmed}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Já fiz o pagamento
                  </Button>
                </motion.div>
              )}

              {/* Confirmation */}
              {step === 'confirmation' && (
                <motion.div
                  key="confirmation"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-8"
                >
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-10 h-10 text-primary" />
                  </div>
                  
                  <h3 className="font-display text-2xl font-bold mb-2">
                    {lastOrderPayload?.isScheduled ? 'Pedido Agendado! 🗓️' : 'Pedido Confirmado!'}
                  </h3>
                  
                  <p className="text-muted-foreground mb-6">
                    {lastOrderPayload?.isScheduled 
                      ? `Seu pedido foi agendado para ${lastOrderPayload.delivery?.scheduledFor ? new Date(lastOrderPayload.delivery.scheduledFor).toLocaleDateString('pt-BR') : 'em breve'}.`
                      : 'Seu pedido foi recebido com sucesso.'
                    }
                    <br />
                    Você receberá atualizações pelo WhatsApp.
                  </p>

                  <div className="bg-secondary/50 rounded-xl p-4 text-left max-w-sm mx-auto mb-6">
                    <div className="space-y-2 text-sm">
                      <p><span className="text-muted-foreground">Cliente:</span> {customer.name}</p>
                      <p><span className="text-muted-foreground">Telefone:</span> {customer.phone}</p>
                      <p><span className="text-muted-foreground">Entrega:</span> {deliveryType === 'delivery' ? 'Em domicílio' : 'Retirada'}</p>
                      {lastOrderPayload?.isScheduled && lastOrderPayload.delivery?.scheduledFor && (
                        <p className="text-primary font-medium">
                          📅 Agendado para: {new Date(lastOrderPayload.delivery.scheduledFor).toLocaleString('pt-BR')}
                        </p>
                      )}
                      <p><span className="text-muted-foreground">Pagamento:</span> {getPaymentMethodLabel()}</p>
                      {lastPointsDiscount > 0 && (
                        <p className="text-green-600 font-medium">Desconto (Pontos): -{formatPrice(lastPointsDiscount)}</p>
                      )}
                      {lastAppliedCoupon && lastCouponDiscount > 0 && (
                        <p className="text-purple-600 font-medium">Desconto (Cupom {lastAppliedCoupon}): -{formatPrice(lastCouponDiscount)}</p>
                      )}
                      <p className="font-semibold text-primary">Total: {lastFinalTotal > 0 ? formatPrice(lastFinalTotal) : formatPrice(total)}</p>
                    </div>
                  </div>

                  <Button onClick={handleClose} className="btn-cta">
                    Fazer novo pedido
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation Buttons */}
            {!['confirmation', 'pix'].includes(step) && (
              <div className="flex items-center justify-between mt-8 pt-4 border-t">
                <Button
                  variant="ghost"
                  onClick={step === 'contact' ? handleBackToCart : prevStep}
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {step === 'contact' ? 'Voltar ao carrinho' : 'Voltar'}
                </Button>

                {step === 'payment' ? (
                  <Button 
                    className="btn-cta gap-2"
                    onClick={handleSubmitOrder}
                    disabled={isProcessing || ((!storeOpen || !settings.isManuallyOpen) && !settings.allowSchedulingOutsideBusinessHours)}
                    title={((!storeOpen || !settings.isManuallyOpen) && !settings.allowSchedulingOutsideBusinessHours) ? '🔒 Loja fechada. Pedidos não permitidos.' : ''}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processando...
                      </>
                    ) : paymentMethod === 'pix' ? (
                      <>
                        Gerar PIX
                        <QrCode className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        Confirmar Pedido
                        <CheckCircle className="w-4 h-4" />
                      </>
                    )}
                  </Button>
                ) : (
                  <Button 
                    className="btn-cta gap-2" 
                    onClick={nextStep}
                    disabled={(!storeOpen || !settings.isManuallyOpen) && !settings.allowSchedulingOutsideBusinessHours}
                    title={((!storeOpen || !settings.isManuallyOpen) && !settings.allowSchedulingOutsideBusinessHours) ? '🔒 Loja fechada. Pedidos não permitidos.' : ''}
                  >
                    Continuar
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>

    {/* Loyalty Registration Modal - Show only for non-registered, non-logged customers */}
    {!isRemembered && !currentCustomer?.isRegistered && (
      <PostCheckoutLoyaltyModal 
        isOpen={isLoyaltyModalOpen}
        onClose={() => setIsLoyaltyModalOpen(false)}
        email={lastOrderEmail || ''}
        pointsEarned={lastPointsEarned}
      />
    )}
    </>
  );
}

