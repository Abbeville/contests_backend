import axios from 'axios';

interface PaymentInitiationResponse {
  success: boolean;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
  message?: string;
}

export class PaymentService {
  private readonly apiUrl = 'https://api.paystack.co';
  private readonly secretKey: string;

  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY || 'sk_test_ce3315933a23c7b471411cfc0234b300684677fe';
    
    if (!this.secretKey) {
      console.warn('⚠️ PAYSTACK_SECRET_KEY not set. Payment functionality will be limited.');
    }
  }

  // Initialize payment (for deposits)
  async initializePayment(
    email: string,
    amount: number, // in kobo (for NGN)
    callback_url: string,
    metadata?: Record<string, any>
  ): Promise<PaymentInitiationResponse> {
    try {
      if (!this.secretKey) {
        throw new Error('Payment gateway not configured');
      }

      const amountInKobo = Math.round(amount * 100); // Convert to kobo

      const response = await axios.post(
        `${this.apiUrl}/transaction/initialize`,
        {
          email,
          amount: amountInKobo,
          currency: 'NGN',
          callback_url,
          metadata: {
            custom_fields: [
              {
                display_name: 'Payment Type',
                variable_name: 'payment_type',
                value: metadata?.payment_type || 'wallet_funding'
              }
            ]
          }
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.status) {
        return {
          success: true,
          data: response.data.data
        };
      } else {
        throw new Error(response.data.message || 'Failed to initialize payment');
      }
    } catch (error: any) {
      console.error('Payment initialization error:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to initialize payment'
      };
    }
  }

  // Verify payment transaction
  async verifyPayment(reference: string): Promise<{
    success: boolean;
    verified: boolean;
    data?: any;
    message?: string;
  }> {
    try {
      if (!this.secretKey) {
        throw new Error('Payment gateway not configured');
      }

      const response = await axios.get(
        `${this.apiUrl}/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`
          }
        }
      );

      if (response.data.status) {
        const data = response.data.data;
        return {
          success: true,
          verified: data.status === 'success',
          data
        };
      } else {
        return {
          success: false,
          verified: false,
          message: response.data.message || 'Transaction verification failed'
        };
      }
    } catch (error: any) {
      console.error('Payment verification error:', error.response?.data || error.message);
      return {
        success: false,
        verified: false,
        message: error.response?.data?.message || error.message || 'Failed to verify payment'
      };
    }
  }

  // Initialize bank transfer (for withdrawals using Paystack Transfer API)
  async initiateBankTransfer(
    amount: number,
    recipientName: string,
    accountNumber: string,
    bankCode: string
  ): Promise<{
    success: boolean;
    data?: {
      reference: string;
      transfer_code: string;
      status: string;
    };
    message?: string;
  }> {
    try {
      if (!this.secretKey) {
        throw new Error('Payment gateway not configured');
      }

      const amountInKobo = Math.round(amount * 100);

      // First, create a transfer recipient
      const recipientResponse = await axios.post(
        `${this.apiUrl}/transferrecipient`,
        {
          type: 'nuban',
          name: recipientName,
          account_number: accountNumber,
          bank_code: bankCode,
          currency: 'NGN'
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!recipientResponse.data.status) {
        throw new Error(recipientResponse.data.message || 'Failed to create transfer recipient');
      }

      const recipientCode = recipientResponse.data.data.recipient_code;

      // Then initiate the transfer
      const transferResponse = await axios.post(
        `${this.apiUrl}/transfer`,
        {
          source: 'balance',
          amount: amountInKobo,
          recipient: recipientCode,
          reason: 'Creator withdrawal'
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (transferResponse.data.status) {
        return {
          success: true,
          data: transferResponse.data.data
        };
      } else {
        throw new Error(transferResponse.data.message || 'Failed to initiate transfer');
      }
    } catch (error: any) {
      console.error('Bank transfer initiation error:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to initiate bank transfer'
      };
    }
  }

  // Verify transfer status
  async verifyTransfer(transferCode: string): Promise<{
    success: boolean;
    verified: boolean;
    data?: any;
    message?: string;
  }> {
    try {
      if (!this.secretKey) {
        throw new Error('Payment gateway not configured');
      }

      const response = await axios.get(
        `${this.apiUrl}/transfer/${transferCode}`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`
          }
        }
      );

      if (response.data.status) {
        const data = response.data.data;
        return {
          success: true,
          verified: data.status === 'success',
          data
        };
      } else {
        return {
          success: false,
          verified: false,
          message: response.data.message || 'Transfer verification failed'
        };
      }
    } catch (error: any) {
      console.error('Transfer verification error:', error.response?.data || error.message);
      return {
        success: false,
        verified: false,
        message: error.response?.data?.message || error.message || 'Failed to verify transfer'
      };
    }
  }

  // Get list of banks (Nigerian banks)
  async getBanks(): Promise<{
    success: boolean;
    data?: any[];
    message?: string;
  }> {
    try {
      if (!this.secretKey) {
        // Return Nigerian banks list as fallback
        return {
          success: true,
          data: this.getNigerianBanks()
        };
      }

      const response = await axios.get(
        `${this.apiUrl}/bank`,
        {
          params: {
            country: 'nigeria'
          },
          headers: {
            Authorization: `Bearer ${this.secretKey}`
          }
        }
      );

      if (response.data.status) {
        return {
          success: true,
          data: response.data.data
        };
      } else {
        return {
          success: true,
          data: this.getNigerianBanks()
        };
      }
    } catch (error: any) {
      console.error('Get banks error:', error.message);
      return {
        success: true,
        data: this.getNigerianBanks()
      };
    }
  }

  // Fallback list of Nigerian banks
  private getNigerianBanks(): any[] {
    return [
      { name: 'Access Bank', code: '044' },
      { name: 'Fidelity Bank', code: '070' },
      { name: 'First Bank of Nigeria', code: '011' },
      { name: 'Guaranty Trust Bank', code: '058' },
      { name: 'Stanbic IBTC Bank', code: '221' },
      { name: 'Union Bank of Nigeria', code: '032' },
      { name: 'United Bank for Africa', code: '033' },
      { name: 'Zenith Bank', code: '057' }
    ];
  }
}

export const paymentService = new PaymentService();

