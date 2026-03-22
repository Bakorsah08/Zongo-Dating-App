import React, { useState, useEffect } from 'react';
import type { PayoutDetails } from '../types';
import { adminStore } from './store';

const PayoutPage: React.FC = () => {
  const [details, setDetails] = useState<PayoutDetails | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const platformRevenue = adminStore.getPlatformRevenueFromTokenSales();
  const platformFromGifts = (() => {
    const users = adminStore.getUsers();
    const creatorEarnings = users.reduce((s, u) => s + (u.earnings || 0), 0);
    const settings = adminStore.getMonetizationSettings();
    const share = settings.creatorRevenueSharePercent || 70;
    return share < 100 ? creatorEarnings * (100 - share) / share : 0;
  })();
  const totalAvailable = platformRevenue + platformFromGifts;
  const transferredOut = adminStore.getPlatformTransferredOut();
  const outstanding = totalAvailable - transferredOut;

  useEffect(() => {
    setDetails(adminStore.getPlatformPayoutDetails());
  }, []);

  const handleSaveDetails = (d: PayoutDetails | null) => {
    adminStore.setPlatformPayoutDetails(d);
    setDetails(d);
  };

  const handleWithdraw = () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) {
      alert('Enter a valid amount');
      return;
    }
    if (amount > outstanding) {
      alert(`Maximum withdrawable: $${outstanding.toFixed(2)}`);
      return;
    }
    if (!details?.bankName && !details?.mobileNumber) {
      alert('Add your bank or mobile money details first');
      return;
    }
    adminStore.addPlatformTransferredOut(amount);
    setWithdrawAmount('');
    alert(`Transfer of $${amount.toFixed(2)} recorded. Funds will be sent to your ${details?.type === 'bank' ? 'bank account' : 'mobile money'}.`);
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-zinc-900 dark:text-white">Platform Payout</h1>
        <p className="text-zinc-500 mt-1">Add bank or mobile money details to withdraw your revenue</p>
      </div>

      {/* Balance summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
          <p className="text-zinc-500 text-xs uppercase font-bold mb-1">Total Revenue</p>
          <p className="text-2xl font-black text-zinc-900 dark:text-white">${totalAvailable.toFixed(2)}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
          <p className="text-zinc-500 text-xs uppercase font-bold mb-1">Transferred Out</p>
          <p className="text-2xl font-black text-zinc-600 dark:text-zinc-400">${transferredOut.toFixed(2)}</p>
        </div>
        <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-2xl p-6">
          <p className="text-zinc-500 text-xs uppercase font-bold mb-1">Outstanding</p>
          <p className="text-2xl font-black text-zinc-900 dark:text-emerald-400">${outstanding.toFixed(2)}</p>
        </div>
      </div>

      {/* Payout details */}
      <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">Bank / Mobile Money Details</h2>
        <PayoutDetailsForm details={details} onSave={handleSaveDetails} />
      </section>

      {/* Withdraw */}
      <section className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-4">Withdraw to Bank</h2>
        <p className="text-zinc-500 text-sm mb-4">Transfer your outstanding balance to your bank or mobile money account.</p>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-zinc-500 text-sm mb-1">Amount ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder={outstanding.toFixed(2)}
              className="px-4 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white w-40"
            />
          </div>
          <button
            onClick={handleWithdraw}
            disabled={outstanding <= 0}
            className="px-6 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl"
          >
            Withdraw
          </button>
        </div>
      </section>
    </div>
  );
};

const PayoutDetailsForm: React.FC<{ details: PayoutDetails | null; onSave: (d: PayoutDetails | null) => void }> = ({ details, onSave }) => {
  const [type, setType] = useState<'bank' | 'mobile_money'>(details?.type || 'bank');
  const [bankName, setBankName] = useState(details?.bankName || '');
  const [accountNumber, setAccountNumber] = useState(details?.accountNumber || '');
  const [accountName, setAccountName] = useState(details?.accountName || '');
  const [provider, setProvider] = useState(details?.provider || '');
  const [mobileNumber, setMobileNumber] = useState(details?.mobileNumber || '');

  const handleSave = () => {
    if (type === 'bank') {
      if (!bankName || !accountNumber || !accountName) {
        alert('Fill bank name, account number, and account name');
        return;
      }
      onSave({ type: 'bank', bankName, accountNumber, accountName });
    } else {
      if (!provider || !mobileNumber) {
        alert('Fill provider and mobile number');
        return;
      }
      onSave({ type: 'mobile_money', provider, mobileNumber });
    }
  };

  return (
    <div className="space-y-4 max-w-md">
      <div>
        <label className="block text-zinc-500 text-sm mb-1">Payout method</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="payoutType" checked={type === 'bank'} onChange={() => setType('bank')} className="rounded" />
            <span>Bank</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="radio" name="payoutType" checked={type === 'mobile_money'} onChange={() => setType('mobile_money')} className="rounded" />
            <span>Mobile Money</span>
          </label>
        </div>
      </div>
      {type === 'bank' ? (
        <>
          <div>
            <label className="block text-zinc-500 text-sm mb-1">Bank name</label>
            <input value={bankName} onChange={(e) => setBankName(e.target.value)} className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white" placeholder="e.g. Chase Bank" />
          </div>
          <div>
            <label className="block text-zinc-500 text-sm mb-1">Account number</label>
            <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white" placeholder="1234567890" />
          </div>
          <div>
            <label className="block text-zinc-500 text-sm mb-1">Account name</label>
            <input value={accountName} onChange={(e) => setAccountName(e.target.value)} className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white" placeholder="John Doe" />
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="block text-zinc-500 text-sm mb-1">Provider</label>
            <div className="flex gap-2">
              {['MTN', 'Vodafone', 'AirtelTigo', 'Other'].map((p) => (
                <button key={p} onClick={() => setProvider(p)} className={`px-3 py-1.5 rounded-lg text-sm ${provider === p ? 'bg-rose-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'}`}>{p}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-zinc-500 text-sm mb-1">Mobile number</label>
            <input value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} className="w-full px-4 py-2 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white" placeholder="e.g. 0244123456" />
          </div>
        </>
      )}
      <div className="flex gap-3">
        <button onClick={handleSave} className="px-6 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl">Save details</button>
      </div>
    </div>
  );
};

export default PayoutPage;
