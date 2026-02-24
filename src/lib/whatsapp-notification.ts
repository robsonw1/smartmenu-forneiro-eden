import { supabase } from '@/integrations/supabase/client';

export interface SendOrderSummaryParams {
  orderId: string;
  orderNo: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  items: Array<{
    quantity: number;
    name: string;
    size?: string;
    price: number;
    details?: string[];
  }>;
  subtotal: number;
  pointsDiscount?: number;
  couponDiscount?: number;
  appliedCoupon?: string;
  deliveryFee: number;
  total: number;
  deliveryType: 'delivery' | 'pickup';
  address?: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    reference?: string;
  };
  observations?: string;
  paymentMethod?: 'pix' | 'card' | 'cash';
  needsChange?: boolean;
  changeAmount?: string;
  managerPhone: string;
  tenantId: string;
}

export async function sendOrderSummaryToWhatsApp(params: SendOrderSummaryParams): Promise<void> {
  try {
    console.log('🔍 [WHATSAPP-DEBUG] Parâmetros recebidos:', {
      orderId: params.orderId,
      customerName: params.customerName,
      paymentMethod: params.paymentMethod,
      needsChange: params.needsChange,
      changeAmount: params.changeAmount,
      observations: params.observations,
      deliveryType: params.deliveryType,
      address: params.address,
    });

    if (!params.orderId || !params.managerPhone || !params.tenantId) {
      console.warn('⚠️ [Resumo WhatsApp] Parâmetros incompletos:', params);
      return;
    }

    // Formatar itens com detalhes
    const itemsText = params.items
      .map((item) => {
        const baseText = `• ${item.quantity}x ${item.name}${item.size ? ` (${item.size})` : ''} - R$ ${(item.price * item.quantity).toFixed(2)}`;
        const details = item.details && item.details.length > 0 
          ? `\n   ${item.details.map(d => `→ ${d}`).join('\n   ')}`
          : '';
        console.log(`🔍 [WHATSAPP] Item: ${item.name}, Details:`, item.details);
        return `  ${baseText}${details}`;
      })
      .join('\n');

    // Formatar endereço
    const addressText =
      params.deliveryType === 'delivery' && params.address
        ? `📍 ${params.address.street}, ${params.address.number}${params.address.complement ? ', ' + params.address.complement : ''}\n   📌 Bairro: ${params.address.neighborhood}${params.address.reference ? '\n   🔖 Referência: ' + params.address.reference : ''}`
        : `🏪 Retirada no local`;

    console.log('📍 [WHATSAPP] Endereço construído:', {
      deliveryType: params.deliveryType,
      hasAddress: !!params.address,
      addressText,
      reference: params.address?.reference,
    });

    // Montar descontos
    let discountsText = '';
    if (params.couponDiscount && params.couponDiscount > 0) {
      discountsText += `🎁 Desconto (Cupom ${params.appliedCoupon || 'N/A'}): -R$ ${params.couponDiscount.toFixed(2)}\n`;
    }
    if (params.pointsDiscount && params.pointsDiscount > 0) {
      discountsText += `⭐ Desconto (Pontos): -R$ ${params.pointsDiscount.toFixed(2)}\n`;
    }

    // Montar pagamento
    let paymentText = '';
    console.log('💳 [WHATSAPP] Debug pagamento (ANTES de construir):', {
      paymentMethod: params.paymentMethod,
      typeOfPaymentMethod: typeof params.paymentMethod,
      needsChange: params.needsChange,
      changeAmount: params.changeAmount,
    });

    // SOLUÇÃO DEFINITIVA: construir paymentText com todas as condições
    if (params.paymentMethod) {
      if (params.paymentMethod === 'pix') {
        paymentText = '💳 Pagamento: PIX';
      } else if (params.paymentMethod === 'card') {
        paymentText = '💳 Pagamento: Cartão/Débito';
      } else if (params.paymentMethod === 'cash') {
        paymentText = '💵 Pagamento: Dinheiro';
        if (params.needsChange && params.changeAmount) {
          paymentText += ` - Troco para: R$ ${params.changeAmount}`;
        }
      }
    }

    console.log('💳 [WHATSAPP] paymentText FINAL:', paymentText);
    console.log('📝 [WHATSAPP] observations:', params.observations);

    // CONSTRUIR MENSAGEM COM GARANTIA DE RENDERIZAÇÃO
    const message = `📦 NOVO PEDIDO #${params.orderNo}

👤 Cliente: ${params.customerName}
📱 Telefone: ${params.customerPhone}
${params.customerEmail ? `📧 Email: ${params.customerEmail}` : ''}
🛍️ Itens:
${itemsText}

Subtotal: R$ ${params.subtotal.toFixed(2)}
${discountsText}🚚 Entrega: R$ ${params.deliveryFee.toFixed(2)}
💰 Total: R$ ${params.total.toFixed(2)}

${addressText}

🚗 Tipo: ${params.deliveryType === 'delivery' ? 'Entrega' : 'Retirada'}
${paymentText ? `${paymentText}` : ''}
${params.observations ? `📝 Observações: ${params.observations}` : ''}`;

    console.log('📤 [WHATSAPP] =============== MENSAGEM FINAL ===============');
    console.log(message);
    console.log('📤 [WHATSAPP] componentes da mensagem:');
    console.log('  - addressText:', addressText);
    console.log('  - paymentText:', paymentText);
    console.log('  - observations:', params.observations);
    console.log('📤 [WHATSAPP] ============================================');
    console.log('📤 [WHATSAPP] Enviando para telefone:', params.managerPhone);

    // Invocar Edge Function
    supabase.functions
      .invoke('send-order-summary-whatsapp', {
        body: {
          phone: params.managerPhone,
          message,
          orderId: params.orderId,
          tenantId: params.tenantId,
        },
      })
      .then((response) => {
        if (response.data?.success) {
          console.log(`✅ [Resumo WhatsApp] Mensagem enviada para ${params.managerPhone}`);
        } else {
          console.warn(`⚠️ [Resumo WhatsApp] Falha ao enviar:`, response.data?.error);
        }
      })
      .catch((error) => {
        console.warn(`⚠️ [Resumo WhatsApp] Erro ao chamar função:`, error);
      });
  } catch (error) {
    console.error('❌ [Resumo WhatsApp] Erro inesperado:', error);
  }
}
