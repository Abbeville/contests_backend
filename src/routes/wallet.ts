import express from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, authorize } from '../middleware/auth';
import { UserType, TransactionStatus, TransactionType } from '../types';
import { paymentService } from '../services/paymentService';
import { AppDataSource } from '../config/database';
import { Wallet } from '../models/Wallet';
import { Transaction } from '../models/Transaction';
import { BankAccount } from '../models/BankAccount';
import { Withdrawal } from '../models/Withdrawal';
import { walletService } from '../services/walletService';
import { WalletLedger } from '../models/WalletLedger';

const router = express.Router();

// Basic wallet info (compat with earlier frontend)
router.get('/', authenticate, async (req: any, res) => {
  try {
    const wallet = await walletService.getWalletByUserId(req.user.id);
    res.json({ success: true, data: { wallet } });
  } catch (error) {
    console.error('Get wallet error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Wallet transactions (compat with earlier frontend)
router.get('/transactions', authenticate, async (req: any, res) => {
  try {
    const wallet = await walletService.getWalletByUserId(req.user.id);
    const params = {
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 10,
      type: req.query.type as string,
      status: req.query.status as string
    } as any;
    const result = await walletService.getWalletTransactions(wallet.id, params);
    res.json({ success: true, data: { transactions: result.transactions }, pagination: result.pagination });
  } catch (error) {
    console.error('Get wallet transactions error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Deposits: initialize payment
router.post('/deposits/init', authenticate, authorize(UserType.BRAND), [
  body('amount').isNumeric().isFloat({ gt: 0 }),
  body('email').optional().isEmail(),
  body('callback_url').isURL()
], async (req: any, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const user = req.user;
    const { amount, callback_url } = req.body;
    const email = req.body.email || user.email;

    const init = await paymentService.initializePayment(email, amount, callback_url, { payment_type: 'wallet_funding' });
    if (!init.success || !init.data) {
      return res.status(400).json({ success: false, message: init.message || 'Failed to initialize payment' });
    }

  // Ensure wallet exists
  const wallet = await walletService.getWalletByUserId(user.id);

  // Record pending transaction with reference
  const tx = new Transaction();
  tx.wallet_id = wallet.id;
  tx.user_id = user.id;
  (tx as any).amount = amount;
  tx.transaction_type = TransactionType.DEPOSIT;
  tx.status = TransactionStatus.PENDING;
  tx.description = 'Wallet deposit initiated';
  tx.reference = init.data.reference;
  tx.metadata = { provider: 'paystack', access_code: init.data.access_code };
  await AppDataSource.getRepository(Transaction).save(tx);

  return res.json({ success: true, data: init.data });
  } catch (error) {
    console.error('Deposit init error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Deposits: verify payment and credit wallet
router.post('/deposits/verify', authenticate, authorize(UserType.BRAND), [
  body('reference').notEmpty().isString(),
  body('expectedAmount').optional().isNumeric()
], async (req: any, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

  const { reference, expectedAmount } = req.body;

  // Lookup pending transaction by reference
  const txRepo = AppDataSource.getRepository(Transaction);
  const walletRepo = AppDataSource.getRepository(Wallet);
  const ledgerRepo = AppDataSource.getRepository(WalletLedger);
  const pendingTx = await txRepo.findOne({ where: { user_id: req.user.id, reference, status: TransactionStatus.PENDING } as any });

  const verify = await paymentService.verifyPayment(reference);
    if (!verify.success || !verify.verified || !verify.data) {
      return res.status(400).json({ success: false, message: verify.message || 'Verification failed' });
    }

    // Amount in kobo -> naira
    const amount = (verify.data.amount || 0) / 100;
  if (expectedAmount && Math.round(expectedAmount * 100) !== Math.round(amount * 100)) {
      return res.status(400).json({ success: false, message: 'Amount mismatch' });
    }

  // If we recorded a pending tx at init, validate amount matches
  if (pendingTx) {
    if (Math.round((pendingTx.amount || 0) * 100) !== Math.round(amount * 100)) {
      return res.status(400).json({ success: false, message: 'Recorded amount mismatch' });
    }

    // Credit wallet and mark transaction completed
    const wallet = await walletRepo.findOne({ where: { user_id: req.user.id } });
    if (!wallet) {
      return res.status(404).json({ success: false, message: 'Wallet not found' });
    }
    wallet.balance += amount;
    if (typeof (wallet as any).total_deposited === 'number') {
      (wallet as any).total_deposited += amount;
    }
    await walletRepo.save(wallet);

    pendingTx.status = TransactionStatus.COMPLETED;
    pendingTx.description = 'Wallet deposit completed';
    pendingTx.metadata = { ...(pendingTx.metadata || {}), verified: true };
    await txRepo.save(pendingTx);

    // Ledger entry
    const led = new WalletLedger();
    led.wallet_id = wallet.id;
    led.user_id = req.user.id;
    (led as any).entry_type = 'credit';
    (led as any).amount = amount;
    (led as any).balance_after = wallet.balance;
    led.reference = pendingTx.reference;
    led.transaction_id = pendingTx.id;
    led.context = 'deposit';
    await ledgerRepo.save(led);

    return res.json({ success: true, data: { wallet } });
  }

  // Fallback: if no pending tx, credit and create a completed tx
  const wallet = await walletService.getWalletByUserId(req.user.id);
  wallet.balance += amount;
  if (typeof (wallet as any).total_deposited === 'number') {
    (wallet as any).total_deposited += amount;
  }
  await walletRepo.save(wallet);

  const completed = new Transaction();
  completed.wallet_id = wallet.id;
  completed.user_id = req.user.id;
  (completed as any).amount = amount;
  completed.transaction_type = TransactionType.DEPOSIT;
  completed.status = TransactionStatus.COMPLETED;
  completed.description = 'Wallet deposit (no pending record)';
  completed.reference = reference;
  completed.metadata = { provider: 'paystack', verified: true };
  await txRepo.save(completed);

  const led = new WalletLedger();
  led.wallet_id = wallet.id;
  led.user_id = req.user.id;
  (led as any).entry_type = 'credit';
  (led as any).amount = amount;
  (led as any).balance_after = wallet.balance;
  led.reference = reference;
  led.transaction_id = completed.id;
  led.context = 'deposit';
  await ledgerRepo.save(led);

  return res.json({ success: true, data: { wallet } });
  } catch (error) {
    console.error('Deposit verify error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Banks list
router.get('/banks', authenticate, async (_req, res) => {
  try {
    const result = await paymentService.getBanks();
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message || 'Failed to fetch banks' });
    }
    res.json({ success: true, data: { banks: result.data || [] } });
  } catch (error) {
    console.error('Banks error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Bank accounts CRUD
router.get('/bank-accounts', authenticate, async (req: any, res) => {
  try {
    const accounts = await AppDataSource.getRepository(BankAccount).find({ where: { user_id: req.user.id } });
    res.json({ success: true, data: { accounts } });
  } catch (error) {
    console.error('Get bank accounts error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/bank-accounts', authenticate, [
  body('account_name').notEmpty(),
  body('account_number').notEmpty(),
  body('bank_name').notEmpty(),
  body('bank_code').notEmpty(),
  body('account_type').isIn(['savings', 'current'])
], async (req: any, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const repo = AppDataSource.getRepository(BankAccount);
    const account = new BankAccount();
    account.user_id = req.user.id;
    account.account_name = req.body.account_name;
    account.account_number = req.body.account_number;
    account.bank_name = req.body.bank_name;
    account.bank_code = req.body.bank_code;
    account.account_type = req.body.account_type;
    account.currency = 'NGN';
    account.is_active = true;
    account.is_verified = false;
    const saved = await repo.save(account);
    res.status(201).json({ success: true, data: { account: saved } });
  } catch (error) {
    console.error('Create bank account error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.delete('/bank-accounts/:id', authenticate, async (req: any, res) => {
  try {
    const repo = AppDataSource.getRepository(BankAccount);
    const account = await repo.findOne({ where: { id: req.params.id, user_id: req.user.id } });
    if (!account) {
      return res.status(404).json({ success: false, message: 'Account not found' });
    }
    await repo.remove(account);
    res.json({ success: true, message: 'Account removed' });
  } catch (error) {
    console.error('Delete bank account error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Withdrawals
router.post('/withdrawals', authenticate, authorize(UserType.CREATOR), [
  body('amount').isNumeric().isFloat({ gt: 0 }),
  body('bank_account_id').optional().isString(),
  body('bank_name').optional().isString(),
  body('bank_code').optional().isString(),
  body('account_number').optional().isString(),
  body('account_name').optional().isString()
], async (req: any, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { amount, bank_account_id, bank_name, bank_code, account_number, account_name } = req.body;

    const walletRepo = AppDataSource.getRepository(Wallet);
    const txRepo = AppDataSource.getRepository(Transaction);
    const wdRepo = AppDataSource.getRepository(Withdrawal);
    const baRepo = AppDataSource.getRepository(BankAccount);

    const wallet = await walletService.getWalletByUserId(req.user.id);
    if (!wallet || wallet.balance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    let accountInfo: { name: string; number: string; bankName: string; bankCode: string } | null = null;
    if (bank_account_id) {
      const acc = await baRepo.findOne({ where: { id: bank_account_id, user_id: req.user.id } });
      if (!acc) {
        return res.status(404).json({ success: false, message: 'Bank account not found' });
      }
      accountInfo = { name: acc.account_name, number: acc.account_number, bankName: acc.bank_name, bankCode: acc.bank_code };
    } else if (bank_name && bank_code && account_number && account_name) {
      accountInfo = { name: account_name, number: account_number, bankName: bank_name, bankCode: bank_code };
    } else {
      return res.status(400).json({ success: false, message: 'Bank account details required' });
    }

    // Fee: 2.5% + ₦100 fixed
    const percentFee = Math.round(amount * 0.025 * 100) / 100;
    const fixedFee = 100;
    const fee = percentFee + fixedFee;
    const net = Math.max(0, Math.round((amount - fee) * 100) / 100);

    // Stage 1: place hold (move to pending_balance) and create pending tx & ledger (atomic)
    const qr1 = AppDataSource.createQueryRunner();
    await qr1.connect();
    await qr1.startTransaction();
    let savedTx: Transaction;
    try {
      const w = await qr1.manager.findOne(Wallet, { where: { id: wallet.id } });
      if (!w) throw new Error('Wallet not found');
      if (w.balance < amount) throw new Error('Insufficient balance');
      (w as any).balance = Math.round(((w.balance - amount) + Number.EPSILON) * 100) / 100;
      (w as any).pending_balance = Math.round((((w.pending_balance || 0) + amount) + Number.EPSILON) * 100) / 100;
      await qr1.manager.save(Wallet, w);

      const tx = new Transaction();
      tx.wallet_id = w.id;
      tx.user_id = req.user.id;
      (tx as any).amount = amount;
      tx.transaction_type = TransactionType.WITHDRAWAL;
      tx.status = TransactionStatus.PENDING;
      tx.description = 'Withdrawal hold placed';
      savedTx = await qr1.manager.save(Transaction, tx);

      const ledHold = new WalletLedger();
      ledHold.wallet_id = w.id;
      ledHold.user_id = req.user.id;
      (ledHold as any).entry_type = 'debit';
      (ledHold as any).amount = amount;
      (ledHold as any).balance_after = w.balance;
      ledHold.transaction_id = savedTx.id;
      ledHold.context = 'withdrawal_hold';
      await qr1.manager.save(WalletLedger, ledHold);

      await qr1.commitTransaction();
    } catch (e) {
      await qr1.rollbackTransaction();
      await qr1.release();
      throw e;
    }
    await qr1.release();

    const wd = new Withdrawal();
    wd.user_id = req.user.id;
    wd.bank_account_name = accountInfo.name;
    wd.bank_account_number = accountInfo.number;
    wd.bank_name = accountInfo.bankName;
    wd.bank_code = accountInfo.bankCode;
    (wd as any).amount = amount;
    (wd as any).fee = fee;
    (wd as any).net_amount = net;
    wd.currency = 'NGN';
    wd.status = 'processing';
    wd.transaction_id = savedTx.id;
    const savedWd = await wdRepo.save(wd);

    // Initiate transfer via gateway (non-blocking flow could be used; here we attempt immediately)
    const transfer = await paymentService.initiateBankTransfer(net, accountInfo.name, accountInfo.number, accountInfo.bankCode);
    if (!transfer.success || !transfer.data) {
      // Stage 2A: failure — refund hold (atomic)
      const qrFail = AppDataSource.createQueryRunner();
      await qrFail.connect();
      await qrFail.startTransaction();
      try {
        const w = await qrFail.manager.findOne(Wallet, { where: { id: wallet.id } });
        if (!w) throw new Error('Wallet not found');
        (w as any).balance = Math.round(((w.balance + amount) + Number.EPSILON) * 100) / 100;
        (w as any).pending_balance = Math.max(0, Math.round((((w.pending_balance || 0) - amount) + Number.EPSILON) * 100) / 100);
        await qrFail.manager.save(Wallet, w);

        savedWd.status = 'failed';
        savedWd.admin_notes = transfer.message || 'Transfer initiation failed';
        await qrFail.manager.save(Withdrawal, savedWd);

        savedTx.status = TransactionStatus.FAILED;
        savedTx.description = 'Withdrawal failed (refunded)';
        await qrFail.manager.save(Transaction, savedTx);

        const ledRefund = new WalletLedger();
        ledRefund.wallet_id = w.id;
        ledRefund.user_id = req.user.id;
        (ledRefund as any).entry_type = 'credit';
        (ledRefund as any).amount = amount;
        (ledRefund as any).balance_after = w.balance;
        ledRefund.transaction_id = savedTx.id;
        ledRefund.context = 'withdrawal_refund';
        await qrFail.manager.save(WalletLedger, ledRefund);

        await qrFail.commitTransaction();
      } catch (e) {
        await qrFail.rollbackTransaction();
        await qrFail.release();
        throw e;
      }
      await qrFail.release();
      return res.status(400).json({ success: false, message: transfer.message || 'Failed to initiate bank transfer' });
    }

    // Stage 2B: success — settle (atomic)
    const qrSucc = AppDataSource.createQueryRunner();
    await qrSucc.connect();
    await qrSucc.startTransaction();
    try {
      const w = await qrSucc.manager.findOne(Wallet, { where: { id: wallet.id } });
      if (!w) throw new Error('Wallet not found');
      (w as any).pending_balance = Math.max(0, Math.round((((w.pending_balance || 0) - amount) + Number.EPSILON) * 100) / 100);
      await qrSucc.manager.save(Wallet, w);

      savedTx.status = TransactionStatus.COMPLETED;
      savedTx.description = 'Withdrawal completed';
      await qrSucc.manager.save(Transaction, savedTx);

      savedWd.status = 'completed';
      savedWd.external_reference = transfer.data.transfer_code || transfer.data.reference;
      savedWd.completed_at = new Date();
      await qrSucc.manager.save(Withdrawal, savedWd);

      // Fee transaction (accounting) — does not change balance now (already held), but recorded for clarity
      const feeTx = new Transaction();
      feeTx.wallet_id = w.id;
      feeTx.user_id = req.user.id;
      (feeTx as any).amount = fee;
      feeTx.transaction_type = TransactionType.WITHDRAWAL_FEE;
      feeTx.status = TransactionStatus.COMPLETED;
      feeTx.description = 'Withdrawal fee';
      const savedFeeTx = await qrSucc.manager.save(Transaction, feeTx);

      const ledSettle = new WalletLedger();
      ledSettle.wallet_id = w.id;
      ledSettle.user_id = req.user.id;
      (ledSettle as any).entry_type = 'debit';
      (ledSettle as any).amount = net;
      (ledSettle as any).balance_after = w.balance; // unchanged on settle
      ledSettle.transaction_id = savedTx.id;
      ledSettle.context = 'withdrawal_settle';
      await qrSucc.manager.save(WalletLedger, ledSettle);

      const ledFee = new WalletLedger();
      ledFee.wallet_id = w.id;
      ledFee.user_id = req.user.id;
      (ledFee as any).entry_type = 'debit';
      (ledFee as any).amount = fee;
      (ledFee as any).balance_after = w.balance; // unchanged on settle
      ledFee.transaction_id = savedFeeTx.id;
      ledFee.context = 'withdrawal_fee';
      await qrSucc.manager.save(WalletLedger, ledFee);

      await qrSucc.commitTransaction();
    } catch (e) {
      await qrSucc.rollbackTransaction();
      await qrSucc.release();
      throw e;
    }
    await qrSucc.release();

    res.status(201).json({ success: true, data: { withdrawal: savedWd } });
  } catch (error) {
    console.error('Create withdrawal error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get('/withdrawals', authenticate, async (req: any, res) => {
  try {
    const list = await AppDataSource.getRepository(Withdrawal).find({ where: { user_id: req.user.id }, order: { requested_at: 'DESC' as any } });
    res.json({ success: true, data: { withdrawals: list } });
  } catch (error) {
    console.error('List withdrawals error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get('/withdrawals/:id', authenticate, async (req: any, res) => {
  try {
    const wd = await AppDataSource.getRepository(Withdrawal).findOne({ where: { id: req.params.id, user_id: req.user.id } });
    if (!wd) {
      return res.status(404).json({ success: false, message: 'Withdrawal not found' });
    }
    res.json({ success: true, data: { withdrawal: wd } });
  } catch (error) {
    console.error('Get withdrawal error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
