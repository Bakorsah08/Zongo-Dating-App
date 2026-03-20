import React, { useState, useMemo } from 'react';
import BackButton from './BackButton';

interface CashOutViewProps {
  earnings: number;
  onBack: () => void;
  onConfirmCashOut: (amount: number) => void;
}

const CONVERSION_RATE = 0.01; // 100 earnings = $1
const PAYMENT_METHODS = ['PayPal', 'Bank Transfer', 'Venmo'];

const CashOutView: React.FC<CashOutViewProps> = ({ earnings, onBack, onConfirmCashOut }) => {
  const [amount, setAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState(PAYMENT_METHODS[0]);
  const [isSuccess, setIsSuccess] = useState(false);

  const numericAmount = parseFloat(amount) || 0;
  const usdValue = useMemo(() => numericAmount * CONVERSION_RATE, [numericAmount]);
  const isInvalid = numericAmount > earnings || numericAmount <= 0;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow only numbers and a single decimal point
    const value = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setAmount(value);
  };
  
  const handleConfirm = () => {
    if(isInvalid) return;
    onConfirmCashOut(numericAmount);
    setIsSuccess(true);
  };
  
  if (isSuccess) {
    return (
      <div className="p-6 bg-zinc-950 min-h-screen flex flex-col items-center justify-center text-center animate-in fade-in duration-500">
        <div className="text-6xl mb-6">✅</div>
        <h2 className="text-2xl font-bold mb-2">Withdrawal Submitted!</h2>
        <p className="text-zinc-400 mb-8 max-w-xs">
          Your request to withdraw ${usdValue.toFixed(2)} has been received. It may take 3-5 business days to process.
        </p>
        <button 
          onClick={onBack}
          className="w-full max-w-sm gradient-pink py-4 rounded-2xl font-black text-white shadow-lg active:scale-95 transition-all"
        >
          Done
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 bg-zinc-950 min-h-screen">
      <div className="flex items-center justify-between mb-8">
        <BackButton onClick={onBack} />
        <h1 className="text-xl font-bold">Cash Out</h1>
        <div className="w-10" aria-hidden />
      </div>

      <div className="bg-gradient-to-br from-zinc-900 to-black p-8 rounded-3xl border border-zinc-800 text-center mb-10 shadow-2xl">
        <p className="text-zinc-400 text-sm mb-1 uppercase tracking-widest font-medium">Available to Withdraw</p>
        <h2 className="text-5xl font-black text-white">${(earnings * CONVERSION_RATE).toFixed(2)}</h2>
        <p className="text-zinc-500 text-xs mt-2">({earnings.toLocaleString()} earnings)</p>
      </div>

      <div className="space-y-8">
        {/* Amount Input */}
        <div>
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 px-2 block">Amount</label>
          <div className="relative">
            <input 
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={handleAmountChange}
              placeholder="0"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 pr-24 text-2xl font-bold outline-none focus:border-pink-500 transition-colors"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 font-bold text-sm">EARNINGS</span>
          </div>
          <p className="text-sm text-pink-400 mt-2 px-2 h-5">
            {numericAmount > 0 && `You'll receive: $${usdValue.toFixed(2)}`}
          </p>
        </div>

        {/* Payment Method */}
        <div>
          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3 px-2 block">Payment Method</label>
          <div className="flex gap-2 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
            {PAYMENT_METHODS.map(method => (
              <button
                key={method}
                onClick={() => setSelectedMethod(method)}
                className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${
                  selectedMethod === method ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:bg-zinc-800/50'
                }`}
              >
                {method}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="fixed bottom-8 left-6 right-6 max-w-[calc(100%-48px)] mx-auto">
        <button
          onClick={handleConfirm}
          disabled={isInvalid}
          className="w-full gradient-pink py-4 rounded-2xl font-black text-white shadow-lg active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Confirm Withdrawal
        </button>
      </div>
    </div>
  );
};

export default CashOutView;